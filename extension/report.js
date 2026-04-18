(function () {
  const ROOT_KEY = "votingHistory";

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(ROOT_KEY, (res) => {
        const root = (res && res[ROOT_KEY]) || { ballots: {} };
        resolve(root);
      });
    });
  }

  function formatDate(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString();
    } catch (_) {
      return "";
    }
  }

  function colorClass(choice) {
    const c = (choice || "").toUpperCase();
    if (c === "FOR") return "aipv-for";
    if (c === "AGAINST") return "aipv-against";
    if (c === "ABSTAIN") return "aipv-abstain";
    return "aipv-none";
  }

  function overrideCounts(items) {
    let overrides = 0;
    let withReason = 0;
    let follows = 0;
    const arr = Object.values(items || {});
    for (const it of arr) {
      if (!it.user || !it.ai) continue;
      if (it.user.choice !== it.ai.recommendation) {
        overrides += 1;
        if (it.override && (it.override.reason || "").trim()) {
          withReason += 1;
        }
      } else {
        follows += 1;
      }
    }
    return { total: arr.length, overrides, withReason, follows };
  }

  function renderList(root) {
    const listEl = $("aipv-ballot-list");
    const detailEl = $("aipv-ballot-detail");
    const emptyEl = $("aipv-empty");
    const subtitleEl = $("aipv-report-subtitle");
    const statsEl = $("aipv-stats");
    const backBtn = $("aipv-btn-back");
    const csvBtn = $("aipv-btn-csv");
    const exportBtn = $("aipv-btn-export");

    detailEl.innerHTML = "";
    statsEl.hidden = true;
    backBtn.hidden = true;
    csvBtn.hidden = false;
    exportBtn.hidden = false;

    const ballots = Object.values(root.ballots || {}).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    if (ballots.length === 0) {
      emptyEl.hidden = false;
      subtitleEl.textContent = "No ballots yet.";
      return;
    }

    emptyEl.hidden = true;
    subtitleEl.textContent = `${ballots.length} ballot${ballots.length === 1 ? "" : "s"} on record`;

    listEl.innerHTML = ballots
      .map((b) => {
        const counts = overrideCounts(b.items);
        const company = (b.meta && b.meta.company) || "Untitled ballot";
        const meeting = (b.meta && b.meta.meetingName) || "";
        return `
          <div class="aipv-ballot-card">
            <div>
              <h3>${escapeHtml(company)}</h3>
              <div class="aipv-ballot-card-sub">${escapeHtml(meeting)}</div>
              <div class="aipv-ballot-card-stats">
                <span><b>${counts.total}</b> items</span>
                <span><b>${counts.follows}</b> accepted</span>
                <span><b>${counts.overrides}</b> overridden</span>
                <span>${escapeHtml(formatDate(b.updatedAt))}</span>
              </div>
            </div>
            <button class="aipv-btn aipv-btn-primary" data-ballot="${escapeHtml(b.ballotKey)}">
              Open report
            </button>
          </div>
        `;
      })
      .join("");

    for (const btn of listEl.querySelectorAll("button[data-ballot]")) {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-ballot");
        history.pushState({}, "", `?ballotKey=${encodeURIComponent(key)}`);
        route();
      });
    }

    exportBtn.onclick = () => {
      downloadJSON(
        { exportedAt: Date.now(), ballots },
        `aipv-voting-history-${new Date().toISOString().slice(0, 10)}.json`
      );
    };

    csvBtn.onclick = () => {
      const allRows = [];
      for (const b of ballots) {
        for (const r of ballotToCsvRows(b)) allRows.push(r);
      }
      downloadCSV(
        allRows,
        `aipv-voting-history-${new Date().toISOString().slice(0, 10)}.csv`
      );
    };
  }

  function renderDetail(root, ballotKey) {
    const listEl = $("aipv-ballot-list");
    const detailEl = $("aipv-ballot-detail");
    const emptyEl = $("aipv-empty");
    const subtitleEl = $("aipv-report-subtitle");
    const statsEl = $("aipv-stats");
    const backBtn = $("aipv-btn-back");
    const csvBtn = $("aipv-btn-csv");
    const exportBtn = $("aipv-btn-export");

    listEl.innerHTML = "";
    emptyEl.hidden = true;
    backBtn.hidden = false;
    csvBtn.hidden = false;
    exportBtn.hidden = false;

    const ballot = (root.ballots || {})[ballotKey];
    if (!ballot) {
      subtitleEl.textContent = "Ballot not found.";
      statsEl.hidden = true;
      detailEl.innerHTML = `
        <div class="aipv-ballot-header">
          <p>We couldn't find history for ballot <code>${escapeHtml(ballotKey)}</code>.</p>
        </div>
      `;
      return;
    }

    const counts = overrideCounts(ballot.items);
    $("aipv-stat-items").textContent = counts.total;
    $("aipv-stat-follows").textContent = counts.follows;
    $("aipv-stat-overrides").textContent = counts.overrides;
    $("aipv-stat-overrides-with-reason").textContent = counts.withReason;
    statsEl.hidden = false;

    const company = (ballot.meta && ballot.meta.company) || "Untitled ballot";
    const meeting = (ballot.meta && ballot.meta.meetingName) || "";
    const recordDate = (ballot.meta && ballot.meta.recordDate) || "";
    subtitleEl.textContent = `${company}${meeting ? " — " + meeting : ""}`;

    const itemsArr = Object.values(ballot.items || {}).sort((a, b) => {
      // sort by id, numeric then lexicographic
      const na = parseInt(a.id, 10);
      const nb = parseInt(b.id, 10);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });

    const itemCardsHtml = itemsArr
      .map((it) => {
        const ai = it.ai || {};
        const user = it.user || {};
        const override = it.override;
        const userFinal = user.choice || "";
        return `
          <div class="aipv-item-card">
            <div class="aipv-item-top">
              <div>
                <h3 class="aipv-item-title">
                  <span class="aipv-item-num">#${escapeHtml(it.id)}</span>
                  ${escapeHtml(it.title || "")}
                </h3>
              </div>
            </div>

            <div class="aipv-choices">
              <div class="aipv-choice">
                <div class="aipv-choice-label">Board Recommendation</div>
                <div class="aipv-choice-value ${colorClass(it.boardRecommendation)}">
                  ${escapeHtml(it.boardRecommendation || "—")}
                </div>
              </div>
              <div class="aipv-choice">
                <div class="aipv-choice-label">AI Recommendation</div>
                <div class="aipv-choice-value ${colorClass(ai.recommendation)}">
                  ${escapeHtml(ai.recommendation || "—")}
                </div>
              </div>
              <div class="aipv-choice">
                <div class="aipv-choice-label">Your Final Vote</div>
                <div class="aipv-choice-value ${colorClass(userFinal)}">
                  ${escapeHtml(userFinal || "—")}
                </div>
              </div>
            </div>

            <div class="aipv-reasoning">
              <div class="aipv-reasoning-label">Consul.AI chain of reasoning</div>
              ${escapeHtml(ai.reasoning || "(no reasoning recorded)")}
              ${
                Array.isArray(ai.sources) && ai.sources.length
                  ? `<div class="aipv-explain-sources" style="margin-top:10px;">
                      <b>Sources consulted:</b>
                      <ul>${ai.sources
                        .map((s) => {
                          const safe = escapeHtml(s);
                          return /^https?:\/\//i.test(s)
                            ? `<li><a href="${safe}" target="_blank" rel="noopener">${safe}</a></li>`
                            : `<li>${safe}</li>`;
                        })
                        .join("")}</ul>
                    </div>`
                  : ""
              }
            </div>

            ${
              override
                ? `
              <div class="aipv-override-block">
                <div class="aipv-reasoning-label">User override</div>
                <div>
                  <span class="${colorClass(override.from)}">${escapeHtml(override.from)}</span>
                  <span class="aipv-override-arrow">→</span>
                  <span class="${colorClass(override.to)}">${escapeHtml(override.to)}</span>
                </div>
                <div style="margin-top:6px;">
                  ${
                    override.reason
                      ? escapeHtml(override.reason)
                      : `<i>No reason provided by user.</i>`
                  }
                </div>
              </div>
            `
                : ""
            }
          </div>
        `;
      })
      .join("");

    detailEl.innerHTML = `
      <div class="aipv-ballot-header">
        <h2>${escapeHtml(company)}</h2>
        <div class="aipv-ballot-meta">
          ${escapeHtml(meeting)}${meeting && recordDate ? " · " : ""}${escapeHtml(recordDate)}
          · Last updated ${escapeHtml(formatDate(ballot.updatedAt))}
        </div>
      </div>
      ${itemCardsHtml || '<p class="aipv-empty">No items recorded for this ballot.</p>'}
    `;

    backBtn.onclick = () => {
      history.pushState({}, "", location.pathname);
      route();
    };
    csvBtn.onclick = () =>
      downloadCSV(
        ballotToCsvRows(ballot),
        `aipv-report-${companySlug(ballot)}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`
      );
    exportBtn.onclick = () =>
      downloadJSON(
        ballot,
        `aipv-report-${companySlug(ballot)}-${new Date()
          .toISOString()
          .slice(0, 10)}.json`
      );
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, filename);
  }

  const CSV_COLUMNS = [
    "Ballot Key",
    "Company",
    "Meeting",
    "Record Date",
    "Item #",
    "Title",
    "Board Recommendation",
    "AI Recommendation",
    "AI Reasoning",
    "User Final Vote",
    "Overridden",
    "Override From",
    "Override To",
    "Override Reason",
    "AI Decided At",
    "User Recorded At",
  ];

  function csvEscape(val) {
    if (val == null) return "";
    const s = String(val);
    // Wrap in quotes if it contains delimiters, newlines, or quotes.
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function ballotToCsvRows(ballot) {
    const rows = [];
    const meta = ballot.meta || {};
    const items = Object.values(ballot.items || {}).sort((a, b) => {
      const na = parseInt(a.id, 10);
      const nb = parseInt(b.id, 10);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
    for (const it of items) {
      const ai = it.ai || {};
      const user = it.user || {};
      const override = it.override || null;
      const overridden = override ? "Yes" : "No";
      rows.push([
        ballot.ballotKey || "",
        meta.company || "",
        meta.meetingName || "",
        meta.recordDate || "",
        it.id || "",
        it.title || "",
        it.boardRecommendation || "",
        ai.recommendation || "",
        ai.reasoning || "",
        user.choice || "",
        overridden,
        override ? override.from : "",
        override ? override.to : "",
        override ? override.reason : "",
        ai.decidedAt ? new Date(ai.decidedAt).toISOString() : "",
        user.recordedAt ? new Date(user.recordedAt).toISOString() : "",
      ]);
    }
    return rows;
  }

  function toCsv(rows) {
    const lines = [CSV_COLUMNS.join(",")];
    for (const row of rows) {
      lines.push(row.map(csvEscape).join(","));
    }
    return lines.join("\r\n");
  }

  function downloadCSV(rows, filename) {
    // UTF-8 BOM so Excel opens it with correct encoding.
    const blob = new Blob(["\uFEFF" + toCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    triggerDownload(blob, filename);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function companySlug(ballot) {
    const name = (ballot.meta && ballot.meta.company) || "ballot";
    return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }

  async function route() {
    const params = new URLSearchParams(location.search);
    const key = params.get("ballotKey");
    const root = await load();
    if (key) {
      renderDetail(root, key);
    } else {
      renderList(root);
    }
  }

  window.addEventListener("popstate", route);
  document.addEventListener("DOMContentLoaded", route);
})();
