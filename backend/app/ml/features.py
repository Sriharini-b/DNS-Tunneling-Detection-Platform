"""
DNS Tunneling Feature Engineering
Computes all features specified in CY-04 problem statement:
  - Shannon entropy, normalized entropy, n-gram entropy
  - Subdomain features: label count, max/avg label length, digit ratio
  - Vowel/consonant ratio, character diversity
  - Base64/Base32 pattern detection
  - Per-session rolling aggregates (query rate, beaconing, burst)
"""
from __future__ import annotations

import math
import re
import string
from collections import Counter
from typing import Dict, Any, List, Optional


# ── Character / String Entropy ────────────────────────────────────────────────

def shannon_entropy(s: str) -> float:
    """Shannon entropy of a string."""
    if not s:
        return 0.0
    counts = Counter(s)
    length = len(s)
    return -sum(
        (c / length) * math.log2(c / length) for c in counts.values()
    )


def normalized_entropy(s: str) -> float:
    """Shannon entropy normalized to [0, 1] by log2(|alphabet|)."""
    if not s or len(set(s)) <= 1:
        return 0.0
    h = shannon_entropy(s)
    max_h = math.log2(len(set(s)))
    return h / max_h if max_h > 0 else 0.0


def ngram_entropy(s: str, n: int = 2) -> float:
    """Shannon entropy of character n-grams."""
    if len(s) < n:
        return 0.0
    ngrams = [s[i : i + n] for i in range(len(s) - n + 1)]
    return shannon_entropy("".join(ngrams))


# ── Base64 / Base32 Pattern Detection ────────────────────────────────────────

_B64_RE = re.compile(r"^[A-Za-z0-9+/=]{8,}$")
_B32_RE = re.compile(r"^[A-Z2-7=]{8,}$")
_HEX_RE = re.compile(r"^[0-9a-fA-F]{8,}$")


def contains_encoding_pattern(label: str) -> bool:
    """True if the label resembles base64/base32/hex-encoded data."""
    # Strip trailing dots
    label = label.rstrip(".")
    return bool(_B64_RE.match(label) or _B32_RE.match(label) or _HEX_RE.match(label))


# ── Per-Query Feature Extraction ──────────────────────────────────────────────

QUERY_TYPES = ["A", "AAAA", "TXT", "MX", "CNAME", "NULL", "PTR", "OTHER"]


def _get_labels(query_name: str) -> List[str]:
    return [l for l in query_name.rstrip(".").split(".") if l]


def extract_per_query_features(
    query_name: str,
    query_type: str = "A",
    response_code: str = "NOERROR",
    response_len: int = 0,
    ttl: int = 300,
) -> Dict[str, Any]:
    """Extract all per-query features for a single DNS record."""
    labels = _get_labels(query_name)
    full_str = query_name.replace(".", "")

    # Subdomain = leftmost label (everything except the last 2 labels = TLD+domain)
    subdomain = labels[0] if labels else ""
    parent_domain = ".".join(labels[-2:]) if len(labels) >= 2 else query_name

    # Basic string stats
    qlen = len(query_name)
    digits = sum(c.isdigit() for c in full_str)
    letters = sum(c.isalpha() for c in full_str)
    vowels = sum(c in "aeiouAEIOU" for c in full_str)
    consonants = letters - vowels

    label_lengths = [len(l) for l in labels]

    # Query type one-hot
    qt = query_type.upper()
    qt_norm = qt if qt in QUERY_TYPES[:-1] else "OTHER"
    qt_onehot = {f"qt_{t.lower()}": int(qt_norm == t) for t in QUERY_TYPES}

    features: Dict[str, Any] = {
        # Entropy features
        "entropy": shannon_entropy(full_str),
        "normalized_entropy": normalized_entropy(full_str),
        "ngram_entropy_2": ngram_entropy(full_str, 2),
        "ngram_entropy_3": ngram_entropy(full_str, 3),
        "subdomain_entropy": shannon_entropy(subdomain),
        # Label structure
        "label_count": len(labels),
        "max_label_length": max(label_lengths) if label_lengths else 0,
        "avg_label_length": sum(label_lengths) / len(label_lengths) if label_lengths else 0.0,
        # Character ratios
        "query_length": qlen,
        "digit_ratio": digits / len(full_str) if full_str else 0.0,
        "vowel_consonant_ratio": vowels / consonants if consonants > 0 else 0.0,
        # Encoding patterns
        "contains_base64_pattern": int(contains_encoding_pattern(subdomain)),
        # Response features
        "response_len": response_len,
        "ttl": ttl,
        "is_nxdomain": int(response_code.upper() in ("NXDOMAIN", "3")),
        # Metadata (not used as ML features but kept for reporting)
        "_query_name": query_name,
        "_parent_domain": parent_domain,
        "_subdomain": subdomain,
        "_query_type": qt_norm,
    }
    features.update(qt_onehot)
    return features


# ── ML-Ready Feature Vector (numeric only) ────────────────────────────────────

ML_FEATURE_COLS = [
    "entropy",
    "normalized_entropy",
    "ngram_entropy_2",
    "ngram_entropy_3",
    "subdomain_entropy",
    "label_count",
    "max_label_length",
    "avg_label_length",
    "query_length",
    "digit_ratio",
    "vowel_consonant_ratio",
    "contains_base64_pattern",
    "response_len",
    "ttl",
    "is_nxdomain",
    "qt_a",
    "qt_aaaa",
    "qt_txt",
    "qt_mx",
    "qt_cname",
    "qt_null",
    "qt_ptr",
    "qt_other",
]


def features_to_vector(features: Dict[str, Any]) -> List[float]:
    """Return the numeric ML feature vector in the canonical column order."""
    return [float(features.get(col, 0.0)) for col in ML_FEATURE_COLS]


# ── Per-Session / Rolling Aggregate Features ──────────────────────────────────

def compute_session_aggregates(
    records: List[Dict[str, Any]],
    burst_threshold: float = 50.0,
    beaconing_threshold: float = 0.1,
) -> Dict[str, float]:
    """
    Compute rolling window aggregates from a list of query records.
    Each record must have: timestamp (float/epoch), features dict.
    Returns aggregate signals for the whole session.
    """
    import statistics

    if not records:
        return {}

    timestamps = [r.get("timestamp_epoch", 0.0) for r in records]
    entropies = [r.get("features", {}).get("entropy", 0.0) for r in records]
    subdomains = [r.get("features", {}).get("_subdomain", "") for r in records]
    nxdomains = [r.get("features", {}).get("is_nxdomain", 0) for r in records]
    query_types = [r.get("features", {}).get("_query_type", "OTHER") for r in records]

    n = len(records)
    duration_seconds = (max(timestamps) - min(timestamps)) if len(timestamps) > 1 else 1.0
    duration_minutes = duration_seconds / 60.0

    query_rate = n / max(duration_minutes, 1.0)

    unique_subdomains = len(set(subdomains))
    unique_subdomain_ratio = unique_subdomains / n if n > 0 else 0.0

    # Beaconing: compute intervals between consecutive queries, check regularity
    intervals = [
        timestamps[i + 1] - timestamps[i]
        for i in range(len(timestamps) - 1)
        if timestamps[i + 1] > timestamps[i]
    ]
    avg_interval = statistics.mean(intervals) if intervals else 0.0
    interval_stddev = statistics.stdev(intervals) if len(intervals) > 1 else 0.0

    # Burst score: simplified z-score (we compare against a "normal" baseline)
    NORMAL_QUERY_RATE_MEAN = 5.0
    NORMAL_QUERY_RATE_STD = 3.0
    burst_score = (query_rate - NORMAL_QUERY_RATE_MEAN) / NORMAL_QUERY_RATE_STD

    nxdomain_ratio = sum(nxdomains) / n if n > 0 else 0.0

    qt_counts = Counter(query_types)
    qt_entropy = shannon_entropy("".join(query_types))

    avg_entropy = statistics.mean(entropies) if entropies else 0.0

    high_volume_flag = query_rate > burst_threshold or burst_score > 3.0
    # Low-and-slow: regular beaconing (low stddev) + elevated entropy + unique subdomain ratio
    low_and_slow_flag = (
        interval_stddev < beaconing_threshold
        and avg_entropy > 3.0
        and unique_subdomain_ratio > 0.7
    )

    return {
        "query_rate": query_rate,
        "unique_subdomain_count": unique_subdomains,
        "unique_subdomain_ratio": unique_subdomain_ratio,
        "avg_interval_seconds": avg_interval,
        "interval_stddev": interval_stddev,
        "burst_score": burst_score,
        "nxdomain_ratio": nxdomain_ratio,
        "query_type_diversity": qt_entropy,
        "avg_entropy": avg_entropy,
        "high_volume_flag": float(high_volume_flag),
        "low_and_slow_flag": float(low_and_slow_flag),
    }


# ── Plain-English Evidence String ─────────────────────────────────────────────

def build_evidence_string(
    features: Dict[str, Any],
    is_tunneling: bool,
    risk_score: float,
    top_contributors: List[Dict[str, Any]],
    session_agg: Optional[Dict[str, float]] = None,
) -> str:
    """Generate a human-readable explanation for the verdict."""
    verdict = "tunneling/C2" if is_tunneling else "legitimate"
    lines = [f"Classified as {verdict} (risk {risk_score:.0f}/100)."]

    ent = features.get("entropy", 0.0)
    if ent > 3.5:
        lines.append(
            f"High subdomain entropy ({ent:.2f} bits; normal traffic averages ~2.1 bits), "
            "suggesting encoded or random payloads."
        )

    if features.get("contains_base64_pattern"):
        lines.append(
            "Subdomain label matches Base64/Base32/Hex encoding pattern — "
            "common in DNS tunneling tools (iodine, dnscat2)."
        )

    if features.get("qt_txt"):
        lines.append(
            "Query type is TXT, frequently used for data encoding rather than standard name resolution."
        )

    if features.get("qt_null"):
        lines.append(
            "Query type is NULL — rarely used legitimately; associated with DNS tunneling tools."
        )

    if features.get("label_count", 0) > 5:
        lines.append(
            f"Deep subdomain nesting ({features['label_count']} labels) is characteristic of tunneling payloads."
        )

    if session_agg:
        qr = session_agg.get("query_rate", 0)
        if qr > 20:
            lines.append(f"Elevated query rate: {qr:.1f} queries/minute from this source.")

        usr = session_agg.get("unique_subdomain_ratio", 0)
        if usr > 0.7:
            lines.append(
                f"Unique subdomain ratio is {usr:.2f} (near 1.0), consistent with data exfiltration."
            )

        if session_agg.get("low_and_slow_flag"):
            iv = session_agg.get("avg_interval_seconds", 0)
            lines.append(
                f"Regular beaconing detected: average interval {iv:.1f}s with very low variance — "
                "hallmark of automated C2 keep-alive traffic."
            )

    if top_contributors:
        contrib_parts = [
            f"{c['feature']} ({c['value']:.3f})" for c in top_contributors[:3]
        ]
        lines.append(f"Top driving features: {', '.join(contrib_parts)}.")

    if not is_tunneling:
        lines.append("No significant tunneling indicators detected.")

    return " ".join(lines)
