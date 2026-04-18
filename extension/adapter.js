(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  const BOARD_REC_CODE_TO_NAME = { F: "FOR", N: "AGAINST", A: "ABSTAIN" };
  const VOTE_CLASS_TO_NAME = {
    PV30_AGN_VOTE_OPT_F: "FOR",
    PV30_AGN_VOTE_OPT_N: "AGAINST",
    PV30_AGN_VOTE_OPT_A: "ABSTAIN",
  };

  function isBallotPage() {
    return !!document.querySelector("div.singleProposalRow");
  }

  function extractProposalId(row) {
    const numberEl = row.querySelector("span.number");
    if (!numberEl) return null;
    const raw = (numberEl.textContent || "").trim();
    const m = raw.match(/(\d+[a-z]?)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function extractTitle(row) {
    const p = row.querySelector("p");
    if (!p) return "";
    const clone = p.cloneNode(true);
    clone.querySelectorAll("a.proposal-link").forEach((a) => a.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractBoardRecommendation(row) {
    const hidden = row.querySelector("input.prop_board_recommendation");
    if (hidden && hidden.value) {
      return BOARD_REC_CODE_TO_NAME[hidden.value.trim().toUpperCase()] || null;
    }
    return null;
  }

  function extractRadios(row) {
    const out = {};
    for (const radio of row.querySelectorAll('input[type="radio"]')) {
      for (const cls of radio.classList) {
        const name = VOTE_CLASS_TO_NAME[cls];
        if (name) {
          out[name] = radio;
          break;
        }
      }
    }
    if (out.FOR && out.AGAINST && out.ABSTAIN) return out;
    return null;
  }

  function isUsableHref(href) {
    if (!href) return false;
    const s = String(href).trim();
    if (!s) return false;
    if (/^javascript:/i.test(s)) return false;
    if (s === "#" || s.startsWith("#")) return false;
    return true;
  }

  // Find the "More Details" / "More Information" / bio link for a proposal
  // row. ProxyVote historically uses <a class="proposal-link">, but newer
  // renderings label it plain "More Details" and drop the class — so match
  // by class, by href hint, or by anchor text as a last resort.
  function extractMoreDetailsUrl(row) {
    const candidates = Array.from(row.querySelectorAll("a"));

    // 1. Explicit class.
    const byClass = candidates.find(
      (a) => a.classList.contains("proposal-link") && isUsableHref(a.getAttribute("href"))
    );
    if (byClass) return byClass.getAttribute("href");

    // 2. href hint (ProposalDetail / ProposalInformation endpoints).
    const byHref = candidates.find((a) => {
      const h = a.getAttribute("href") || "";
      return /proposal(detail|info|information)/i.test(h) && isUsableHref(h);
    });
    if (byHref) return byHref.getAttribute("href");

    // 3. Anchor text.
    const labelRe = /more\s*(details|information|info)|view\s*bio|director\s*bio/i;
    const byText = candidates.find((a) => {
      const text = (a.textContent || "").trim();
      return labelRe.test(text) && isUsableHref(a.getAttribute("href"));
    });
    if (byText) return byText.getAttribute("href");

    // 4. Any anchor in the row that looks navigable (last resort — useful
    // when the link text is rendered via CSS ::after or an icon).
    const anyNav = candidates.find((a) =>
      isUsableHref(a.getAttribute("href"))
    );
    return anyNav ? anyNav.getAttribute("href") : null;
  }

  function extractContentColumn(row) {
    return (
      row.querySelector(".col-legend .d-flex.flex-column") ||
      row.querySelector(".col-legend")
    );
  }

  function extractItems() {
    const rows = Array.from(document.querySelectorAll("div.singleProposalRow"));
    const items = [];

    for (const row of rows) {
      const id = extractProposalId(row);
      if (!id) continue;

      const radios = extractRadios(row);
      if (!radios) continue;

      const title = extractTitle(row);
      if (!title) continue;

      const groupMatch = id.match(/^(\d+)/);
      const groupId = groupMatch ? groupMatch[1] : id;
      const isSubItem = /^\d+[a-z]$/.test(id);

      items.push({
        id,
        groupId,
        isSubItem,
        title,
        boardRecommendation: extractBoardRecommendation(row),
        moreDetailsUrl: extractMoreDetailsUrl(row),
        radios,
        rowElement: row,
        contentColumn: extractContentColumn(row),
      });
    }

    return items;
  }

  function extractTicker(bodyText) {
    if (!bodyText) return null;
    const patterns = [
      /\((?:NASDAQ|NYSE|NYSE\s*American|AMEX|CBOE)\s*[:\-]\s*([A-Z][A-Z0-9.\-]{0,5})\)/i,
      /ticker\s+symbol\s*[:"'\u201c]?\s*([A-Z][A-Z0-9.\-]{0,5})\b/i,
      /under\s+the\s+symbol\s*["\u201c]?([A-Z][A-Z0-9.\-]{0,5})["\u201d]?/i,
      /virtualshareholdermeeting\.com\/([A-Z]{1,6})\d{2,4}/i,
    ];
    for (const re of patterns) {
      const m = bodyText.match(re);
      if (m && m[1]) return m[1].toUpperCase();
    }
    return null;
  }

  function extractMeta() {
    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4")
    )
      .map((h) => (h.innerText || h.textContent || "").trim())
      .filter(Boolean);

    let company = null;
    for (const h of headings) {
      const lc = h.toLowerCase();
      if (
        /fidelity|schwab|vanguard|merrill|etrade/.test(lc) ||
        /meeting|proposal|document|information|thank you|investments/.test(lc)
      ) {
        continue;
      }
      if (h.length > 1 && h.length < 80) {
        company = h;
        break;
      }
    }

    const meetingName =
      headings.find((h) => /annual meeting|special meeting/i.test(h)) || null;

    const bodyText = (document.body && document.body.innerText) || "";
    const dateMatch = bodyText.match(/holders?\s+as\s+of\s+([^\.\n]{5,80})/i);
    const sharesMatch = bodyText.match(/Shares\s+available[:\s]*([\d,\.]+)/i);
    const ticker = extractTicker(bodyText);

    return {
      company,
      meetingName,
      recordDate: dateMatch ? dateMatch[1].trim() : null,
      sharesAvailable: sharesMatch ? sharesMatch[1] : null,
      ticker,
    };
  }

  AIPV.adapter = {
    isBallotPage,
    extractItems,
    extractMeta,
  };
})();
