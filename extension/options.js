(function () {
  const FIELDS = [
    { id: "aipv-tinyfish-key", key: "tinyfishApiKey" },
    { id: "aipv-deepseek-key", key: "deepseekApiKey" },
    { id: "aipv-deepseek-base", key: "deepseekBaseUrl", default: "https://api.deepseek.com" },
    { id: "aipv-deepseek-model", key: "deepseekModel", default: "deepseek-reasoner" },
    { id: "aipv-secapi-key", key: "secApiKey" },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, cls) {
    const el = $("aipv-options-status");
    el.textContent = msg;
    el.className = "aipv-options-status" + (cls ? " " + cls : "");
  }

  async function load() {
    const keys = FIELDS.map((f) => f.key).concat(["aggressiveResearch"]);
    const res = await new Promise((r) => chrome.storage.local.get(keys, r));
    for (const f of FIELDS) {
      $(f.id).value = res[f.key] || f.default || "";
    }
    $("aipv-aggressive").checked = !!res.aggressiveResearch;
  }

  async function save() {
    const payload = {};
    for (const f of FIELDS) {
      payload[f.key] = $(f.id).value.trim();
    }
    payload.aggressiveResearch = $("aipv-aggressive").checked;
    await new Promise((r) => chrome.storage.local.set(payload, r));
    setStatus("Saved.", "aipv-ok");
  }

  async function testConnection() {
    setStatus("Testing…", "aipv-working");
    await save();
    try {
      const reply = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "ping" }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      });
      if (!reply || !reply.ok) throw new Error("No response from background");

      const results = reply.results || {};
      const lines = [];
      lines.push(
        results.tinyfish
          ? `TinyFish: ${results.tinyfish.ok ? "OK" : "FAIL — " + results.tinyfish.error}`
          : "TinyFish: not tested"
      );
      lines.push(
        results.deepseek
          ? `DeepSeek: ${results.deepseek.ok ? "OK" : "FAIL — " + results.deepseek.error}`
          : "DeepSeek: not tested"
      );
      const allOk =
        (!results.tinyfish || results.tinyfish.ok) &&
        (!results.deepseek || results.deepseek.ok);
      setStatus(lines.join("  ·  "), allOk ? "aipv-ok" : "aipv-err");
    } catch (err) {
      setStatus("Connection test failed: " + (err.message || err), "aipv-err");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    $("aipv-save").addEventListener("click", save);
    $("aipv-test").addEventListener("click", testConnection);
  });
})();
