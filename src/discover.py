"""Use TinyFish Web Agent to discover proxy statement URLs from SEC EDGAR.

Usage:
    python -m src.discover AAPL MSFT TSLA

Discovered URLs are written to data/company_urls.json, replacing any
existing entries. The main pipeline (src.main) then uses these URLs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from rich.console import Console

from src.scraper import discover_proxy_urls

console = Console()


def main(tickers: list[str] | None = None):
    if not tickers:
        tickers = sys.argv[1:] if len(sys.argv) > 1 else ["AAPL", "MSFT", "TSLA"]

    console.print(f"\n[bold cyan]Discovering proxy statements for: {', '.join(tickers)}[/bold cyan]")
    console.print("[dim]Using TinyFish Web Agent to search SEC EDGAR...[/dim]\n")

    urls = discover_proxy_urls(tickers)

    if not urls:
        console.print("[red]No URLs discovered. Check TINYFISH_API_KEY in .env[/red]")
        return

    for url in urls:
        console.print(f"[green]  ✓ {url}[/green]")

    output_path = Path("data/company_urls.json")
    output_path.write_text(json.dumps(urls, indent=2) + "\n")
    console.print(f"\n[bold]Saved {len(urls)} URLs to {output_path}[/bold]")
    console.print("[dim]Run 'python -m src.main' to use them.[/dim]\n")


if __name__ == "__main__":
    main()
