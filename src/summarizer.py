"""Step 5: Summarize scraped proposals into plain language."""

from src.llm import chat

SYSTEM_PROMPT = """You are a plain-language financial writer. Your job is to take corporate proxy
proposal text and summarize it so a regular retail investor can understand what they're voting on
in 2-3 sentences. Be neutral and factual. Highlight the key decision point."""


def summarize_proposals(companies: list[dict]) -> list[dict]:
    """Add plain-language summaries to each proposal."""
    for company in companies:
        for proposal in company.get("proposals", []):
            prompt = f"""Summarize this proxy voting proposal in 2-3 plain-language sentences
for a retail investor. What is being asked, and why does it matter?

Company: {company['company']}
Proposal: {proposal['title']}
Full Text: {proposal['full_text']}"""

            proposal["summary"] = chat(prompt, system=SYSTEM_PROMPT)

    return companies
