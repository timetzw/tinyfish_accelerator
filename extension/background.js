const TAG = "[AIPV bg]";

chrome.runtime.onInstalled.addListener((details) => {
  console.log(TAG, "installed", details.reason);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "recon") {
    const tabId = sender.tab && sender.tab.id;
    const { itemCount, meta, url } = msg.payload || {};
    console.log(TAG, `recon from tab ${tabId}: ${itemCount} items on ${url}`, meta);
    console.log(TAG, "full payload", msg.payload);
  }
  sendResponse({ ok: true });
  return false;
});
