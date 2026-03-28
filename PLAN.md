# AI Proxy Voting Assistant — Build Plan

## Overview
An agent that helps retail investors make informed proxy voting decisions by analyzing their preferences and scraping company proposals.

## Architecture
```
[voting_history.md + questionnaire] → DeepSeek LLM → voting_profile.md
                                                          |
[company proposal URLs] → Scraper → raw proposals → DeepSeek LLM → summaries
                                                          |
                              voting_profile + summaries → Agent → recommendations
                                                                        |
                                                                   TUI Display
```

## Tech Stack
- **Language:** Python 3.11+
- **LLM:** DeepSeek (OpenAI-compatible API)
- **Scraping:** requests + BeautifulSoup, playwright (fallback for JS sites)
- **TUI:** rich
- **Config:** .env for API keys

## Build Steps

### Step 1: Project Scaffolding ⬜
> **Can be done by Codex** (independent)
- Create `pyproject.toml` with dependencies
- Create folder structure: `src/`, `data/`, `output/`
- Create `.env.example` with required env vars
- Create `src/__init__.py`, `src/main.py` entry point stub

### Step 2: Sample Data ⬜
> **Can be done by Codex** (independent)
- Create `data/voting_history.md` — sample investor voting history
- Create `data/questionnaire.md` — sample questionnaire answers (ESG preferences, risk tolerance, governance priorities)
- Create `data/company_urls.json` — 2-3 real proxy statement URLs (SEC EDGAR / investor relations pages)

### Step 3: Profile Generator (`src/profile_generator.py`) ⬜
> **Main track** — depends on Step 1
- Read voting history + questionnaire
- Call DeepSeek to generate `voting_profile.md`
- Profile captures: investment philosophy, ESG stance, governance priorities, risk tolerance

### Step 4: Proposal Scraper (`src/scraper.py`) ⬜
> **Can be done by Codex** (independent, just needs Step 1 structure)
- Accept a list of URLs from `company_urls.json`
- Scrape page content with requests + BeautifulSoup
- Extract proposal/resolution text from proxy statements
- Return structured list of proposals per company
- Fallback: if page is JS-heavy, use playwright

### Step 5: Proposal Summarizer (`src/summarizer.py`) ⬜
> **Main track** — depends on Step 4 output format
- Take raw scraped proposal text
- Call DeepSeek to produce plain-language summary of each resolution
- Output: list of `{company, resolution_id, title, summary, full_text}`

### Step 6: Voting Agent (`src/agent.py`) ⬜
> **Main track** — depends on Steps 3 & 5
- Load voting_profile.md
- For each proposal summary: call DeepSeek with profile + proposal
- Output: FOR / AGAINST / ABSTAIN + reasoning for each resolution
- Save results to `output/recommendations.json`

### Step 7: TUI Display (`src/display.py`) ⬜
> **Can be done by Codex** (independent, just needs output JSON schema)
- Read `output/recommendations.json`
- Display with `rich`: company name, proposal title, summary, recommendation badge (FOR=green, AGAINST=red, ABSTAIN=yellow), reasoning
- Also generate `output/report.html` as bonus

### Step 8: Main Orchestrator (`src/main.py`) ⬜
> **Main track** — ties everything together
- CLI entry point
- Orchestrate: profile gen → scrape → summarize → decide → display
- Add progress indicators with rich

## Parallel Work Assignment

### Codex can do (independent):
1. **Step 1** — Project scaffolding
2. **Step 2** — Sample data files
3. **Step 4** — Proposal scraper module
4. **Step 7** — TUI display module

### Main (Claude Code) builds:
1. **Step 3** — Profile generator
2. **Step 5** — Proposal summarizer
3. **Step 6** — Voting agent
4. **Step 8** — Main orchestrator

## Output Schema (shared contract for parallel work)

### `output/recommendations.json`
```json
{
  "profile_summary": "Brief description of investor's values",
  "companies": [
    {
      "name": "Apple Inc.",
      "ticker": "AAPL",
      "proposals": [
        {
          "id": "1",
          "title": "Election of Directors",
          "summary": "Plain language summary of the proposal",
          "recommendation": "FOR",
          "reasoning": "Why this aligns with your values...",
          "source_url": "https://..."
        }
      ]
    }
  ]
}
```
