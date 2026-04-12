(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  function escapeAttr(value) {
    try {
      return CSS.escape(value);
    } catch (_) {
      return value.replace(/"/g, "");
    }
  }

  function createBlock(item) {
    const wrap = document.createElement("div");
    wrap.className = "aipv-block aipv-loading row mx-0";
    wrap.dataset.aipvItemId = item.id;
    wrap.innerHTML = `
      <div class="aipv-inner col-12">
        <div class="aipv-badge-row">
          <span class="aipv-label">AI Recommendation</span>
          <span class="aipv-value">Analyzing<span class="aipv-dots">...</span></span>
          <button type="button" class="aipv-toggle" aria-expanded="false" hidden>Why?</button>
        </div>
        <div class="aipv-explain" hidden></div>
      </div>
    `;
    return wrap;
  }

  function injectFor(item) {
    if (!item.rowElement) return null;
    const selector = `.aipv-block[data-aipv-item-id="${escapeAttr(item.id)}"]`;
    const existing = document.querySelector(selector);
    if (existing) return existing;
    const block = createBlock(item);
    item.rowElement.insertAdjacentElement("afterend", block);
    return block;
  }

  function updateBlock(block, decision) {
    if (!block) return;
    const rec = (decision.recommendation || "ABSTAIN").toUpperCase();

    block.classList.remove(
      "aipv-loading",
      "aipv-for",
      "aipv-against",
      "aipv-abstain"
    );
    block.classList.add(`aipv-${rec.toLowerCase()}`);

    const value = block.querySelector(".aipv-value");
    if (value) value.textContent = rec;

    const explain = block.querySelector(".aipv-explain");
    if (explain) explain.textContent = decision.reasoning || "";

    const toggle = block.querySelector(".aipv-toggle");
    if (toggle) {
      toggle.hidden = false;
      toggle.textContent = "Why?";
      toggle.setAttribute("aria-expanded", "false");
      toggle.onclick = () => {
        const isOpen = !explain.hasAttribute("hidden");
        if (isOpen) {
          explain.setAttribute("hidden", "");
          toggle.setAttribute("aria-expanded", "false");
          toggle.textContent = "Why?";
        } else {
          explain.removeAttribute("hidden");
          toggle.setAttribute("aria-expanded", "true");
          toggle.textContent = "Hide";
        }
      };
    }
  }

  function errorBlock(block, message) {
    if (!block) return;
    block.classList.remove("aipv-loading");
    block.classList.add("aipv-error");
    const value = block.querySelector(".aipv-value");
    if (value) value.textContent = "Error";
    const explain = block.querySelector(".aipv-explain");
    if (explain) {
      explain.textContent = message || "Unable to analyze this proposal.";
      explain.removeAttribute("hidden");
    }
  }

  AIPV.injector = { injectFor, updateBlock, errorBlock };
})();
