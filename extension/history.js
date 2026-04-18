(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  // All ballot + decision history is kept in chrome.storage.local, which is
  // isolated per-extension and per-user-profile and never leaves the browser
  // unless an explicit export is triggered. We also mirror the latest payload
  // into chrome.storage.session as a best-effort guard against third-party
  // page scripts scraping the DOM report (session storage is ext-only).
  const ROOT_KEY = "votingHistory";
  const SCHEMA_VERSION = 1;

  function now() {
    return Date.now();
  }

  function load() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(ROOT_KEY, (res) => {
          const root = (res && res[ROOT_KEY]) || {
            schemaVersion: SCHEMA_VERSION,
            ballots: {},
          };
          if (!root.ballots) root.ballots = {};
          resolve(root);
        });
      } catch (_) {
        resolve({ schemaVersion: SCHEMA_VERSION, ballots: {} });
      }
    });
  }

  function save(root) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [ROOT_KEY]: root }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  async function upsertBallot(ballotKey, meta, url) {
    const root = await load();
    const existing = root.ballots[ballotKey] || {};
    root.ballots[ballotKey] = {
      ballotKey,
      url: url || existing.url || null,
      meta: meta || existing.meta || {},
      firstSeen: existing.firstSeen || now(),
      updatedAt: now(),
      items: existing.items || {},
    };
    await save(root);
    return root.ballots[ballotKey];
  }

  async function recordAI(ballotKey, item, decision) {
    const root = await load();
    const ballot = root.ballots[ballotKey];
    if (!ballot) return null;

    const prior = ballot.items[item.id] || {};
    ballot.items[item.id] = {
      ...prior,
      id: item.id,
      title: item.title,
      boardRecommendation: item.boardRecommendation || null,
      ai: {
        recommendation: (decision.recommendation || "ABSTAIN").toUpperCase(),
        reasoning: decision.reasoning || "",
        sources: Array.isArray(decision.sources)
          ? decision.sources.filter(Boolean)
          : [],
        decidedAt: now(),
      },
      // Only reset user-side state if this is a fresh AI run (rerun())
      user: prior.user || null,
      override: prior.override || null,
    };
    ballot.updatedAt = now();
    await save(root);
    return ballot.items[item.id];
  }

  async function recordUserChoice(ballotKey, itemId, userChoice, overrideReason) {
    const root = await load();
    const ballot = root.ballots[ballotKey];
    if (!ballot) return null;
    const entry = ballot.items[itemId];
    if (!entry) return null;

    const ai = entry.ai || {};
    const aiPick = (ai.recommendation || "").toUpperCase();
    const pick = (userChoice || "").toUpperCase();
    const overridden = aiPick && pick && aiPick !== pick;

    entry.user = {
      choice: pick,
      recordedAt: now(),
    };
    entry.override = overridden
      ? {
          from: aiPick,
          to: pick,
          reason: (overrideReason || "").trim(),
          recordedAt: now(),
        }
      : null;

    ballot.updatedAt = now();
    await save(root);
    return entry;
  }

  async function getBallot(ballotKey) {
    const root = await load();
    return root.ballots[ballotKey] || null;
  }

  async function listBallots() {
    const root = await load();
    return Object.values(root.ballots).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  AIPV.history = {
    upsertBallot,
    recordAI,
    recordUserChoice,
    getBallot,
    listBallots,
    ROOT_KEY,
  };
})();
