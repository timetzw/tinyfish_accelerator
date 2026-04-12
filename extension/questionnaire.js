(function () {
  const QUESTIONS = [
    {
      id: "role",
      label: "What best describes you?",
      options: [
        { value: "individual", label: "Individual investor" },
        { value: "advisor", label: "Financial advisor" },
        { value: "fund", label: "Fund manager" },
      ],
    },
    {
      id: "horizon",
      label: "What is your primary investment horizon?",
      options: [
        { value: "short", label: "Short-term (under 3 years)" },
        { value: "medium", label: "Medium-term (3–10 years)" },
        { value: "long", label: "Long-term (10+ years)" },
      ],
    },
    {
      id: "esg",
      label:
        "How important are ESG factors (environmental, social, governance) in your decisions?",
      options: [
        { value: "low", label: "Not a primary factor" },
        { value: "medium", label: "Considered alongside returns" },
        { value: "high", label: "Core to my decisions" },
      ],
    },
    {
      id: "governance",
      label:
        "How strict are your expectations for board independence and diversity?",
      options: [
        {
          value: "lenient",
          label: "Lenient — I trust management most of the time",
        },
        {
          value: "moderate",
          label: "Moderate — I expect reasonable independence",
        },
        {
          value: "strict",
          label: "Strict — I actively vote against weak boards",
        },
      ],
    },
    {
      id: "execPay",
      label: "When do you typically support executive compensation packages?",
      options: [
        { value: "usually", label: "Usually — boards generally get it right" },
        {
          value: "tied",
          label: "Only when pay is clearly performance-tied",
        },
        {
          value: "rarely",
          label: "Rarely — executive pay is generally excessive",
        },
      ],
    },
    {
      id: "shareholderRights",
      label:
        "How do you vote on shareholder rights proposals (special meetings, written consent, proxy access)?",
      options: [
        { value: "against", label: "Cautious — often against" },
        { value: "case", label: "Case-by-case" },
        {
          value: "for",
          label: "Supportive — shareholders should have voice",
        },
      ],
    },
    {
      id: "climate",
      label: "Should companies provide detailed climate risk disclosure?",
      options: [
        { value: "optional", label: "Optional — let the market decide" },
        { value: "supportive", label: "Supportive — helpful but not critical" },
        { value: "mandatory", label: "Mandatory — material to valuation" },
      ],
    },
    {
      id: "bias",
      label: "When a proposal is ambiguous, your default bias is to:",
      options: [
        { value: "board", label: "Vote with the board" },
        { value: "independent", label: "Trust independent analysis" },
        {
          value: "protective",
          label: "Favor shareholder-protective proposals",
        },
      ],
    },
  ];

  function renderQuestions(existing) {
    const container = document.getElementById("aipv-q-container");
    container.innerHTML = "";
    QUESTIONS.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "aipv-q-card";

      const num = document.createElement("div");
      num.className = "aipv-q-num";
      num.textContent = `Question ${idx + 1} of ${QUESTIONS.length}`;
      card.appendChild(num);

      const label = document.createElement("div");
      label.className = "aipv-q-label";
      label.textContent = q.label;
      card.appendChild(label);

      const opts = document.createElement("div");
      opts.className = "aipv-q-options";

      q.options.forEach((opt) => {
        const l = document.createElement("label");
        l.className = "aipv-q-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = q.id;
        input.value = opt.value;
        input.required = true;
        if (existing && existing[q.id] === opt.value) input.checked = true;
        const span = document.createElement("span");
        span.textContent = opt.label;
        l.appendChild(input);
        l.appendChild(span);
        opts.appendChild(l);
      });

      card.appendChild(opts);
      container.appendChild(card);
    });
  }

  function generateSummary(answers) {
    const priorities = [];
    if (answers.horizon === "long")
      priorities.push("long-term value creation");
    else if (answers.horizon === "short")
      priorities.push("near-term capital preservation");
    else priorities.push("balanced medium-term returns");

    if (answers.esg === "high") priorities.push("strong ESG alignment");
    else if (answers.esg === "medium") priorities.push("ESG as a tiebreaker");

    if (answers.governance === "strict")
      priorities.push("board independence and diversity");
    else if (answers.governance === "moderate")
      priorities.push("reasonable board oversight");

    if (answers.execPay === "rarely")
      priorities.push("disciplined executive compensation");
    else if (answers.execPay === "tied")
      priorities.push("performance-tied pay packages");

    if (answers.shareholderRights === "for")
      priorities.push("shareholder voice and accountability");

    if (answers.climate === "mandatory")
      priorities.push("climate risk transparency");

    const roleText =
      answers.role === "advisor"
        ? "As a financial advisor, "
        : answers.role === "fund"
          ? "As a fund manager, "
          : "";

    const biasText =
      answers.bias === "board"
        ? "lean toward the board's recommendation"
        : answers.bias === "protective"
          ? "favor shareholder-protective outcomes"
          : "favor independent analysis over the board's default";

    return `${roleText}you prioritize ${priorities.slice(0, 4).join(", ")}. When a proposal is ambiguous, you ${biasText}.`;
  }

  function collectAnswers() {
    const answers = {};
    for (const q of QUESTIONS) {
      const checked = document.querySelector(
        `input[name="${q.id}"]:checked`
      );
      if (!checked) return null;
      answers[q.id] = checked.value;
    }
    return answers;
  }

  async function save(profile) {
    return new Promise((resolve) =>
      chrome.storage.local.set({ profile }, resolve)
    );
  }

  async function load() {
    return new Promise((resolve) =>
      chrome.storage.local.get(["profile"], (res) => resolve(res.profile))
    );
  }

  async function init() {
    const existing = await load();
    renderQuestions(existing ? existing.answers : null);

    document.getElementById("aipv-q-cancel").addEventListener("click", () => {
      window.close();
    });

    document
      .getElementById("aipv-q-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const answers = collectAnswers();
        if (!answers) {
          alert("Please answer every question.");
          return;
        }
        const summary = generateSummary(answers);
        const profile = {
          version: 1,
          answers,
          summary,
          updatedAt: new Date().toISOString(),
        };
        await save(profile);

        const success = document.getElementById("aipv-q-success");
        document.getElementById("aipv-q-success-summary").textContent = summary;
        success.classList.add("show");
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
