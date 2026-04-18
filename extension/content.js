(function () {
  const TAG = "[AIPV]";
  const AIPV = (window.AIPV = window.AIPV || {});

  if (!/proxyvote\.com$/i.test(location.hostname)) return;
  console.log(TAG, "content script active on", location.href);

  let processed = false;
  let currentBallotKey = null;

  function openReport() {
    const base = chrome.runtime.getURL("report.html");
    const url = currentBallotKey ? `${base}?ballotKey=${currentBallotKey}` : base;
    window.open(url, "_blank");
  }

  function ensureReportFab() {
    if (document.querySelector(".aipv-report-fab")) return;
    const btn = document.createElement("button");
    btn.className = "aipv-report-fab";
    btn.type = "button";
    btn.innerHTML = `Consul.AI · View voting report <span class="aipv-report-fab-count" id="aipv-fab-count">0</span>`;
    btn.addEventListener("click", () => {
      const url = `${chrome.runtime.getURL("report.html")}?ballotKey=${currentBallotKey || ""}`;
      window.open(url, "_blank");
    });
    document.body.appendChild(btn);
  }

  function updateFabCount(overridesRecorded) {
    const el = document.getElementById("aipv-fab-count");
    if (el) el.textContent = String(overridesRecorded);
  }

  function serializeItem(item, pageUrl) {
    let detail = null;
    if (item.moreDetailsUrl) {
      try {
        const resolved = new URL(item.moreDetailsUrl, pageUrl).toString();
        // Skip in-page anchors and javascript: handlers — TinyFish can't
        // navigate those. Fall back to the ballot page URL in background.
        if (!/^(javascript:|#)/i.test(resolved)) detail = resolved;
      } catch (_) {}
    }
    return {
      id: item.id,
      title: item.title,
      isSubItem: item.isSubItem,
      groupId: item.groupId,
      boardRecommendation: item.boardRecommendation,
      moreDetailsUrl: detail,
      pageUrl,
    };
  }

  function singleDecideAttempt(payload, onProgress) {
    return new Promise((resolve) => {
      let port;
      try {
        port = chrome.runtime.connect({ name: "decide" });
      } catch (err) {
        resolve({ ok: false, error: String(err) });
        return;
      }

      let finished = false;
      let sawProgress = false;
      const finish = (res) => {
        if (finished) return;
        finished = true;
        try {
          port.disconnect();
        } catch (_) {}
        resolve(res);
      };

      port.onMessage.addListener((msg) => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "progress") {
          sawProgress = true;
          try {
            onProgress(msg);
          } catch (_) {}
        } else if (msg.type === "result") {
          finish(msg);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!finished) {
          const err = chrome.runtime.lastError;
          finish({
            ok: false,
            error: err ? err.message : "port disconnected",
            sawProgress,
          });
        }
      });

      try {
        port.postMessage({ type: "decide", payload });
      } catch (err) {
        finish({ ok: false, error: String(err) });
      }
    });
  }

  async function requestDecideStreaming(payload, onProgress) {
    // First attempt.
    let res = await singleDecideAttempt(payload, onProgress);
    // If the port closed before any progress, the service worker likely
    // hadn't woken up in time. Retry once, which re-wakes the SW cleanly.
    if (
      !res.ok &&
      /port disconnected|port closed|no response/i.test(res.error || "") &&
      !res.sawProgress
    ) {
      console.warn(TAG, "port closed before progress; retrying decide once");
      res = await singleDecideAttempt(payload, onProgress);
    }
    return res;
  }

  async function decideItem(item, meta, ballotKey, block) {
    AIPV.injector.setProgress(block, {
      pct: 0,
      label: "Consul.AI · planning research",
    });
    const serialized = serializeItem(item, location.href);
    console.log(
      TAG,
      `decide ${serialized.id} "${serialized.title}"`,
      `detailUrl=${serialized.moreDetailsUrl || "(none → TinyFish will navigate from ballot page)"}`
    );
    const payload = {
      item: serialized,
      meta,
      ballotKey,
    };

    const res = await requestDecideStreaming(payload, (evt) => {
      AIPV.injector.setProgress(block, evt);
    });

    if (!res.ok) {
      if (res.error === "missing-keys") {
        const fallback = AIPV.mockDecide(item);
        fallback.reasoning =
          "⚠ API keys not configured — showing heuristic placeholder. " +
          "Open extension options to connect TinyFish + DeepSeek.\n\n" +
          fallback.reasoning;
        return fallback;
      }
      throw new Error(res.error || "decide failed");
    }
    return res.decision;
  }

  async function processBallot() {
    if (processed) return;
    if (!AIPV.adapter.isBallotPage()) return;

    const items = AIPV.adapter.extractItems();
    if (items.length === 0) return;

    processed = true;

    const meta = AIPV.adapter.extractMeta();
    const ballotKey = await AIPV.ballotKey(meta, items);
    currentBallotKey = ballotKey;

    console.log(TAG, `ballot detected: ${items.length} items, key=${ballotKey}`);

    await AIPV.history.upsertBallot(ballotKey, meta, location.href);

    try {
      chrome.runtime
        .sendMessage({
          type: "ballot-detected",
          payload: {
            ballotKey,
            url: location.href,
            meta,
            itemCount: items.length,
          },
        })
        .catch(() => {});
    } catch (_) {}

    try {
      chrome.storage.local.get("usage", (res) => {
        const usage = (res && res.usage) || {};
        usage[ballotKey] = {
          ballotKey,
          company: meta.company || null,
          meetingName: meta.meetingName || null,
          url: location.href,
          timestamp: Date.now(),
        };
        chrome.storage.local.set({ usage });
      });
    } catch (_) {}

    ensureReportFab();

    const blocks = new Map();
    for (const item of items) {
      blocks.set(item.id, AIPV.injector.injectFor(item));
    }

    let overridesRecorded = 0;

    // Stagger a bit so we don't fire all TinyFish calls at the exact same
    // instant. Deepseek / TinyFish rate limits may otherwise reject bursts.
    items.forEach((item, idx) => {
      const kickoffDelay = 200 + idx * 300;
      setTimeout(async () => {
        const block = blocks.get(item.id);
        try {
          const decision = await decideItem(item, meta, ballotKey, block);
          AIPV.injector.updateBlock(block, decision);

          const aiPick = (decision.recommendation || "ABSTAIN").toUpperCase();
          await AIPV.history.recordAI(ballotKey, item, decision);

          const radio = item.radios[aiPick];
          if (radio) AIPV.fillRadio(radio);

          await AIPV.history.recordUserChoice(ballotKey, item.id, aiPick, "");

          AIPV.attachUserChoiceListener(item, aiPick, async (info) => {
            const b = blocks.get(item.id);
            await AIPV.history.recordUserChoice(
              ballotKey,
              item.id,
              info.userChoice,
              ""
            );

            AIPV.injector.showUserChoice(b, info, {
              onSave: async (reason) => {
                await AIPV.history.recordUserChoice(
                  ballotKey,
                  item.id,
                  info.userChoice,
                  reason
                );
                if (info.overridden) {
                  overridesRecorded += 1;
                  updateFabCount(overridesRecorded);
                }
              },
              onSkip: async () => {
                if (info.overridden) {
                  overridesRecorded += 1;
                  updateFabCount(overridesRecorded);
                }
              },
            });

            if (b && !b._aipvEditBound) {
              b._aipvEditBound = true;
              b.addEventListener("aipv:override-edited", async (ev) => {
                await AIPV.history.recordUserChoice(
                  ballotKey,
                  item.id,
                  info.userChoice,
                  (ev.detail && ev.detail.reason) || ""
                );
              });
            }
          });
        } catch (err) {
          console.error(TAG, "decision error for", item.id, err);
          AIPV.injector.errorBlock(block, err.message || String(err));
        }
      }, kickoffDelay);
    });
  }

  let tries = 0;
  const maxTries = 40;
  const interval = setInterval(() => {
    tries++;
    processBallot();
    if (processed || tries >= maxTries) clearInterval(interval);
  }, 400);

  window.__AIPV__ = {
    rerun: () => {
      processed = false;
      document.querySelectorAll(".aipv-block").forEach((b) => b.remove());
      document.querySelectorAll(".aipv-report-fab").forEach((b) => b.remove());
      processBallot();
    },
    adapter: () => AIPV.adapter.extractItems(),
    meta: () => AIPV.adapter.extractMeta(),
    openReport,
    currentBallotKey: () => currentBallotKey,
  };
})();
