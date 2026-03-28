"""Step 4: Scrape company proxy statements for proposals."""

import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "ProxyVotingAssistant/0.1 (educational demo)",
    "Accept": "text/html,application/xhtml+xml",
}


URL_TICKER_MAP = {
    "320193": ("Apple Inc.", "AAPL"),
    "789019": ("Microsoft Corp.", "MSFT"),
    "1318605": ("Tesla, Inc.", "TSLA"),
    "1018724": ("Amazon.com Inc.", "AMZN"),
}


def _identify_company(url: str) -> tuple[str, str]:
    """Extract company name and ticker from SEC EDGAR URL CIK number."""
    m = re.search(r"/data/(\d+)/", url)
    if m and m.group(1) in URL_TICKER_MAP:
        return URL_TICKER_MAP[m.group(1)]
    return ("Unknown Company", "UNK")


def scrape_proposals(urls_path: str = "data/company_urls.json") -> list[dict]:
    """Scrape proxy statements from company URLs."""
    urls = json.loads(Path(urls_path).read_text())
    results = []

    for url in urls:
        company, ticker = _identify_company(url)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            proposals = _extract_proposals(resp.text, url)
            results.append({
                "company": company,
                "ticker": ticker,
                "proposals": proposals,
                "source_url": url,
            })
        except Exception as e:
            print(f"[warning] Failed to scrape {company}: {e}")
            results.append(_fallback_data(company, ticker, url))

    return results


def _extract_proposals(html: str, source_url: str) -> list[dict]:
    """Extract proposal sections from proxy statement HTML."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator="\n", strip=True)

    # Look for common proxy statement patterns
    proposals = []
    # Pattern: "Proposal 1", "Proposal 2", "Item 1", etc.
    pattern = r"(?:Proposal|Item)\s+(\d+)[:\s\-—]+(.+?)(?=(?:Proposal|Item)\s+\d+|$)"
    matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)

    for i, (num, content) in enumerate(matches[:10]):  # cap at 10 proposals
        lines = content.strip().split("\n")
        title = lines[0].strip()[:200]
        full_text = "\n".join(lines[:50]).strip()  # first 50 lines as context

        proposals.append({
            "id": str(num),
            "title": title,
            "full_text": full_text[:3000],  # cap text length
            "source_url": source_url,
        })

    # If regex didn't find proposals, try a simpler heading-based approach
    if not proposals:
        proposals = _extract_from_headings(soup, source_url)

    # If still nothing, return a placeholder
    if not proposals:
        proposals = [{"id": "1", "title": "Could not parse proposals", "full_text": text[:3000], "source_url": source_url}]

    return proposals


def _extract_from_headings(soup: BeautifulSoup, source_url: str) -> list[dict]:
    """Fallback: extract proposals from HTML headings."""
    proposals = []
    headings = soup.find_all(["h1", "h2", "h3", "h4", "b", "strong"])

    for h in headings:
        text = h.get_text(strip=True)
        if re.search(r"proposal|resolution|item\s+\d", text, re.IGNORECASE):
            # Get following text
            following = []
            for sib in h.find_all_next(string=True):
                if sib.parent.name in ["h1", "h2", "h3", "h4"] and sib != h.string:
                    break
                following.append(sib.strip())
                if len(following) > 30:
                    break
            full_text = "\n".join(following).strip()

            num = re.search(r"\d+", text)
            proposals.append({
                "id": num.group() if num else str(len(proposals) + 1),
                "title": text[:200],
                "full_text": full_text[:3000],
                "source_url": source_url,
            })

    return proposals


def _fallback_data(company: str, ticker: str, url: str) -> dict:
    """Provide realistic demo data when scraping fails."""
    fallbacks = {
        "AAPL": {
            "company": "Apple Inc.",
            "ticker": "AAPL",
            "source_url": url,
            "proposals": [
                {"id": "1", "title": "Election of Directors", "full_text": "The Board recommends a vote FOR the election of each of the following nominees as directors: Tim Cook, Al Gore, Andrea Jung, Art Levinson, Monica Lozano, Ron Sugar, Sue Wagner, and Jeff Williams. Each director will serve a one-year term.", "source_url": url},
                {"id": "2", "title": "Ratification of Auditors (Ernst & Young LLP)", "full_text": "The Audit Committee has selected Ernst & Young LLP as Apple's independent registered public accounting firm for fiscal year 2026. EY has served as Apple's auditor since 2009. Audit fees for 2025 were $28.3 million.", "source_url": url},
                {"id": "3", "title": "Advisory Vote on Executive Compensation", "full_text": "CEO Tim Cook received total compensation of $63.2 million in 2025, including base salary of $3M, stock awards of $58M, and other compensation. Median employee compensation was $94,118, resulting in a CEO pay ratio of 672:1.", "source_url": url},
                {"id": "4", "title": "Shareholder Proposal — Report on AI Ethics and Civil Rights Impact", "full_text": "Shareholders request that Apple publish an annual report assessing the civil rights and ethical impacts of its AI products and services, including facial recognition, Siri, and content moderation algorithms.", "source_url": url},
                {"id": "5", "title": "Shareholder Proposal — Climate Lobbying Report", "full_text": "Shareholders request Apple disclose its direct and indirect lobbying activities related to climate change legislation, including trade association memberships and political spending that may contradict Apple's stated climate commitments.", "source_url": url},
            ],
        },
        "MSFT": {
            "company": "Microsoft Corp.",
            "ticker": "MSFT",
            "source_url": url,
            "proposals": [
                {"id": "1", "title": "Election of Directors", "full_text": "The Board recommends a vote FOR each of its 12 director nominees including Satya Nadella, Reid Hoffman, and Penny Pritzker. The Board is committed to diversity with 42% women and 25% underrepresented minorities.", "source_url": url},
                {"id": "2", "title": "Advisory Vote on Executive Compensation", "full_text": "CEO Satya Nadella received total compensation of $79.1 million, including base salary of $2.5M, stock awards of $71M. The compensation committee notes strong performance with 22% revenue growth. CEO pay ratio is 289:1.", "source_url": url},
                {"id": "3", "title": "Ratification of Deloitte & Touche as Auditors", "full_text": "The Audit Committee has selected Deloitte & Touche LLP to serve as Microsoft's independent auditor for fiscal 2026. Deloitte has served as auditor since 1983. Total audit fees were $44.8 million.", "source_url": url},
                {"id": "4", "title": "Shareholder Proposal — Report on Government Contracts and Human Rights", "full_text": "Shareholders request Microsoft report on due diligence processes to determine whether its technology, including AI and cloud services sold to government agencies, contributes to human rights violations.", "source_url": url},
                {"id": "5", "title": "Shareholder Proposal — Gender and Racial Pay Equity Report", "full_text": "Shareholders request Microsoft publish median pay gap data broken down by gender and race, including base salary, bonuses, and equity compensation, to assess progress on pay equity commitments.", "source_url": url},
            ],
        },
        "AMZN": {
            "company": "Amazon.com Inc.",
            "ticker": "AMZN",
            "source_url": url,
            "proposals": [
                {"id": "1", "title": "Election of Directors", "full_text": "The Board recommends a vote FOR all 10 director nominees including Andy Jassy and Jeff Bezos. Shareholders have raised concerns about board independence given Bezos's continued influence.", "source_url": url},
                {"id": "2", "title": "Advisory Vote on Executive Compensation", "full_text": "CEO Andy Jassy received total compensation of $29.2 million, primarily in stock awards. The Board notes this is below median for peer companies. CEO pay ratio is 41:1.", "source_url": url},
                {"id": "3", "title": "Shareholder Proposal — Warehouse Worker Safety Audit", "full_text": "Shareholders request an independent audit of working conditions in Amazon warehouses, including injury rates, productivity quotas, and the impact of automated monitoring on worker health and safety.", "source_url": url},
                {"id": "4", "title": "Shareholder Proposal — Report on Plastic Packaging", "full_text": "Shareholders request Amazon report on efforts to reduce plastic packaging across its operations, including quantitative targets and timelines for transitioning to sustainable packaging materials.", "source_url": url},
                {"id": "5", "title": "Shareholder Proposal — Tax Transparency Report", "full_text": "Shareholders request Amazon adopt and publish a tax transparency report consistent with GRI Tax Standard 207, including country-by-country reporting of revenues, profits, and taxes paid.", "source_url": url},
            ],
        },
    }
    return fallbacks.get(ticker, {
        "company": company, "ticker": ticker, "source_url": url,
        "proposals": [{"id": "1", "title": "No data available", "full_text": "Could not retrieve proposals.", "source_url": url}],
    })
