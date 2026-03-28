"""Step 6: Voting decision agent — recommends FOR/AGAINST/ABSTAIN based on profile."""

import json
from pathlib import Path
from src.llm import chat

SYSTEM_PROMPT = """You are a proxy voting agent acting on behalf of a retail investor.
You have their voting profile which describes their values, priorities, and decision rules.
For each proposal, you must recommend FOR, AGAINST, or ABSTAIN with a clear explanation
of how this recommendation aligns with the investor's stated values.

You MUST respond in this exact JSON format:
{
  "recommendation": "FOR" | "AGAINST" | "ABSTAIN",
  "reasoning": "2-3 sentence explanation connecting the proposal to the investor's values"
}

Respond with ONLY the JSON, no other text."""


def make_decisions(
    companies: list[dict],
    profile_path: str = "output/voting_profile.md",
    output_path: str = "output/recommendations.json",
) -> dict:
    """Generate voting recommendations for all proposals."""
    profile = Path(profile_path).read_text()

    profile_summary = profile[:200] + "..."

    for company in companies:
        for proposal in company.get("proposals", []):
            prompt = f"""## Investor Voting Profile
{profile}

## Proposal to Vote On
Company: {company['company']} ({company['ticker']})
Proposal {proposal['id']}: {proposal['title']}
Summary: {proposal.get('summary', proposal['full_text'][:500])}
Full Text: {proposal['full_text'][:1500]}

Based on the investor's profile, recommend FOR, AGAINST, or ABSTAIN with reasoning."""

            response = chat(prompt, system=SYSTEM_PROMPT)

            try:
                # Try to parse JSON from response
                # Handle cases where LLM wraps in ```json
                cleaned = response.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
                decision = json.loads(cleaned)
                proposal["recommendation"] = decision.get("recommendation", "ABSTAIN")
                proposal["reasoning"] = decision.get("reasoning", "Unable to determine.")
            except (json.JSONDecodeError, KeyError):
                # Fallback: try to extract from text
                upper = response.upper()
                if "FOR" in upper and "AGAINST" not in upper:
                    proposal["recommendation"] = "FOR"
                elif "AGAINST" in upper:
                    proposal["recommendation"] = "AGAINST"
                else:
                    proposal["recommendation"] = "ABSTAIN"
                proposal["reasoning"] = response[:300]

    result = {
        "profile_summary": profile_summary,
        "companies": companies,
    }

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(result, indent=2))

    return result
