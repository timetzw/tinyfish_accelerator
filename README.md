# AI Proxy Voting Assistant

An AI-powered agent that helps retail investors make informed proxy voting decisions. It analyzes your voting history and preferences, scrapes real company proxy statements from SEC EDGAR, and generates personalized FOR/AGAINST/ABSTAIN recommendations with plain-language explanations.

## The Problem

Retail investors hold shares in dozens of companies but rarely vote in proxy elections. The reason: each company sends a 50-200 page proxy statement full of legal jargon, and reading them all feels pointless when your individual vote seems insignificant. Platforms like Fidelity provide access to vote, but most users skip it entirely.

This means corporate decisions — executive pay packages, climate policy, board composition — are decided without the voice of millions of everyday shareholders.

## The Solution

An AI agent that acts as your proxy voting representative:

1. **Learns your values** from your voting history and a short questionnaire
2. **Reads the proposals** by scraping SEC EDGAR proxy statements
3. **Makes recommendations** aligned with your personal investment philosophy
4. **Explains each decision** in plain language so you stay informed

## Workflow

```
                        ┌─────────────────────┐
                        │   Your Voting Data   │
                        │  voting_history.md   │
                        │  questionnaire.md    │
                        └─────────┬───────────┘
                                  │
                                  ▼
                        ┌─────────────────────┐
                        │   DeepSeek LLM      │
                        │  Profile Generator   │
                        └─────────┬───────────┘
                                  │
                                  ▼
                        ┌─────────────────────┐
                        │  voting_profile.md   │
                        │  (your values &      │
                        │   decision rules)    │
                        └─────────┬───────────┘
                                  │
            ┌─────────────────────┤
            │                     │
            ▼                     ▼
  ┌───────────────────┐  ┌─────────────────────┐
  │  SEC EDGAR Scraper │  │   Voting Agent      │
  │  Fetch & parse     │  │   Profile + Proposals│
  │  proxy statements  │──▶  = Recommendations   │
  │  (DEF 14A filings) │  │   FOR/AGAINST/ABSTAIN│
  └───────────────────┘  └─────────┬───────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │  Display Results     │
                         │  Terminal (rich TUI) │
                         │  + HTML report       │
                         └─────────────────────┘
```

## Project Structure

```
tinyfish_accelerator/
├── src/
│   ├── main.py               # Orchestrator — runs the full pipeline
│   ├── llm.py                # Shared DeepSeek client (OpenAI-compatible)
│   ├── profile_generator.py  # Generates voting_profile.md from user data
│   ├── scraper.py            # Scrapes SEC EDGAR proxy statements
│   ├── summarizer.py         # Summarizes proposals in plain language
│   ├── agent.py              # Voting decision agent (FOR/AGAINST/ABSTAIN)
│   └── display.py            # Terminal display (rich) + HTML report
├── data/
│   ├── voting_history.md     # Sample investor voting record
│   ├── questionnaire.md      # Sample investor preferences
│   └── company_urls.json     # SEC EDGAR proxy statement URLs
├── output/                   # Generated at runtime
│   ├── voting_profile.md     # Your AI-generated investor profile
│   ├── recommendations.json  # Structured voting recommendations
│   └── report.html           # HTML report for browser viewing
├── PLAN.md                   # Build plan and architecture
├── PROGRESS.md               # Build progress tracker
└── pyproject.toml
```

## Getting Started

### Prerequisites

- Python 3.11+
- A [DeepSeek API key](https://platform.deepseek.com/)

### Setup

```bash
# Clone the repo
git clone https://github.com/timetzw/tinyfish_accelerator.git
cd tinyfish_accelerator

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .

# Configure API key
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY
```

### Run

```bash
python -m src.main
```

The pipeline will:

1. **Generate your voting profile** — Reads `data/voting_history.md` and `data/questionnaire.md`, calls DeepSeek to produce `output/voting_profile.md`
2. **Scrape proxy statements** — Fetches DEF 14A filings from the URLs in `data/company_urls.json`, parses out individual proposals
3. **Summarize proposals** — Converts each proposal into a 2-3 sentence plain-language summary
4. **Make voting decisions** — Compares each proposal against your profile and recommends FOR, AGAINST, or ABSTAIN with reasoning
5. **Display results** — Shows a color-coded table in the terminal and generates `output/report.html`

To view the HTML report after running:

```bash
open output/report.html
```

### Customize Your Input

Edit the files in `data/` to match your real preferences:

- **`voting_history.md`** — Your past proxy voting record (which proposals you voted FOR/AGAINST and why)
- **`questionnaire.md`** — Your investment philosophy, ESG stance, governance priorities
- **`company_urls.json`** — List of SEC EDGAR DEF 14A URLs for companies you hold shares in (find them at [sec.gov/cgi-bin/browse-edgar](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=DEF+14A))

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.11+ |
| LLM | DeepSeek (via OpenAI-compatible API) |
| Scraping | requests + BeautifulSoup |
| Display | rich (terminal), HTML (browser) |
| Config | python-dotenv |

## Output Example

Terminal output shows a table per company:

```
┌───────────────────────────────────────────────────────────┐
│ Apple Inc. (AAPL)                                         │
├───┬──────────────────────────┬────────┬───────────────────┤
│ # │ Proposal                 │  Vote  │ Reasoning         │
├───┼──────────────────────────┼────────┼───────────────────┤
│ 1 │ Election of Directors    │  FOR   │ Board is indep... │
│ 2 │ Ratify Auditors (EY)    │  FOR   │ No audit conc...  │
│ 3 │ Executive Compensation   │AGAINST │ CEO pay ratio...  │
│ 4 │ AI Ethics Report         │  FOR   │ Aligns with t...  │
│ 5 │ Climate Lobbying Report  │  FOR   │ Supports disc...  │
└───┴──────────────────────────┴────────┴───────────────────┘
```

## Disclaimer

This tool is for informational and educational purposes only. It does not constitute financial or legal advice. Always review proxy materials yourself before casting votes.
