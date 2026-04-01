"""Scrape proxy statement proposals using TinyFish Web Agent (with requests+BS4 fallback)."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests
from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag
from dotenv import load_dotenv

load_dotenv()

LOGGER = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TinyFish REST API configuration
# ---------------------------------------------------------------------------
TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"

TINYFISH_GOAL = "Get the full text content of this SEC filing page. Return all the text exactly as it appears."

# ---------------------------------------------------------------------------
# Fallback: requests + BeautifulSoup constants
# ---------------------------------------------------------------------------
HEADERS = {
    "User-Agent": "ProxyVotingAssistant/0.1 (contact: demo@example.com)",
    "Accept": "text/html,application/xhtml+xml",
}

NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12",
}

COMPANY_TICKERS = {
    "apple inc.": "AAPL",
    "microsoft corporation": "MSFT",
    "tesla, inc.": "TSLA",
}

HEADING_PATTERN = re.compile(
    r"^Proposal(?:\s+No\.)?\s+(?P<label>\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*"
    r"(?:[:\-–—]\s*|\s+)(?P<title>.+)$",
    re.IGNORECASE,
)

TITLE_CLEANUP_PATTERN = re.compile(r"\b(?:def\s*14a|schedule\s*14a)\b", re.IGNORECASE)
TEXT_PROPOSAL_PATTERN = re.compile(
    r"Proposal(?:\s+No\.)?\s+(?P<label>\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*"
    r"(?:[:\-–—]\s*|\s+)(?P<title>.+?)(?=Proposal(?:\s+No\.)?\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b|$)",
    re.IGNORECASE,
)


# ===================================================================
# Public entry point
# ===================================================================

def scrape_proposals(urls: list[str]) -> list[dict[str, Any]]:
    """Fetch proxy statement URLs and return structured company proposal data.

    Uses TinyFish Web Agent API when TINYFISH_API_KEY is set,
    otherwise falls back to direct HTTP requests + BeautifulSoup parsing.
    """
    api_key = os.getenv("TINYFISH_API_KEY")
    if api_key:
        LOGGER.info("Using TinyFish Web Agent for scraping")
        return _scrape_all_tinyfish(urls, api_key)

    LOGGER.info("TINYFISH_API_KEY not set — falling back to requests + BeautifulSoup")
    return _scrape_all_requests(urls)


# ===================================================================
# TinyFish path
# ===================================================================

def _scrape_all_tinyfish(urls: list[str], api_key: str) -> list[dict[str, Any]]:
    """Fetch all URLs via TinyFish in parallel, then parse with BeautifulSoup."""
    results: list[dict[str, Any]] = []
    url_to_html: dict[str, str] = {}

    # Fetch all pages in parallel through TinyFish
    with ThreadPoolExecutor(max_workers=len(urls)) as pool:
        futures = {pool.submit(_tinyfish_fetch_html, url, api_key): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                html = future.result()
                if html:
                    url_to_html[url] = html
                else:
                    LOGGER.warning("TinyFish returned empty for %s, trying fallback", url)
            except Exception as exc:  # noqa: BLE001
                LOGGER.warning("TinyFish failed for %s: %s — trying fallback", url, exc)

    # Parse fetched HTML with BeautifulSoup; fallback to requests for failures
    for url in urls:
        html = url_to_html.get(url)
        if html:
            company_data = _parse_html(html, url)
            if company_data:
                results.append(company_data)
                continue
        # Fallback
        fallback = _scrape_single_request(url)
        if fallback:
            results.append(fallback)

    return results


def _tinyfish_fetch_html(url: str, api_key: str) -> str | None:
    """Call TinyFish REST API to fetch page content from a single URL."""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }
    payload = {
        "url": url,
        "goal": TINYFISH_GOAL,
        "session_id": str(uuid.uuid4()),
        "browser_profile": "lite",
    }

    resp = requests.post(TINYFISH_API_URL, json=payload, headers=headers, stream=True, timeout=180)
    resp.raise_for_status()

    # Parse SSE stream — the COMPLETE event has {"result": {"result": "..."}}
    result_text = None
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        data_str = line[6:]
        if data_str.strip() == "[DONE]":
            break
        try:
            event = json.loads(data_str)
            if not isinstance(event, dict):
                continue
            raw_result = event.get("result")
            if raw_result is None:
                continue
            if isinstance(raw_result, dict):
                result_text = raw_result.get("result", "")
            elif isinstance(raw_result, str):
                result_text = raw_result
        except json.JSONDecodeError:
            continue

    return result_text or None


def _parse_html(html: str, source_url: str) -> dict[str, Any] | None:
    """Parse raw HTML into the downstream company/proposals data contract."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        company = _extract_company_name(soup)
        ticker = _extract_ticker(soup, company, html)
        proposals = _extract_proposals(soup, source_url)
        if not proposals:
            return None
        return {"company": company, "ticker": ticker, "proposals": proposals}
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("Failed to parse HTML for %s: %s", source_url, exc)
        return None


# ===================================================================
# Fallback: requests + BeautifulSoup path
# ===================================================================

def _scrape_all_requests(urls: list[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for url in urls:
        company_data = _scrape_single_request(url)
        if company_data:
            results.append(company_data)
    return results


def _scrape_single_request(url: str) -> dict[str, Any] | None:
    """Fetch and parse a single proxy statement URL with requests + BS4."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        company = _extract_company_name(soup)
        ticker = _extract_ticker(soup, company, response.text)
        proposals = _extract_proposals(soup, url)

        if not proposals:
            LOGGER.warning("No proposals parsed from %s", url)
            return None

        return {
            "company": company,
            "ticker": ticker,
            "proposals": proposals,
        }
    except requests.RequestException as exc:
        LOGGER.warning("Failed to fetch %s: %s", url, exc)
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("Failed to parse %s: %s", url, exc)
    return None


# ===================================================================
# BeautifulSoup helpers (unchanged)
# ===================================================================

def _extract_company_name(soup: BeautifulSoup) -> str:
    entity_tag = soup.find(attrs={"name": re.compile(r"dei:EntityRegistrantName$", re.IGNORECASE)})
    if entity_tag:
        return _normalize_company_name(entity_tag.get_text(" ", strip=True))

    if soup.title and soup.title.string:
        cleaned = TITLE_CLEANUP_PATTERN.sub("", soup.title.string)
        cleaned = cleaned.replace("-", " ").strip()
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned:
            return _normalize_company_name(cleaned)

    return "Unknown Company"


def _extract_ticker(soup: BeautifulSoup, company: str, html: str) -> str:
    trading_symbol = soup.find(attrs={"name": re.compile(r"dei:TradingSymbol$", re.IGNORECASE)})
    if trading_symbol:
        symbol = _normalize_text(trading_symbol.get_text(" ", strip=True)).upper()
        if symbol:
            return symbol

    patterns = [
        r"virtualshareholdermeeting\.com/([A-Z]{1,6})\d{2,4}",
        r'under the symbol ["“]?([A-Z.\-]{1,6})["”]?',
        r"\((?:NASDAQ|NYSE):\s*([A-Z.\-]{1,6})\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    return COMPANY_TICKERS.get(company.lower(), "UNKNOWN")


def _extract_proposals(soup: BeautifulSoup, source_url: str) -> list[dict[str, str]]:
    proposal_targets = _find_proposal_targets(soup)
    if proposal_targets:
        return _extract_target_sections(proposal_targets, source_url)
    return _extract_text_fallback(soup, source_url)


def _find_proposal_targets(soup: BeautifulSoup) -> list[dict[str, Any]]:
    seen_targets: set[str] = set()
    targets: list[dict[str, Any]] = []

    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if not href.startswith("#") or len(href) == 1:
            continue

        parsed = _parse_proposal_heading(anchor.get_text(" ", strip=True))
        if not parsed:
            continue

        target_id = href[1:]
        if target_id in seen_targets:
            continue

        start_tag = soup.find(id=target_id)
        if start_tag is None:
            continue

        parsed["target_id"] = target_id
        parsed["start_tag"] = start_tag
        targets.append(parsed)
        seen_targets.add(target_id)

    return targets


def _extract_target_sections(
    proposal_targets: list[dict[str, Any]],
    source_url: str,
) -> list[dict[str, str]]:
    stop_ids = [target["target_id"] for target in proposal_targets]
    proposals: list[dict[str, str]] = []

    for target in proposal_targets:
        section_text = _collect_section_text(target["start_tag"], target["target_id"], stop_ids)
        if not section_text:
            continue

        proposals.append(
            {
                "id": target["id"],
                "title": target["title"],
                "full_text": section_text,
                "source_url": source_url,
            }
        )

    return proposals


def _collect_section_text(start_tag: Tag, current_id: str, stop_ids: list[str]) -> str:
    parts: list[str] = []
    stop_id_set = set(stop_ids)
    current_length = 0

    for element in start_tag.next_elements:
        if isinstance(element, Tag):
            element_id = element.get("id")
            if element_id and element_id != current_id and element_id in stop_id_set:
                break
            continue

        if not isinstance(element, NavigableString):
            continue

        parent = element.parent
        if parent is None:
            continue

        if parent == start_tag or start_tag in parent.parents:
            continue

        text = _normalize_text(str(element))
        if not text:
            continue
        if parts and parts[-1] == text:
            continue

        parts.append(text)
        current_length += len(text) + 1
        if current_length >= 6000:
            break

    return " ".join(parts)[:6000].strip()


def _extract_text_fallback(soup: BeautifulSoup, source_url: str) -> list[dict[str, str]]:
    text = _normalize_text(soup.get_text("\n", strip=True))
    matches = list(TEXT_PROPOSAL_PATTERN.finditer(text))
    proposals: list[dict[str, str]] = []

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else min(len(text), start + 6000)
        proposal_id = _normalize_proposal_id(match.group("label"))
        title = _normalize_text(match.group("title"))
        full_text = _normalize_text(text[start:end])[:6000]
        if not title or not full_text:
            continue

        proposals.append(
            {
                "id": proposal_id,
                "title": title,
                "full_text": full_text,
                "source_url": source_url,
            }
        )

    return proposals


def _parse_proposal_heading(text: str) -> dict[str, Any] | None:
    normalized = _normalize_text(text)
    match = HEADING_PATTERN.match(normalized)
    if not match:
        return None

    title = _normalize_text(match.group("title"))
    if not title or title.lower() == "shareholder proposals":
        return None

    return {
        "id": _normalize_proposal_id(match.group("label")),
        "title": title,
    }


def _normalize_company_name(name: str) -> str:
    normalized = _normalize_text(name)
    return normalized.title() if normalized.isupper() else normalized


def _normalize_proposal_id(label: str) -> str:
    cleaned = _normalize_text(label).lower()
    return NUMBER_WORDS.get(cleaned, cleaned)


def _normalize_text(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u2009", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()
