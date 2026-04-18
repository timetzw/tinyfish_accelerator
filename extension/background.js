// Background service worker for AI Proxy Voting Assistant.
//
// Handles:
//   - "decide" : orchestrates TinyFish research + DeepSeek reasoning
//   - "ping"   : connectivity sanity check for the options page
//
// Keys live in chrome.storage.local and never leave the browser except to
// the configured DeepSeek and TinyFish endpoints.

const TAG = "[AIPV bg]";
const TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";
const TINYFISH_TIMEOUT_MS = 90_000;
const DEEPSEEK_TIMEOUT_MS = 90_000;

chrome.runtime.onInstalled.addListener((details) => {
  console.log(TAG, "installed", details.reason);
});

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "tinyfishApiKey",
        "deepseekApiKey",
        "deepseekBaseUrl",
        "deepseekModel",
        "secApiKey",
        "aggressiveResearch",
        "votingHistory",
        "profile",
      ],
      (res) => resolve(res || {})
    );
  });
}

// Per-service-worker cache of ticker → directors-roster JSON to avoid
// hammering SEC-API.io once per ballot item. Keyed by ticker, value is the
// raw JSON or a sentinel error string.
const directorsCache = new Map();

// ---------------------------------------------------------------------------
// TinyFish SSE client
// ---------------------------------------------------------------------------

async function tinyfishRun(url, goal, apiKey, { signal } = {}) {
  if (!apiKey) throw new Error("TinyFish API key not set");
  const payload = {
    url,
    goal,
    session_id: crypto.randomUUID(),
    browser_profile: "lite",
  };

  const resp = await fetch(TINYFISH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`TinyFish HTTP ${resp.status}: ${txt.slice(0, 200)}`);
  }
  if (!resp.body) throw new Error("TinyFish returned no body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let lastResult = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data.trim() === "[DONE]") {
        try {
          reader.cancel();
        } catch (_) {}
        return lastResult;
      }
      try {
        const event = JSON.parse(data);
        if (event && typeof event === "object") {
          const raw = event.result;
          if (typeof raw === "string") {
            lastResult = raw;
          } else if (raw && typeof raw === "object") {
            lastResult = raw.result || lastResult;
          }
        }
      } catch (_) {
        // ignore malformed lines
      }
    }
  }

  return lastResult;
}

function withTimeout(promiseFactory, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promiseFactory(controller.signal)
    .catch((err) => {
      if (controller.signal.aborted) {
        throw new Error(`${label} timed out after ${ms}ms`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Research: do 1-2 TinyFish calls per proposal and combine results.
// ---------------------------------------------------------------------------

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

function isDirectorElection(item) {
  const t = (item.title || "").toLowerCase();
  return /\b(elect|election|re-?elect|nominee|director)\b/.test(t);
}

function extractNomineeName(title) {
  // Typical formats:
  //   "Election of Director: John Q. Smith"
  //   "Elect John Q. Smith"
  //   "Re-elect John Q. Smith as Director"
  const s = String(title || "");
  const patterns = [
    /election of director[:\s\-\u2013\u2014]+(.+)/i,
    /elect director[:\s\-\u2013\u2014]+(.+)/i,
    /(?:re[- ]?)?elect[:\s\-\u2013\u2014]+(.+?)(?:\s+as\s+director|\s+to\s+the\s+board|$)/i,
    /director\s+nominee[:\s\-\u2013\u2014]+(.+)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return m[1].trim().replace(/[.,;]+$/, "");
  }
  return null;
}

async function fetchSecApiDirectors(ticker, token) {
  if (!ticker || !token) return null;
  if (directorsCache.has(ticker)) return directorsCache.get(ticker);

  try {
    const url = `https://api.sec-api.io/directors-board-members?token=${encodeURIComponent(
      token
    )}`;
    const body = JSON.stringify({
      query: `ticker:${ticker}`,
      from: 0,
      size: 30,
      sort: [{ filedAt: { order: "desc" } }],
    });
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!resp.ok) {
      const err = `SEC-API ${resp.status}`;
      directorsCache.set(ticker, { error: err });
      return { error: err };
    }
    const json = await resp.json();
    directorsCache.set(ticker, json);
    return json;
  } catch (err) {
    const out = { error: err.message || String(err) };
    directorsCache.set(ticker, out);
    return out;
  }
}

function summarizeSecApiForNominee(rosterJson, nomineeName) {
  if (!rosterJson || rosterJson.error) {
    return rosterJson && rosterJson.error
      ? `[SEC-API.io: ${rosterJson.error}]`
      : "";
  }
  const items = rosterJson.data || rosterJson.directors || [];
  if (!Array.isArray(items) || items.length === 0) return "";

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const target = nomineeName ? norm(nomineeName) : "";

  const pick = (d) => {
    const name = d.name || d.fullName || d.directorName || "";
    const age = d.age || d.directorAge || "";
    const independent =
      d.independent != null
        ? d.independent
        : d.isIndependent != null
          ? d.isIndependent
          : null;
    const occupation = d.occupation || d.principalOccupation || d.position || "";
    const otherBoards =
      d.otherDirectorships || d.otherBoards || d.additionalDirectorships || [];
    const committees = d.committeeMemberships || d.committees || [];
    const tenure = d.yearsOfService || d.tenure || d.directorSince || "";
    return {
      name,
      age,
      independent,
      occupation,
      otherBoardsCount: Array.isArray(otherBoards)
        ? otherBoards.length
        : typeof otherBoards === "number"
          ? otherBoards
          : null,
      otherBoards,
      committees,
      tenure,
    };
  };

  // Try nominee-specific match first, then fall back to the full roster.
  if (target) {
    const match = items.find((d) => {
      const n = norm(d.name || d.fullName || d.directorName);
      return n && (n === target || n.includes(target) || target.includes(n));
    });
    if (match) {
      const p = pick(match);
      return `Director roster (SEC-API.io) — match for "${nomineeName}":\n${JSON.stringify(p, null, 2)}`;
    }
  }

  const all = items.slice(0, 15).map(pick);
  return `Director roster (SEC-API.io) — full board (${all.length} members):\n${JSON.stringify(all, null, 2)}`;
}

function planResearchPhases(item, meta, settings) {
  const director = isDirectorElection(item);
  const ticker = meta.ticker || null;
  const phases = [];
  if ((item.moreDetailsUrl || item.pageUrl) && settings.tinyfishApiKey) {
    phases.push({
      key: "detail",
      label: director
        ? "TinyFish · reading nominee bio"
        : "TinyFish · reading proposal detail",
    });
  }
  if (settings.aggressiveResearch && settings.tinyfishApiKey) {
    phases.push({
      key: "research",
      label: director
        ? "TinyFish · external nominee research"
        : "TinyFish · ISS / Glass Lewis / peers",
    });
  }
  if (director && ticker && settings.secApiKey) {
    phases.push({
      key: "secApi",
      label: "SEC-API.io · director roster",
    });
  }
  return phases;
}

async function researchProposal(item, meta, settings, onPhase = () => {}) {
  const tasks = [];
  const labels = [];

  const company = meta.company || "the company";
  const ticker = meta.ticker || null;
  const proposalUrl = item.moreDetailsUrl || item.pageUrl || "";
  const director = isDirectorElection(item);
  const nomineeName = director ? extractNomineeName(item.title) : null;

  const wrap = (key, label, p) => {
    onPhase("start", key, label);
    return p
      .then((r) => {
        onPhase("done", key, label);
        return r;
      })
      .catch((err) => {
        onPhase("done", key, label);
        return `[research failed: ${err.message || err}]`;
      });
  };

  console.log(
    TAG,
    `research "${item.title}" director=${director}`,
    `detailUrl=${proposalUrl || "(none)"} ticker=${ticker || "(none)"}`
  );

  // ---- Call 1: proposal detail / director bio ----
  if (proposalUrl && settings.tinyfishApiKey) {
    labels.push("detail");
    const goal = director
      ? `You are on a proxy ballot page. Locate the nominee for proposal
         "${item.title}" (proposal #${item.id}) and click the nominee's bio /
         "more information" link or expand the nominee section. Extract the
         following fields about ${nomineeName || "the nominee"} and return as
         JSON on a single line, followed by a 1-2 sentence plain-text summary:
         {"name":"", "age":null, "independent":true|false|null,
          "tenureYears":null, "occupation":"", "isChair":false,
          "isLeadDirector":false, "committees":[],
          "otherPublicBoards":[], "otherPublicBoardsCount":null,
          "notableFacts":""}
         If a field is not stated, use null. Do not invent data.`
      : `You are reading a proxy ballot proposal detail page. Find the full
         text of proposal "${item.title}" and the board's stated rationale
         ("For" or "Against"). Return plain text only, no HTML, 500-2000
         words max. If you can also find the proponent (board vs.
         shareholder), note it on the first line as "Proponent: X".`;

    tasks.push(
      wrap(
        "detail",
        director
          ? "TinyFish · reading nominee bio"
          : "TinyFish · reading proposal detail",
        withTimeout(
          (signal) => tinyfishRun(proposalUrl, goal, settings.tinyfishApiKey, { signal }),
          TINYFISH_TIMEOUT_MS,
          "TinyFish detail"
        )
      )
    );
  }

  // ---- Call 2 (aggressive mode): external research ----
  if (settings.aggressiveResearch && settings.tinyfishApiKey) {
    labels.push("research");
    const query = director
      ? `${nomineeName || item.title} ${company} director overboarding independence other boards`
      : `${company} ${item.title} ISS Glass Lewis recommendation`;
    const goal = director
      ? `Find independent information about ${nomineeName || "the director nominee"}
         of ${company}. List every public company board they currently serve on
         (count is critical). Note any controversies, independence concerns,
         or past governance issues. ISS or Glass Lewis view if available.
         Return 200-400 words and cite URLs.`
      : `Summarize how ISS, Glass Lewis, or major institutional shareholders
         are recommending to vote on "${item.title}" at ${company}. Also
         note any controversies, peer-comparison data (e.g., CEO pay ratio
         vs. peers), or recent news relevant to this vote. 200-500 words.
         Cite URLs you visited.`;
    tasks.push(
      wrap(
        "research",
        director
          ? "TinyFish · external nominee research"
          : "TinyFish · ISS / Glass Lewis / peers",
        withTimeout(
          (signal) =>
            tinyfishRun(
              `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              goal,
              settings.tinyfishApiKey,
              { signal }
            ),
          TINYFISH_TIMEOUT_MS,
          "TinyFish research"
        )
      )
    );
  }

  // ---- Call 3: SEC-API.io structured directors (per-ticker, cached) ----
  if (director && ticker && settings.secApiKey) {
    labels.push("secApi");
    tasks.push(
      wrap(
        "secApi",
        "SEC-API.io · director roster",
        fetchSecApiDirectors(ticker, settings.secApiKey).then((json) =>
          summarizeSecApiForNominee(json, nomineeName)
        )
      )
    );
  }

  const results = await Promise.all(tasks);
  const context = { isDirector: director, nomineeName };
  results.forEach((r, i) => {
    context[labels[i]] = truncate(r || "", 6000);
  });
  return context;
}

// ---------------------------------------------------------------------------
// DeepSeek reasoning
// ---------------------------------------------------------------------------

const PROFILE_LABELS = {
  philosophy: "Firm investment philosophy",
  horizon: "Typical holding period",
  boardIndependence: "Importance of board independence",
  overboarding: "Stance on overboarded directors",
  ceoChair: "Stance on combined CEO/Chair",
  sayOnPay: "Say-on-pay approach",
  equityPlans: "Equity-plan / dilution stance",
  envProposals: "Environmental shareholder-proposal stance",
  socialProposals: "Social shareholder-proposal stance",
  shareholderVsBoard: "Instinct when shareholder and board conflict",
  auditorTenure: "Auditor-tenure scrutiny",
  maPosture: "Default posture on M&A / major capital transactions",
};

const PROFILE_VALUE_NOTES = {
  philosophy: {
    esg: "ESG-focused",
    value: "value-oriented",
    growth: "growth-oriented",
    preservation: "capital preservation",
    balanced: "balanced / multi-strategy",
  },
  horizon: {
    short: "short-term (<1 year)",
    medium: "medium-term (1–5 years)",
    long: "long-term (5+ years)",
  },
  boardIndependence: {
    critical: "critical — vote against non-independent chairs",
    important: "important — prefer majority independent",
    flexible: "flexible — case by case",
  },
  overboarding: {
    strict4: "vote against directors on 4+ public boards",
    flag: "flag for review but no auto-vote",
    none: "not a factor",
  },
  ceoChair: {
    against: "always vote against combined roles",
    depends: "depends on company performance",
    none: "no strong view",
  },
  sayOnPay: {
    strict: "vote against if pay exceeds peer median by 25%+",
    moderate: "focus on pay-for-performance alignment",
    supportive: "generally follow board recommendation",
  },
  equityPlans: {
    scrutinize: "vote against if dilution >5%",
    review: "weigh retention value vs dilution cost",
    supportive: "generally supportive of equity comp",
  },
  envProposals: {
    strong: "strong support — vote FOR most climate proposals",
    selective: "support if company lacks a credible plan",
    neutral: "evaluate on business materiality only",
    against: "generally against ESG-agenda proposals",
  },
  socialProposals: {
    supportive: "supportive of transparency proposals",
    material: "only if financially material",
    case: "case-by-case, no default",
    oppose: "generally oppose — outside mandate",
  },
  shareholderVsBoard: {
    shareholder: "lean toward shareholder proposal",
    board: "lean toward board recommendation",
    independent: "evaluate independently every time",
  },
  auditorTenure: {
    over7: "flag if same auditor >7 years",
    over15: "flag only if >15 years",
    none: "not a factor",
  },
  maPosture: {
    followBoard: "follow board unless red flags",
    human: "always route M&A to human review",
    returns: "evaluate against return requirements",
  },
};

function summarizeProfile(profile) {
  if (!profile || !profile.answers) return "(profile not set)";
  const lines = [];
  for (const [k, label] of Object.entries(PROFILE_LABELS)) {
    const v = profile.answers[k];
    if (!v) continue;
    const note = (PROFILE_VALUE_NOTES[k] && PROFILE_VALUE_NOTES[k][v]) || v;
    lines.push(`- ${label}: ${note}`);
  }
  return lines.join("\n") || "(profile not set)";
}

function summarizeOverrideHistory(votingHistory, currentBallotKey) {
  if (!votingHistory || !votingHistory.ballots) return "(no prior overrides)";
  const entries = [];
  for (const b of Object.values(votingHistory.ballots)) {
    if (b.ballotKey === currentBallotKey) continue; // exclude current ballot
    for (const it of Object.values(b.items || {})) {
      if (!it.override || !it.override.reason) continue;
      entries.push(
        `- ${(b.meta && b.meta.company) || "?"} · "${it.title}" · AI said ${it.override.from}, user voted ${it.override.to} — reason: ${it.override.reason}`
      );
    }
  }
  if (entries.length === 0) return "(no prior overrides with reasons)";
  return entries.slice(0, 20).join("\n");
}

function buildDeepseekMessages({ item, meta, profile, research, overrideSummary }) {
  const isDirector = !!research.isDirector;
  const answers = (profile && profile.answers) || {};

  const system = `You are Consul.AI, an independent proxy-vote analyst acting
on behalf of an institutional investor. You must recommend FOR, AGAINST, or
ABSTAIN on a single ballot item, and explain the full chain of reasoning in
plain language.

Hard rules:
- Decide ONLY one of: FOR, AGAINST, ABSTAIN.
- Weigh the board's rationale, independent research (ISS/Glass Lewis, peers,
  news) and the investor's stated voting-philosophy profile + their past
  override patterns.
- Apply the investor's explicit bright-line rules strictly. Examples: "vote
  against if director on 4+ boards", "against say-on-pay if pay >25% above
  peer median", "against equity plans if dilution >5%".
- For DIRECTOR ELECTION items specifically: do NOT abstain just because
  research is incomplete. The default for a director nominee with no red
  flags is to follow the board (usually FOR). Only return AGAINST when a
  bright-line rule fires (overboarding count ≥ threshold, non-independent
  chair when investor requires independent, combined CEO/Chair when
  investor opposes, or a material controversy). Use ABSTAIN only when
  every piece of evidence is missing AND the investor has chosen
  "flexible / case by case" on the relevant axis.
- If the investor's M&A posture is "always route to human review" and this
  item is an M&A or major capital transaction, return ABSTAIN with reasoning
  that explicitly notes "pending human review".
- Cite the specific profile fields you applied in your reasoning (e.g.,
  "Investor's overboarding rule: strict4 — nominee sits on 5 public boards
  per SEC-API roster → AGAINST").
- Respond ONLY with a JSON object (no markdown, no prose around it) of the
  shape:
  {"recommendation":"FOR|AGAINST|ABSTAIN","reasoning":"...","sources":["url1","url2"]}`;

  const directorHints = isDirector
    ? `
DIRECTOR-ELECTION RULEBOOK (apply in this order, stop at first trigger):
1. Overboarding — investor setting: ${answers.overboarding || "(unset)"}.
   - strict4: AGAINST if nominee currently sits on 4 or more public boards
     (inclusive of this one).
   - flag: FOR with a caveat noting the overboarding risk if count ≥ 4.
   - none: do not use board count as a factor.
2. Independence — investor setting: ${answers.boardIndependence || "(unset)"}.
   - critical: AGAINST if nominee is a non-independent chair.
   - important: AGAINST only if this board lacks a majority of independents
     AND this nominee is non-independent.
   - flexible: case by case.
3. Combined CEO/Chair — investor setting: ${answers.ceoChair || "(unset)"}.
   - against: AGAINST if nominee is combining CEO and Chair roles.
   - depends: weigh company performance (5-yr TSR) before voting AGAINST.
   - none: ignore this axis.
4. Controversies — AGAINST if independent research surfaces a material
   governance or ethics controversy clearly attributable to this nominee.
5. Default — if none of the above trigger and the nominee appears qualified,
   vote FOR (matching board recommendation).`
    : "";

  const user = `BALLOT ITEM
Company: ${meta.company || "Unknown"} (${meta.ticker || "ticker unknown"})
Meeting: ${meta.meetingName || "Unknown"}
Proposal #${item.id}: ${item.title}
Board recommendation: ${item.boardRecommendation || "not stated"}
Item type: ${isDirector ? `DIRECTOR ELECTION (nominee: ${research.nomineeName || "unparsed"})` : "non-director"}

INVESTOR PROFILE
${summarizeProfile(profile)}
${directorHints}

PAST USER OVERRIDES (these tell you how the investor deviates from generic
AI recommendations — weight them highly):
${overrideSummary}

RESEARCH (via TinyFish Web Agent)
--- ${isDirector ? "Nominee bio from ProxyVote" : "Proposal detail & board rationale"} ---
${research.detail || "(not fetched)"}

--- External research (ISS / Glass Lewis / peers / news) ---
${research.research || "(not fetched — aggressive research is off or unavailable)"}

--- Structured directors data (SEC-API.io) ---
${research.secApi || "(not available — set SEC-API.io token to enable structured roster data)"}

Produce the JSON object now.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

async function deepseekReason(messages, settings) {
  if (!settings.deepseekApiKey) throw new Error("DeepSeek API key not set");
  const base = (settings.deepseekBaseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = settings.deepseekModel || "deepseek-reasoner";

  return withTimeout(
    async (signal) => {
      const resp = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          stream: false,
        }),
        signal,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`DeepSeek HTTP ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const data = await resp.json();
      const content = data && data.choices && data.choices[0]
        && data.choices[0].message && data.choices[0].message.content;
      return content || "";
    },
    DEEPSEEK_TIMEOUT_MS,
    "DeepSeek"
  );
}

function parseDecision(text) {
  if (!text) throw new Error("Empty DeepSeek response");
  // Strip any ```json fences or surrounding prose.
  let s = text.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  const braceStart = s.indexOf("{");
  const braceEnd = s.lastIndexOf("}");
  if (braceStart === -1 || braceEnd === -1) {
    throw new Error("DeepSeek response did not contain JSON");
  }
  const json = JSON.parse(s.slice(braceStart, braceEnd + 1));
  const rec = String(json.recommendation || "").toUpperCase();
  if (!["FOR", "AGAINST", "ABSTAIN"].includes(rec)) {
    throw new Error(`Invalid recommendation: ${rec}`);
  }
  return {
    recommendation: rec,
    reasoning: String(json.reasoning || "").trim(),
    sources: Array.isArray(json.sources) ? json.sources.filter(Boolean) : [],
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function decideWithProgress(payload, emit = () => {}) {
  const { item, meta, ballotKey } = payload;
  const settings = await getSettings();

  if (!settings.tinyfishApiKey || !settings.deepseekApiKey) {
    return {
      ok: false,
      error: "missing-keys",
      message:
        "API keys not configured. Open extension options to set your TinyFish and DeepSeek keys.",
    };
  }

  // Plan the phases up-front so the progress bar has a stable denominator.
  const researchPhases = planResearchPhases(item, meta, settings);
  const totalWeight = researchPhases.length + 1; // +1 for DeepSeek
  let completedWeight = 0;
  const activePhases = new Map(); // key → label

  const pct = () => Math.round((completedWeight / totalWeight) * 100);

  const currentLabel = () => {
    // Show the most recently started phase (last inserted).
    if (activePhases.size === 0) return "Finalizing";
    const entries = Array.from(activePhases.values());
    return entries[entries.length - 1];
  };

  const push = (extra = {}) =>
    emit({ pct: pct(), label: currentLabel(), ...extra });

  const onPhase = (kind, key, label) => {
    if (kind === "start") {
      activePhases.set(key, label);
      push({ phase: key, event: "start" });
    } else if (kind === "done") {
      activePhases.delete(key);
      completedWeight += 1;
      push({ phase: key, event: "done" });
    }
  };

  emit({
    pct: 0,
    label: `Planning · ${researchPhases.length} research call${researchPhases.length === 1 ? "" : "s"} + DeepSeek reasoning`,
    phases: researchPhases.map((p) => p.key),
  });

  let research = { isDirector: isDirectorElection(item), nomineeName: null };
  try {
    research = await researchProposal(item, meta, settings, onPhase);
  } catch (err) {
    console.warn(TAG, "research failed", err);
    research.detail = `[research failed: ${err.message}]`;
  }

  const overrideSummary = summarizeOverrideHistory(
    settings.votingHistory,
    ballotKey
  );
  const messages = buildDeepseekMessages({
    item,
    meta,
    profile: settings.profile,
    research,
    overrideSummary,
  });

  onPhase("start", "deepseek", "DeepSeek · reasoning");
  let raw;
  try {
    raw = await deepseekReason(messages, settings);
  } finally {
    onPhase("done", "deepseek", "DeepSeek · reasoning");
  }

  const decision = parseDecision(raw);
  emit({ pct: 100, label: "Done", phase: "done", event: "done" });

  return {
    ok: true,
    decision,
    research: {
      hasDetail: !!research.detail,
      hasExternal: !!research.research,
      hasSecApi: !!research.secApi,
    },
  };
}

// ---------------------------------------------------------------------------
// Ping test (used by options page)
// ---------------------------------------------------------------------------

async function pingTest() {
  const settings = await getSettings();
  const results = {};

  if (settings.tinyfishApiKey) {
    try {
      const r = await withTimeout(
        (signal) =>
          tinyfishRun(
            "https://example.com",
            "Return the exact string PONG and nothing else.",
            settings.tinyfishApiKey,
            { signal }
          ),
        30_000,
        "TinyFish ping"
      );
      results.tinyfish = { ok: true, sample: (r || "").slice(0, 80) };
    } catch (err) {
      results.tinyfish = { ok: false, error: err.message };
    }
  }

  if (settings.deepseekApiKey) {
    try {
      const r = await deepseekReason(
        [
          { role: "system", content: "Reply with exactly: PONG" },
          { role: "user", content: "ping" },
        ],
        { ...settings, deepseekModel: settings.deepseekModel || "deepseek-chat" }
      );
      results.deepseek = { ok: true, sample: (r || "").slice(0, 80) };
    } catch (err) {
      results.deepseek = { ok: false, error: err.message };
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

// Long-lived port for streamed progress during decide().
//
// Notes on MV3 service-worker lifetimes:
// - An open port keeps the SW alive, but Chrome still terminates it after
//   ~5 minutes even with an active port. Long TinyFish + DeepSeek chains
//   can approach that window, so we also run a keep-alive ticker (a no-op
//   API call every 20s) which resets the idle timer.
// - We DO NOT call port.disconnect() ourselves after sending the result:
//   there's a well-known race where the immediate disconnect arrives at
//   the content side before the result message. The content script closes
//   the port when it receives the result; the keep-alive interval is
//   cleared via onDisconnect.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "decide") return;

  const keepAlive = setInterval(() => {
    try {
      chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
    } catch (_) {}
  }, 20_000);

  port.onDisconnect.addListener(() => {
    clearInterval(keepAlive);
  });

  port.onMessage.addListener(async (msg) => {
    if (!msg || msg.type !== "decide") return;
    const emit = (data) => {
      try {
        port.postMessage({ type: "progress", ...data });
      } catch (_) {}
    };
    try {
      const result = await decideWithProgress(msg.payload || {}, emit);
      try {
        port.postMessage({ type: "result", ...result });
      } catch (_) {}
    } catch (err) {
      console.error(TAG, "decide error", err);
      try {
        port.postMessage({
          type: "result",
          ok: false,
          error: err.message || String(err),
        });
      } catch (_) {}
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") {
    sendResponse({ ok: false, error: "invalid-message" });
    return false;
  }

  if (msg.type === "ping") {
    pingTest()
      .then((results) => sendResponse({ ok: true, results }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async
  }

  if (msg.type === "ballot-detected") {
    const tabId = sender.tab && sender.tab.id;
    const { itemCount, meta, url } = msg.payload || {};
    console.log(TAG, `ballot from tab ${tabId}: ${itemCount} items on ${url}`, meta);
    sendResponse({ ok: true });
    return false;
  }

  sendResponse({ ok: true });
  return false;
});
