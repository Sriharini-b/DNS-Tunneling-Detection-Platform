"""
OpenRouter API client — proxies chat completions with SSE streaming.
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """You are an expert DNS security analyst integrated into the DNS Tunneling Detection Platform.

When analyzing a domain, you will receive structured context: DNS records, WHOIS data, and a web search summary.
Your job is to produce a structured analysis in the following JSON format ONLY (no markdown wrapper):

{
  "summary": "What the domain/site appears to be (business, CDN, malware C2, parked domain, etc.)",
  "technical_dns_findings": "Key DNS observations: record types present, WHOIS age, notable subdomain patterns",
  "comparison_to_criteria": [
    "Entropy: ...",
    "Query pattern: ...",
    "Subdomain behavior: ...",
    "Query type distribution: ...",
    "WHOIS age: ..."
  ],
  "verdict": "Low|Medium|High",
  "verdict_justification": "One-sentence justification"
}

For general cybersecurity questions (no domain context), respond in plain markdown — helpful, concise, grounded in the CY-04 detection criteria (Shannon entropy, query rate, subdomain behavior, query type distribution, beaconing interval analysis).

IMPORTANT: Never hallucinate IP addresses or DNS records. If data is unavailable, say so explicitly.
"""


async def stream_chat_completion(
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    domain_context: Optional[Dict[str, Any]] = None,
) -> AsyncIterator[str]:
    """
    Stream chat completion tokens from OpenRouter.
    Yields text chunks as they arrive (SSE).
    """
    # Build full message list
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if domain_context:
        ctx_text = _format_domain_context(domain_context)
        full_messages.append({"role": "user", "content": ctx_text})

    full_messages.extend(messages)

    # Sanitize and normalize API key
    api_key = (api_key or "").strip()
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    if api_key.startswith("sk-or-v1") and not api_key.startswith("sk-or-v1-"):
        api_key = "sk-or-v1-" + api_key[8:]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "DNS Tunneling Detection Platform",
    }

    payload = {
        "model": model,
        "messages": full_messages,
        "stream": True,
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            f"{OPENROUTER_BASE}/chat/completions",
            headers=headers,
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                error_body = (await resp.aread()).decode()
                if resp.status_code == 401:
                    raise RuntimeError(
                        f"Authentication failed with OpenRouter (401). Please verify your API key in Settings -> AI Configuration (starts with sk-or-v1-)."
                    )
                raise RuntimeError(
                    f"OpenRouter returned {resp.status_code}: {error_body}"
                )

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def complete_chat(
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    domain_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Non-streaming full completion — collects all chunks."""
    chunks: List[str] = []
    async for chunk in stream_chat_completion(api_key, model, messages, domain_context):
        chunks.append(chunk)
    return "".join(chunks)


def _format_domain_context(ctx: Dict[str, Any]) -> str:
    """Format domain lookup data as structured LLM context."""
    lines = [f"=== DOMAIN INTELLIGENCE CONTEXT: {ctx.get('domain', 'unknown')} ===\n"]

    dns_records = ctx.get("dns_records", [])
    if dns_records:
        lines.append("DNS RECORDS:")
        for r in dns_records[:20]:  # cap at 20 records
            lines.append(f"  {r['record_type']}: {r['value']}")
    else:
        lines.append("DNS RECORDS: None resolved (possible NX domain or timeout)")

    whois = ctx.get("whois", {})
    lines.append("\nWHOIS DATA:")
    lines.append(f"  Registrar: {whois.get('registrar', 'Unknown')}")
    lines.append(f"  Created: {whois.get('creation_date', 'Unknown')}")
    age = whois.get("age_days")
    if age is not None:
        lines.append(f"  Domain age: {age} days")
    lines.append(f"  Org: {whois.get('org', 'Not public')}")

    web = ctx.get("web_summary", "")
    if web:
        lines.append(f"\nWEB SEARCH SUMMARY:\n  {web}")
    else:
        lines.append("\nWEB SEARCH SUMMARY: No results found")

    lines.append("\n=== END CONTEXT ===")
    return "\n".join(lines)


def detect_domain_in_message(message: str) -> Optional[str]:
    """
    Heuristically detect if the user's message contains a domain/URL.
    Returns the extracted domain or None.
    """
    import re

    # Try to find a URL
    url_pattern = re.compile(
        r"(?:https?://)?([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)",
        re.IGNORECASE,
    )
    matches = url_pattern.findall(message)
    for m in matches:
        # Skip very common words that look like domains
        if m.lower() in {"example.com", "localhost", "test.com"}:
            continue
        if "." in m and len(m) > 3:
            return m.lower()
    return None
