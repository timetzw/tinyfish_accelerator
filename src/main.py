"""Main orchestrator — ties all steps together."""

from rich.console import Console

from src.profile_generator import generate_profile
from src.scraper import scrape_proposals
from src.summarizer import summarize_proposals
from src.agent import make_decisions
from src.display import display_recommendations, generate_html_report

console = Console()


def step(msg: str):
    console.print(f"\n[bold cyan]>>> {msg}[/bold cyan]")


def main():
    console.print("\n[bold white on blue] AI PROXY VOTING ASSISTANT [/bold white on blue]\n")

    # Step 1: Generate investor profile
    step("Analyzing your voting history and preferences...")
    profile = generate_profile()
    console.print("[green]  Profile generated -> output/voting_profile.md[/green]")

    # Step 2: Scrape company proposals
    step("Scraping company proxy statements...")
    companies = scrape_proposals()
    total = sum(len(c.get("proposals", [])) for c in companies)
    console.print(f"[green]  Found {total} proposals across {len(companies)} companies[/green]")

    # Step 3: Summarize proposals
    step("Summarizing proposals in plain language...")
    companies = summarize_proposals(companies)
    console.print("[green]  All proposals summarized[/green]")

    # Step 4: Make voting decisions
    step("Making voting decisions based on your profile...")
    result = make_decisions(companies)
    console.print("[green]  Recommendations generated -> output/recommendations.json[/green]")

    # Step 5: Display results
    step("Preparing your voting guide...")
    display_recommendations()

    # Step 6: Generate HTML report
    html_path = generate_html_report()
    console.print(f"\n[dim]HTML report saved to {html_path}[/dim]")
    console.print("[dim]Open it with: open output/report.html[/dim]\n")


if __name__ == "__main__":
    main()
