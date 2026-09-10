"""
Pydantic schemas for all API request/response models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Analyze ──────────────────────────────────────────────────────────────────

class SingleQueryRequest(BaseModel):
    query_name: str = Field(..., description="Full DNS query name, e.g. abc.evil.com")
    query_type: str = Field(default="A", description="DNS record type")
    response_code: str = Field(default="NOERROR")
    response_len: int = Field(default=0)
    ttl: int = Field(default=300)
    source_ip: Optional[str] = None
    timestamp: Optional[datetime] = None


class FeatureContribution(BaseModel):
    feature: str
    value: float
    impact: float  # SHAP value


class AnalysisResult(BaseModel):
    query_name: str
    is_tunneling: bool
    confidence: float
    risk_score: float
    high_volume_flag: bool
    low_and_slow_flag: bool
    evidence_text: str
    feature_contributions: List[FeatureContribution]
    raw_features: Dict[str, Any]


class BatchAnalysisResponse(BaseModel):
    job_id: str
    total_records: int
    flagged_count: int
    results: List[AnalysisResult]


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatSessionCreate(BaseModel):
    title: Optional[str] = None


class ChatSessionResponse(BaseModel):
    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    metadata_json: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Settings ─────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    theme_mode: str
    primary_color: str
    accent_color: str
    background_color: str
    font_size: str
    openrouter_model: str
    search_provider: str
    burst_threshold: float
    entropy_threshold: float
    beaconing_threshold: float
    has_api_key: bool  # never return the key itself


class SettingsUpdate(BaseModel):
    theme_mode: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_color: Optional[str] = None
    font_size: Optional[str] = None
    openrouter_api_key: Optional[str] = None  # plaintext from UI; encrypted before storage
    openrouter_model: Optional[str] = None
    search_provider: Optional[str] = None
    burst_threshold: Optional[float] = None
    entropy_threshold: Optional[float] = None
    beaconing_threshold: Optional[float] = None


# ── Lookup ───────────────────────────────────────────────────────────────────

class DomainLookupRequest(BaseModel):
    domain: str


class DnsRecord(BaseModel):
    record_type: str
    value: str


class DomainLookupResult(BaseModel):
    domain: str
    dns_records: List[DnsRecord]
    whois_registrar: Optional[str]
    whois_creation_date: Optional[str]
    whois_age_days: Optional[int]
    web_summary: Optional[str]


# ── Dashboard ────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_scans: int
    flagged_count: int
    high_volume_count: int
    low_and_slow_count: int
    avg_risk_score: float
    recent_flagged: List[Dict[str, Any]]
    risk_over_time: List[Dict[str, Any]]
    top_offending_domains: List[Dict[str, Any]]
