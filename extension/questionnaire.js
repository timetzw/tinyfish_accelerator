(function () {
  const SECTIONS = [
    {
      title: "Firm Identity",
      subtitle: "Sets the context for your default voting posture",
      questions: [
        {
          id: "philosophy",
          label:
            "How would you describe your firm's primary investment philosophy?",
          options: [
            { value: "esg", label: "ESG-focused" },
            { value: "value", label: "Value-oriented" },
            { value: "growth", label: "Growth-oriented" },
            { value: "preservation", label: "Capital preservation" },
            { value: "balanced", label: "Balanced / multi-strategy" },
          ],
        },
        {
          id: "horizon",
          label: "What is your typical holding period?",
          options: [
            { value: "short", label: "Short-term (less than 1 year)" },
            { value: "medium", label: "Medium-term (1–5 years)" },
            { value: "long", label: "Long-term (5+ years)" },
          ],
        },
      ],
    },
    {
      title: "Board & Governance",
      subtitle: "Director elections, independence",
      questions: [
        {
          id: "boardIndependence",
          label: "How important is board independence to you?",
          options: [
            {
              value: "critical",
              label: "Critical — we vote against non-independent chairs",
            },
            {
              value: "important",
              label: "Important — prefer majority independent",
            },
            { value: "flexible", label: "Flexible — case by case" },
          ],
        },
        {
          id: "overboarding",
          label:
            "How do you view directors who sit on too many boards (overboarding)?",
          options: [
            {
              value: "strict4",
              label: "Vote against if director sits on 4+ public boards",
            },
            {
              value: "flag",
              label: "Flag for review, but don't auto-vote against",
            },
            { value: "none", label: "Not a factor for us" },
          ],
        },
        {
          id: "ceoChair",
          label: "What's your stance on combining CEO and Chair roles?",
          options: [
            { value: "against", label: "Always vote against combined roles" },
            { value: "depends", label: "Depends on company performance" },
            { value: "none", label: "No strong view" },
          ],
        },
      ],
    },
    {
      title: "Executive Compensation",
      subtitle: "Say-on-pay, equity plans",
      questions: [
        {
          id: "sayOnPay",
          label: "How do you approach say-on-pay votes?",
          options: [
            {
              value: "strict",
              label:
                "Strict — vote against if pay exceeds peer median by 25% or more",
            },
            {
              value: "moderate",
              label: "Moderate — focus on pay-for-performance alignment",
            },
            {
              value: "supportive",
              label: "Supportive — generally follow board recommendation",
            },
          ],
        },
        {
          id: "equityPlans",
          label:
            "How do you view large equity compensation plans (share dilution)?",
          options: [
            {
              value: "scrutinize",
              label: "Scrutinize — vote against if dilution exceeds 5%",
            },
            {
              value: "review",
              label: "Review on merits — weigh retention value vs dilution cost",
            },
            {
              value: "supportive",
              label: "Generally supportive of equity-based compensation",
            },
          ],
        },
      ],
    },
    {
      title: "ESG & Shareholder Proposals",
      subtitle: "Environmental, social, activist proposals",
      questions: [
        {
          id: "envProposals",
          label:
            "How do you approach environmental and climate-related shareholder proposals?",
          options: [
            {
              value: "strong",
              label: "Strong support — vote FOR most climate proposals",
            },
            {
              value: "selective",
              label: "Selective — support if company lacks a credible plan",
            },
            {
              value: "neutral",
              label: "Neutral — evaluate on business materiality only",
            },
            {
              value: "against",
              label: "Generally against — not our role to push an ESG agenda",
            },
          ],
        },
        {
          id: "socialProposals",
          label:
            "How do you approach social proposals (DEI reporting, human rights, political spending)?",
          options: [
            { value: "supportive", label: "Supportive of transparency proposals" },
            { value: "material", label: "Only if financially material" },
            { value: "case", label: "Case by case — no default stance" },
            { value: "oppose", label: "Generally oppose — outside our mandate" },
          ],
        },
        {
          id: "shareholderVsBoard",
          label:
            "When a shareholder proposal conflicts with the board recommendation, what's your instinct?",
          options: [
            {
              value: "shareholder",
              label: "Lean toward the shareholder proposal",
            },
            { value: "board", label: "Lean toward the board recommendation" },
            {
              value: "independent",
              label: "Evaluate independently every time",
            },
          ],
        },
      ],
    },
    {
      title: "Auditors & Capital Structure",
      subtitle: "Ratification, M&A, share issuance",
      questions: [
        {
          id: "auditorTenure",
          label: "How do you view long-tenured auditors?",
          options: [
            {
              value: "over7",
              label: "Flag if same auditor has served more than 7 years",
            },
            { value: "over15", label: "Only flag if more than 15 years" },
            { value: "none", label: "Auditor tenure is not a factor" },
          ],
        },
        {
          id: "maPosture",
          label:
            "On M&A votes and major capital transactions, what's your default posture?",
          options: [
            {
              value: "followBoard",
              label: "Follow board recommendation unless red flags are present",
            },
            {
              value: "human",
              label: "Scrutinize closely — always route to human review",
            },
            {
              value: "returns",
              label: "Evaluate against our return requirements",
            },
          ],
        },
      ],
    },
  ];

  function flatQuestions() {
    const out = [];
    for (const s of SECTIONS) for (const q of s.questions) out.push(q);
    return out;
  }

  function renderQuestions(existing) {
    const container = document.getElementById("aipv-q-container");
    container.innerHTML = "";
    let qIndex = 0;
    const total = flatQuestions().length;

    for (const section of SECTIONS) {
      const secEl = document.createElement("div");
      secEl.className = "aipv-q-section";
      const secTitle = document.createElement("h2");
      secTitle.className = "aipv-q-section-title";
      secTitle.textContent = section.title;
      const secSub = document.createElement("p");
      secSub.className = "aipv-q-section-sub";
      secSub.textContent = section.subtitle;
      secEl.appendChild(secTitle);
      secEl.appendChild(secSub);
      container.appendChild(secEl);

      for (const q of section.questions) {
        qIndex += 1;
        const card = document.createElement("div");
        card.className = "aipv-q-card";

        const num = document.createElement("div");
        num.className = "aipv-q-num";
        num.textContent = `Question ${qIndex} of ${total}`;
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
      }
    }
  }

  const PHILOSOPHY_TEXT = {
    esg: "ESG-focused",
    value: "value-oriented",
    growth: "growth-oriented",
    preservation: "capital preservation",
    balanced: "balanced / multi-strategy",
  };

  function generateSummary(answers) {
    const tags = [];

    if (answers.philosophy) tags.push(PHILOSOPHY_TEXT[answers.philosophy]);
    if (answers.horizon === "long") tags.push("long-term holding");
    else if (answers.horizon === "short") tags.push("short-horizon");
    else if (answers.horizon === "medium") tags.push("medium-term holding");

    if (answers.boardIndependence === "critical")
      tags.push("strict on board independence");
    else if (answers.boardIndependence === "important")
      tags.push("prefers majority-independent boards");

    if (answers.overboarding === "strict4")
      tags.push("auto-against overboarded directors (4+)");

    if (answers.ceoChair === "against")
      tags.push("against combined CEO/Chair");

    if (answers.sayOnPay === "strict")
      tags.push("strict on say-on-pay (25% peer-median rule)");
    else if (answers.sayOnPay === "moderate")
      tags.push("pay-for-performance focus");

    if (answers.equityPlans === "scrutinize")
      tags.push("dilution-sensitive (5% cap)");

    if (answers.envProposals === "strong")
      tags.push("strong support for climate proposals");
    else if (answers.envProposals === "selective")
      tags.push("selective on climate (support if no credible plan)");
    else if (answers.envProposals === "against")
      tags.push("opposes ESG-agenda proposals");

    if (answers.socialProposals === "supportive")
      tags.push("supports social/DEI transparency");
    else if (answers.socialProposals === "material")
      tags.push("social proposals only if material");
    else if (answers.socialProposals === "oppose")
      tags.push("opposes social proposals outside mandate");

    const biasText =
      answers.shareholderVsBoard === "shareholder"
        ? "leans shareholder in conflicts"
        : answers.shareholderVsBoard === "board"
          ? "leans with the board in conflicts"
          : "evaluates conflicts independently";
    tags.push(biasText);

    if (answers.auditorTenure === "over7")
      tags.push("flags auditors past 7yr tenure");

    if (answers.maPosture === "human")
      tags.push("routes all M&A to human review");
    else if (answers.maPosture === "returns")
      tags.push("evaluates M&A against return requirements");

    return `Profile: ${tags.join("; ")}.`;
  }

  function collectAnswers() {
    const answers = {};
    for (const q of flatQuestions()) {
      const checked = document.querySelector(`input[name="${q.id}"]:checked`);
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
          version: 2,
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
