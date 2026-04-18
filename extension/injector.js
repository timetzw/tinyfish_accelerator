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
          <span class="aipv-label">Consul.AI Recommendation</span>
          <span class="aipv-value">Researching</span>
          <button type="button" class="aipv-toggle" aria-expanded="false" hidden>Why?</button>
        </div>
        <div class="aipv-progress-wrap">
          <div class="aipv-progress">
            <div class="aipv-progress-bar" style="width: 0%"></div>
          </div>
          <div class="aipv-progress-meta">
            <span class="aipv-progress-label">Consul.AI · planning research</span>
            <span class="aipv-progress-pct">0%</span>
          </div>
        </div>
        <div class="aipv-explain" hidden></div>
        <div class="aipv-override" hidden></div>
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

    // Hide the progress bar now that we have a decision.
    const progressWrap = block.querySelector(".aipv-progress-wrap");
    if (progressWrap) progressWrap.hidden = true;

    const value = block.querySelector(".aipv-value");
    if (value) value.textContent = rec;

    const explain = block.querySelector(".aipv-explain");
    if (explain) {
      const reasoning = decision.reasoning || "";
      const sources = Array.isArray(decision.sources)
        ? decision.sources.filter(Boolean)
        : [];
      let html = `<div class="aipv-explain-reasoning">${escapeHtml(reasoning)}</div>`;
      if (sources.length) {
        const items = sources
          .map((s) => {
            const safe = escapeHtml(s);
            return /^https?:\/\//i.test(s)
              ? `<li><a href="${safe}" target="_blank" rel="noopener">${safe}</a></li>`
              : `<li>${safe}</li>`;
          })
          .join("");
        html += `<div class="aipv-explain-sources"><b>Sources consulted:</b><ul>${items}</ul></div>`;
      }
      explain.innerHTML = html;
    }

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

  // Called when the user picks an option. If the pick matches the AI, we just
  // render a subtle confirmation. If it differs, we prompt for a reason and
  // invoke `onSave(reason)` / `onSkip()` when the user decides.
  function showUserChoice(block, info, handlers) {
    if (!block) return;
    const overrideBox = block.querySelector(".aipv-override");
    if (!overrideBox) return;

    const { userChoice, aiRecommendation, overridden } = info;

    if (!overridden) {
      overrideBox.hidden = false;
      overrideBox.className = "aipv-override aipv-override-confirm";
      overrideBox.innerHTML = `
        <span class="aipv-override-tag">✓ You confirmed the AI's recommendation
        (${escapeHtml(userChoice)}).</span>
      `;
      return;
    }

    overrideBox.hidden = false;
    overrideBox.className = "aipv-override aipv-override-prompt";
    overrideBox.innerHTML = `
      <div class="aipv-override-head">
        You changed <strong>${escapeHtml(aiRecommendation || "—")}</strong>
        → <strong>${escapeHtml(userChoice)}</strong>.
        Tell us why so we can learn your preferences.
      </div>
      <textarea class="aipv-override-reason"
        placeholder="Optional — short reasoning (e.g., 'CEO pay ratio too high vs. peers')"
        rows="2"></textarea>
      <div class="aipv-override-actions">
        <button type="button" class="aipv-override-save">Save reason</button>
        <button type="button" class="aipv-override-skip">Skip</button>
      </div>
    `;

    const textarea = overrideBox.querySelector(".aipv-override-reason");
    const saveBtn = overrideBox.querySelector(".aipv-override-save");
    const skipBtn = overrideBox.querySelector(".aipv-override-skip");

    saveBtn.onclick = () => {
      const reason = textarea.value.trim();
      renderOverrideSaved(overrideBox, {
        aiRecommendation,
        userChoice,
        reason,
      });
      if (handlers && handlers.onSave) handlers.onSave(reason);
    };
    skipBtn.onclick = () => {
      renderOverrideSaved(overrideBox, {
        aiRecommendation,
        userChoice,
        reason: "",
      });
      if (handlers && handlers.onSkip) handlers.onSkip();
    };
  }

  function renderOverrideSaved(overrideBox, { aiRecommendation, userChoice, reason }) {
    overrideBox.className = "aipv-override aipv-override-saved";
    overrideBox.innerHTML = `
      <div class="aipv-override-head">
        Override recorded: <strong>${escapeHtml(aiRecommendation || "—")}</strong>
        → <strong>${escapeHtml(userChoice)}</strong>
      </div>
      ${
        reason
          ? `<div class="aipv-override-reason-final">${escapeHtml(reason)}</div>`
          : `<div class="aipv-override-reason-final aipv-muted">(no reason provided)</div>`
      }
      <button type="button" class="aipv-override-edit">Edit reason</button>
    `;
    const editBtn = overrideBox.querySelector(".aipv-override-edit");
    editBtn.onclick = () => {
      overrideBox.className = "aipv-override aipv-override-prompt";
      overrideBox.innerHTML = `
        <div class="aipv-override-head">
          Editing override reason (${escapeHtml(aiRecommendation || "—")} →
          <strong>${escapeHtml(userChoice)}</strong>).
        </div>
        <textarea class="aipv-override-reason" rows="2">${escapeHtml(reason)}</textarea>
        <div class="aipv-override-actions">
          <button type="button" class="aipv-override-save">Save reason</button>
        </div>
      `;
      const ta = overrideBox.querySelector(".aipv-override-reason");
      const sb = overrideBox.querySelector(".aipv-override-save");
      sb.onclick = () => {
        const newReason = ta.value.trim();
        renderOverrideSaved(overrideBox, {
          aiRecommendation,
          userChoice,
          reason: newReason,
        });
        // bubble up via a custom event; history.js is wired in content.js
        overrideBox.dispatchEvent(
          new CustomEvent("aipv:override-edited", {
            bubbles: true,
            detail: { reason: newReason },
          })
        );
      };
    };
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Accepts {pct, label, phase, event} from the background port. pct is
  // authoritative — it only moves monotonically upward as phases complete.
  function setProgress(block, evt) {
    if (!block) return;
    const wrap = block.querySelector(".aipv-progress-wrap");
    const bar = block.querySelector(".aipv-progress-bar");
    const label = block.querySelector(".aipv-progress-label");
    const pctEl = block.querySelector(".aipv-progress-pct");
    if (!wrap || !bar) return;
    wrap.hidden = false;

    const pct = Math.max(0, Math.min(100, Number(evt.pct) || 0));
    const current = parseFloat(bar.style.width) || 0;
    // Enforce monotonicity so the bar doesn't jump backward if an out-of-
    // order message arrives (e.g., `start` after `done`).
    const next = Math.max(current, pct);
    bar.style.width = `${next}%`;
    if (pctEl) pctEl.textContent = `${Math.round(next)}%`;
    if (label && evt.label) label.textContent = evt.label;
  }

  function errorBlockProgressHide(block) {
    const wrap = block && block.querySelector(".aipv-progress-wrap");
    if (wrap) wrap.hidden = true;
  }

  AIPV.injector = {
    injectFor,
    updateBlock,
    errorBlock: (block, msg) => {
      errorBlockProgressHide(block);
      return errorBlock(block, msg);
    },
    showUserChoice,
    setProgress,
  };
})();
