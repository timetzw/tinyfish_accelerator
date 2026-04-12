(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  AIPV.ballotKey = async function (meta, items) {
    const itemSig = items
      .map((i) => `${i.id}|${(i.title || "").slice(0, 120)}`)
      .sort()
      .join("::");
    const parts = [
      (meta.company || "").trim(),
      (meta.recordDate || "").trim(),
      (meta.meetingName || "").trim(),
      itemSig,
    ];
    const full = await sha256Hex(parts.join("||"));
    return full.slice(0, 16);
  };
})();
