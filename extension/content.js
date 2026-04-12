(function () {
  const TAG = "[AIPV]";
  const AIPV = (window.AIPV = window.AIPV || {});

  if (!/proxyvote\.com$/i.test(location.hostname)) return;
  console.log(TAG, "content script active on", location.href);

  let processed = false;

  async function processBallot() {
    if (processed) return;
    if (!AIPV.adapter.isBallotPage()) return;

    const items = AIPV.adapter.extractItems();
    if (items.length === 0) return;

    processed = true;

    const meta = AIPV.adapter.extractMeta();
    const ballotKey = await AIPV.ballotKey(meta, items);

    console.log(TAG, `ballot detected: ${items.length} items, key=${ballotKey}`);
    console.log(TAG, "meta", meta);

    // Announce to background worker (future: queues TinyFish research jobs)
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

    // Track usage for the free-tier counter (deduped by ballotKey)
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

    // Inject skeleton blocks first so the user sees loading state immediately
    const blocks = new Map();
    for (const item of items) {
      blocks.set(item.id, AIPV.injector.injectFor(item));
    }

    // Stagger mock decisions to simulate per-item processing.
    // Real version: background worker streams decisions back via runtime.onMessage.
    for (const item of items) {
      const delay = 400 + Math.random() * 1600;
      setTimeout(() => {
        try {
          const decision = AIPV.mockDecide(item);
          AIPV.injector.updateBlock(blocks.get(item.id), decision);
          const radio = item.radios[decision.recommendation];
          if (radio) AIPV.fillRadio(radio);
        } catch (err) {
          console.error(TAG, "decision error for", item.id, err);
          AIPV.injector.errorBlock(blocks.get(item.id), String(err));
        }
      }, delay);
    }
  }

  // ProxyVote hydrates the ballot list after initial DOM. Poll briefly
  // until we see rows, then stop.
  let tries = 0;
  const maxTries = 40;
  const interval = setInterval(() => {
    tries++;
    processBallot();
    if (processed || tries >= maxTries) clearInterval(interval);
  }, 400);

  // Debug hooks
  window.__AIPV__ = {
    rerun: () => {
      processed = false;
      document.querySelectorAll(".aipv-block").forEach((b) => b.remove());
      processBallot();
    },
    adapter: () => AIPV.adapter.extractItems(),
    meta: () => AIPV.adapter.extractMeta(),
  };
})();
