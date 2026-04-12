(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  // Temporary stub. Replaced next iteration by a call to the backend, which
  // runs the real profile + TinyFish research + LLM agent pipeline.
  // The stub uses naive heuristics just so the end-to-end UI pipeline works.

  function mockDecide(item) {
    const title = (item.title || "").toLowerCase();

    if (item.isSubItem && /election of director/.test(title)) {
      return {
        recommendation: "FOR",
        reasoning:
          "[MOCK] Placeholder FOR on director election. The production agent will research " +
          "this nominee's tenure, committee assignments, other board seats, and past governance " +
          "record, then weight against your stated profile for board independence and diversity.",
      };
    }

    if (/executive compensation|say[- ]on[- ]pay/.test(title)) {
      return {
        recommendation: "AGAINST",
        reasoning:
          "[MOCK] Placeholder AGAINST on executive compensation. The production agent will " +
          "compare CEO pay ratio to sector peers, examine pay-for-performance alignment, and " +
          "check for controversial grants per your compensation-discipline preferences.",
      };
    }

    if (/officer exculpation|limit.*liability/.test(title)) {
      return {
        recommendation: "AGAINST",
        reasoning:
          "[MOCK] Placeholder AGAINST on officer exculpation amendment. These amendments " +
          "typically weaken shareholder recourse against officer misconduct. Production agent " +
          "will reason over your preference for strong accountability.",
      };
    }

    if (/incentive plan|stock purchase|deferral plan/.test(title)) {
      return {
        recommendation: "ABSTAIN",
        reasoning:
          "[MOCK] Placeholder ABSTAIN on incentive/stock plan. Production agent will review " +
          "dilution, burn rate, and performance hurdles before recommending.",
      };
    }

    if (/written consent|special meeting|proxy access/.test(title)) {
      return {
        recommendation: "FOR",
        reasoning:
          "[MOCK] Placeholder FOR on shareholder rights proposal. Production agent will " +
          "weight your preference for robust shareholder voice against the board's stated " +
          "counterarguments.",
      };
    }

    if (/eeo|disclosure|report|climate|lobbying|diversity/.test(title)) {
      return {
        recommendation: "FOR",
        reasoning:
          "[MOCK] Placeholder FOR on disclosure/transparency proposal. Production agent will " +
          "evaluate whether the requested disclosure is material and aligns with your ESG " +
          "preferences.",
      };
    }

    if (/ratif|auditor/.test(title)) {
      return {
        recommendation: "FOR",
        reasoning:
          "[MOCK] Placeholder FOR on auditor ratification. Production agent will check for " +
          "auditor independence concerns, tenure, and any restated filings.",
      };
    }

    return {
      recommendation: item.boardRecommendation || "ABSTAIN",
      reasoning:
        "[MOCK] Mirroring board recommendation (" +
        (item.boardRecommendation || "none") +
        "). Production agent will independently analyze this proposal against your profile.",
    };
  }

  AIPV.mockDecide = mockDecide;
})();
