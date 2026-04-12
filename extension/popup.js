(function () {
  const FREE_TIER_LIMIT = 3;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const PREF_LABELS = {
    role: {
      label: "Role",
      values: {
        individual: "Individual",
        advisor: "Financial advisor",
        fund: "Fund manager",
      },
    },
    horizon: {
      label: "Horizon",
      values: {
        short: "Short-term",
        medium: "Medium-term",
        long: "Long-term",
      },
    },
    esg: {
      label: "ESG",
      values: { low: "Low", medium: "Medium", high: "High" },
    },
    governance: {
      label: "Governance",
      values: { lenient: "Lenient", moderate: "Moderate", strict: "Strict" },
    },
    execPay: {
      label: "Exec pay",
      values: {
        usually: "Supportive",
        tied: "Performance-tied",
        rarely: "Strict",
      },
    },
    shareholderRights: {
      label: "Shareholder rights",
      values: {
        against: "Cautious",
        case: "Case-by-case",
        for: "Supportive",
      },
    },
    climate: {
      label: "Climate disclosure",
      values: {
        optional: "Optional",
        supportive: "Supportive",
        mandatory: "Mandatory",
      },
    },
    bias: {
      label: "Default bias",
      values: {
        board: "With the board",
        independent: "Independent",
        protective: "Shareholder-protective",
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

  async function init() {
    document
      .getElementById("aipv-questionnaire-btn")
      .addEventListener("click", openQuestionnaire);

    const [tab, store] = await Promise.all([
      queryActiveTab(),
      getStorage(["profile", "usage"]),
    ]);
    renderStatus(tab);
    renderProfile(store.profile);
    renderUsage(store.usage);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
