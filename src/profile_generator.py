"""Step 3: Generate investor voting profile from history + questionnaire."""

from pathlib import Path
from src.llm import chat

SYSTEM_PROMPT = """You are an expert financial analyst specializing in ESG investing and proxy voting.
Your job is to analyze an investor's voting history and questionnaire responses to create
a comprehensive voting profile that captures their values, priorities, and decision-making patterns.

Output a well-structured markdown document called "Voting Profile" that an AI agent can use
to make proxy voting decisions on behalf of this investor."""

USER_PROMPT_TEMPLATE = """Based on the following voting history and questionnaire responses,
generate a detailed voting profile for this investor.

## Voting History
{voting_history}

## Questionnaire Responses
{questionnaire}

Generate a voting profile in markdown that includes:
1. **Core Values Summary** — 2-3 sentence overview of this investor's philosophy
2. **ESG Priorities** — ranked list with brief description of stance on each
3. **Governance Preferences** — specific views on board composition, exec comp, shareholder rights
4. **Voting Patterns** — observed tendencies (when they vote with/against management)
5. **Decision Rules** — concrete rules an agent should follow when voting on their behalf
   (e.g., "ALWAYS vote FOR climate disclosure proposals", "Vote AGAINST exec comp packages exceeding 200x median employee pay")
6. **Red Flags** — issues that would trigger an automatic AGAINST vote
"""


def generate_profile(
    voting_history_path: str = "data/voting_history.md",
    questionnaire_path: str = "data/questionnaire.md",
    output_path: str = "output/voting_profile.md",
) -> str:
    voting_history = Path(voting_history_path).read_text()
    questionnaire = Path(questionnaire_path).read_text()

    prompt = USER_PROMPT_TEMPLATE.format(
        voting_history=voting_history,
        questionnaire=questionnaire,
    )

    profile = chat(prompt, system=SYSTEM_PROMPT)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(profile)

    return profile
