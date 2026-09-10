"""Domain lookup endpoint — DNS + WHOIS + web search."""
from fastapi import APIRouter, HTTPException
from app.schemas.schemas import DomainLookupRequest, DomainLookupResult, DnsRecord
from app.services.dns_lookup import full_domain_lookup

router = APIRouter()


@router.post("/domain", response_model=DomainLookupResult)
async def lookup_domain(req: DomainLookupRequest):
    """Perform parallel DNS + WHOIS + web search for a domain."""
    if not req.domain or len(req.domain) < 3:
        raise HTTPException(status_code=400, detail="Please provide a valid domain name")

    try:
        data = await full_domain_lookup(req.domain)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lookup failed: {e}")

    whois = data.get("whois", {})
    return DomainLookupResult(
        domain=data["domain"],
        dns_records=[DnsRecord(**r) for r in data.get("dns_records", [])],
        whois_registrar=whois.get("registrar"),
        whois_creation_date=whois.get("creation_date"),
        whois_age_days=whois.get("age_days"),
        web_summary=data.get("web_summary"),
    )
