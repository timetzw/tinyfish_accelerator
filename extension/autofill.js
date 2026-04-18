(function () {
  const AIPV = (window.AIPV = window.AIPV || {});

  function setCheckedNative(radio) {
    const proto = Object.getPrototypeOf(radio);
    const desc = Object.getOwnPropertyDescriptor(proto, "checked");
    if (desc && desc.set) {
      desc.set.call(radio, true);
    } else {
      radio.checked = true;
    }
  }

  function labelFor(radio) {
    if (!radio.id) return null;
    try {
      return document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
    } catch (_) {
      return null;
    }
  }

  function clearGroupMarkers(radio) {
    if (!radio.name) return;
    let group;
    try {
      group = document.querySelectorAll(
        `input[name="${CSS.escape(radio.name)}"]`
      );
    } catch (_) {
      return;
    }
    group.forEach((r) => {
      const lbl = labelFor(r);
      if (lbl) lbl.querySelectorAll(".aipv-marker").forEach((m) => m.remove());
      delete r.dataset.aipvFilled;
    });
  }

  function addMarker(radio) {
    const lbl = labelFor(radio);
    if (!lbl) return;
    const marker = document.createElement("span");
    marker.className = "aipv-marker";
    marker.textContent = " · Consul.AI";
    marker.title =
      "Filled by Consul.AI — click any option to override";
    lbl.appendChild(marker);
    radio.dataset.aipvFilled = "1";
  }

  function choiceOf(item, radio) {
    if (!item || !item.radios) return null;
    for (const [name, r] of Object.entries(item.radios)) {
      if (r === radio) return name;
    }
    return null;
  }

  // Attaches change listeners to every radio in the item so we can distinguish
  // user selections from the programmatic fill below. event.isTrusted is only
  // true for real user-initiated events, which is exactly the signal we want.
  function attachUserChoiceListener(item, aiRecommendation, onUserChoice) {
    if (!item || !item.radios) return;
    for (const [choice, radio] of Object.entries(item.radios)) {
      if (radio.dataset.aipvListener === "1") continue;
      radio.dataset.aipvListener = "1";
      radio.addEventListener("change", (ev) => {
        if (!ev.isTrusted) return;
        if (!radio.checked) return;
        onUserChoice({
          item,
          aiRecommendation,
          userChoice: choice,
          overridden: (aiRecommendation || "").toUpperCase() !== choice,
        });
      });
    }
  }

  function fillRadio(radio) {
    if (!radio) return false;
    if (radio.disabled) return false;

    clearGroupMarkers(radio);

    try {
      radio.focus({ preventScroll: true });
    } catch (_) {}

    setCheckedNative(radio);
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    radio.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );

    addMarker(radio);
    return true;
  }

  AIPV.fillRadio = fillRadio;
  AIPV.attachUserChoiceListener = attachUserChoiceListener;
  AIPV.choiceOf = choiceOf;
})();
