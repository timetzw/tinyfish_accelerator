(function () {
  const FREE_TIER_LIMIT = 3;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const PREF_LABELS = {
    philosophy: {
      label: "Philosophy",
      values: {
        esg: "ESG-focused",
        value: "Value",
        growth: "Growth",
        preservation: "Capital preservation",
        balanced: "Balanced",
      },
    },
    horizon: {
      label: "Holding period",
      values: {
        short: "Short (<1yr)",
        medium: "Medium (1–5yr)",
        long: "Long (5+yr)",
      },
    },
    boardIndependence: {
      label: "Board independence",
      values: {
        critical: "Critical",
        important: "Important",
        flexible: "Flexible",
      },
    },
    overboarding: {
      label: "Overboarding",
      values: {
        strict4: "Against 4+ boards",
        flag: "Flag for review",
        none: "Not a factor",
      },
    },
    ceoChair: {
      label: "CEO/Chair combined",
      values: {
        against: "Against",
        depends: "Depends",
        none: "No view",
      },
    },
    sayOnPay: {
      label: "Say-on-pay",
      values: {
        strict: "Strict (25% peer)",
        moderate: "Pay-for-performance",
        supportive: "Supportive",
      },
    },
    equityPlans: {
      label: "Equity plans",
      values: {
        scrutinize: "Scrutinize (>5% dilution)",
        review: "Case-by-case",
        supportive: "Supportive",
      },
    },
    envProposals: {
      label: "Environmental",
      values: {
        strong: "Strong support",
        selective: "Selective",
        neutral: "Neutral",
        against: "Against",
      },
    },
    socialProposals: {
      label: "Social",
      values: {
        supportive: "Supportive",
        material: "If material",
        case: "Case-by-case",
        oppose: "Oppose",
      },
    },
    shareholderVsBoard: {
      label: "When in conflict",
      values: {
        shareholder: "Lean shareholder",
        board: "Lean board",
        independent: "Independent",
      },
    },
    auditorTenure: {
      label: "Auditor tenure",
      values: {
        over7: "Flag past 7yr",
        over15: "Flag past 15yr",
        none: "Not a factor",
      },
    },
    maPosture: {
      label: "M&A default",
      values: {
        followBoard: "Follow board",
        human: "Human review",
        returns: "Return-driven",
      },
    },
  };

  async function getStorage(keys) {
    return new Promise((resolve) =>
      chrome.storage.local.get(keys, (res) => resolve(res || {}))
    );
  }

  async function queryActiveTab() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs && tabs[0] ? tabs[0] : null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  function renderStatus(tab) {
    const dot = document.getElementById("aipv-status-dot");
    const text = document.getElementById("aipv-status-text");
    const url = tab && tab.url ? tab.url : "";
    if (/proxyvote\.com/i.test(url)) {
      dot.classList.remove("aipv-dot-idle");
      dot.classList.add("aipv-dot-active");
      text.textContent = "Active on proxyvote.com";
    } else {
      dot.classList.add("aipv-dot-idle");
      dot.classList.remove("aipv-dot-active");
      text.textContent = "Open a ProxyVote ballot to begin";
    }
  }

  function renderProfile(profile) {
    const summary = document.getElementById("aipv-profile-summary");
    const prefs = document.getElementById("aipv-prefs");
    const btn = document.getElementById("aipv-questionnaire-btn");

    if (!profile || !profile.answers) {
      summary.className = "aipv-profile-empty";
      summary.textContent =
        "Take the 2-minute questionnaire to build your voting profile.";
      prefs.hidden = true;
      btn.textContent = "Start questionnaire";
      return;
    }

    summary.className = "aipv-profile-summary";
    summary.textContent =
      profile.summary || "Your voting profile is saved.";

    prefs.innerHTML = "";
    for (const [key, def] of Object.entries(PREF_LABELS)) {
      const val = profile.answers[key];
      if (!val) continue;
      const label = def.values[val] || val;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="aipv-prefs-key">${def.label}</span>
        <span class="aipv-prefs-val">${label}</span>
      `;
      prefs.appendChild(li);
    }
    prefs.hidden = prefs.children.length === 0;
    btn.textContent = "Retake questionnaire";
  }

  function renderUsage(usage) {
    const count = document.getElementById("aipv-usage-count");
    const fill = document.getElementById("aipv-usage-fill");
    const now = Date.now();
    const entries = Object.values(usage || {});
    const recent = entries.filter(
      (e) => e && typeof e.timestamp === "number" && now - e.timestamp < WEEK_MS
    );
    const n = recent.length;
    count.textContent = `${n} / ${FREE_TIER_LIMIT}`;
    const pct = Math.min(100, (n / FREE_TIER_LIMIT) * 100);
    fill.style.width = `${pct}%`;
  }

  function openQuestionnaire() {
    const url = chrome.runtime.getURL("questionnaire.html");
    chrome.tabs.create({ url });
    window.close();
  }

  function openReport() {
    const url = chrome.runtime.getURL("report.html");
    chrome.tabs.create({ url });
    window.close();
  }

  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    }
    window.close();
  }

  function renderApiStatus(store) {
    const el = document.getElementById("aipv-api-status");
    const parts = [];
    parts.push(
      store.tinyfishApiKey ? "TinyFish ✓" : "TinyFish (not set)"
    );
    parts.push(
      store.deepseekApiKey ? "DeepSeek ✓" : "DeepSeek (not set)"
    );
    el.textContent = parts.join("  ·  ");
  }

  function renderHistory(history) {
    const summary = document.getElementById("aipv-history-summary");
    const ballots = (history && history.ballots) || {};
    const keys = Object.keys(ballots);
    if (keys.length === 0) {
      summary.textContent = "No votes recorded yet.";
      return;
    }
    let overrides = 0;
    let total = 0;
    for (const b of Object.values(ballots)) {
      for (const it of Object.values(b.items || {})) {
        if (!it.ai || !it.user) continue;
        total += 1;
        if (it.user.choice !== it.ai.recommendation) overrides += 1;
      }
    }
    summary.className = "aipv-profile-summary";
    summary.textContent = `${keys.length} ballot${keys.length === 1 ? "" : "s"}, ${total} item${total === 1 ? "" : "s"} voted · ${overrides} override${overrides === 1 ? "" : "s"}.`;
  }

  async function init() {
    document
      .getElementById("aipv-questionnaire-btn")
      .addEventListener("click", openQuestionnaire);
    document
      .getElementById("aipv-report-btn")
      .addEventListener("click", openReport);
    document
      .getElementById("aipv-options-btn")
      .addEventListener("click", openOptions);

    const [tab, store] = await Promise.all([
      queryActiveTab(),
      getStorage([
        "profile",
        "usage",
        "votingHistory",
        "tinyfishApiKey",
        "deepseekApiKey",
      ]),
    ]);
    renderStatus(tab);
    renderProfile(store.profile);
    renderUsage(store.usage);
    renderHistory(store.votingHistory);
    renderApiStatus(store);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
