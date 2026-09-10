"""
DNS and WHOIS lookup service.
Performs A/AAAA/TXT/MX/NS record resolution and WHOIS data extraction.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


async def lookup_dns_records(domain: str) -> List[Dict[str, str]]:
    """Resolve A, AAAA, TXT, MX, NS records for a domain."""
    try:
        import dns.asyncresolver
        import dns.exception

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 8

        record_types = ["A", "AAAA", "MX", "TXT", "NS"]
        results: List[Dict[str, str]] = []

        for rtype in record_types:
            try:
                answer = await resolver.resolve(domain, rtype)
                for rdata in answer:
                    results.append({
                        "record_type": rtype,
                        "value": str(rdata),
                    })
            except Exception:
                pass  # Record type not available for this domain

        return results
    except Exception as e:
        logger.warning(f"DNS lookup failed for {domain}: {e}")
        return []


def lookup_whois(domain: str) -> Dict[str, Any]:
    """Perform WHOIS lookup and extract key fields."""
    try:
        import whois

        w = whois.whois(domain)
        creation_date = w.creation_date
        if isinstance(creation_date, list):
            creation_date = creation_date[0]

        age_days = None
        creation_str = None
        if creation_date:
            if isinstance(creation_date, datetime):
                age_days = (datetime.now(tz=timezone.utc) - creation_date.replace(tzinfo=timezone.utc)).days
                creation_str = creation_date.isoformat()
            else:
                creation_str = str(creation_date)

        return {
            "registrar": w.registrar,
            "creation_date": creation_str,
            "age_days": age_days,
            "org": w.org,
            "country": w.country,
        }
    except Exception as e:
        logger.warning(f"WHOIS lookup failed for {domain}: {e}")
        return {"registrar": None, "creation_date": None, "age_days": None, "org": None, "country": None}


async def duckduckgo_search(query: str) -> str:
    """
    Free DuckDuckGo Instant Answer API lookup.
    Returns a short summary string about the query.
    """
    try:
        import httpx

        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
            )
            data = resp.json()
            abstract = data.get("AbstractText", "")
            if abstract:
                return abstract
            # Try related topics
            topics = data.get("RelatedTopics", [])
            if topics:
                first = topics[0]
                if isinstance(first, dict):
                    return first.get("Text", "")
            return ""
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        return ""


async def full_domain_lookup(domain: str) -> Dict[str, Any]:
    """
    Perform parallel DNS + WHOIS + web search lookup.
    Returns consolidated result for LLM context.
    """
    # Run DNS async and WHOIS sync (whois library is blocking)
    dns_task = asyncio.create_task(lookup_dns_records(domain))
    search_task = asyncio.create_task(
        duckduckgo_search(f"what is {domain} website used for site reputation")
    )

    # WHOIS is blocking — run in thread pool
    loop = asyncio.get_event_loop()
    whois_result = await loop.run_in_executor(None, lookup_whois, domain)

    dns_records = await dns_task
    web_summary = await search_task

    return {
        "domain": domain,
        "dns_records": dns_records,
        "whois": whois_result,
        "web_summary": web_summary,
    }
