"""
Synthetic DNS dataset generator.
Generates realistic benign DNS traffic and multiple tunneling patterns:
  - High-volume DNS tunneling (iodine/dnscat2-style)
  - Low-and-slow beaconing
  - Data exfiltration via TXT/NULL queries
"""
from __future__ import annotations

import random
import string
import base64
import math
from typing import List, Dict, Any
import pandas as pd
import numpy as np


RNG = random.Random(42)
NP_RNG = np.random.default_rng(42)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _random_label(length: int, charset: str = string.ascii_lowercase) -> str:
    return "".join(RNG.choices(charset, k=length))


def _random_domain() -> str:
    """Normal looking domain like google.com, amazon-cdn.net"""
    tlds = ["com", "net", "org", "io", "co", "edu", "gov"]
    names = [
        "google", "amazon", "cloudflare", "fastly", "akamai",
        "microsoft", "apple", "github", "twitter", "facebook",
        "netflix", "spotify", "adobe", "salesforce", "oracle",
    ]
    return f"{RNG.choice(names)}.{RNG.choice(tlds)}"


def _b64_label(byte_count: int = 16) -> str:
    """Base64-encoded random bytes — simulates tunneling payload."""
    raw = bytes(RNG.getrandbits(8) for _ in range(byte_count))
    encoded = base64.b64encode(raw).decode().rstrip("=").replace("+", "").replace("/", "")
    return encoded[:RNG.randint(20, 50)]


def _hex_label(byte_count: int = 12) -> str:
    """Hex-encoded random bytes."""
    raw = bytes(RNG.getrandbits(8) for _ in range(byte_count))
    return raw.hex()[:RNG.randint(16, 40)]


# ── Benign Record Generation ────────────────────────────────────────────────────

def _generate_benign_record() -> Dict[str, Any]:
    domain = _random_domain()
    parts = domain.split(".")

    record_type = RNG.choices(
        ["A", "AAAA", "CNAME", "MX", "TXT", "PTR"],
        weights=[60, 10, 15, 8, 5, 2],
    )[0]

    # Realistic subdomain
    subdomains = ["www", "mail", "api", "cdn", "static", "images", "app", "login"]
    sub = RNG.choice(subdomains + [""])
    query = f"{sub}.{domain}" if sub else domain

    return {
        "query_name": query,
        "query_type": record_type,
        "response_code": "NOERROR",
        "response_len": RNG.randint(20, 512),
        "ttl": RNG.choice([60, 300, 600, 3600, 86400]),
        "label": 0,  # benign
    }


# ── High-Volume Tunneling Record Generation ─────────────────────────────────────

def _generate_highvolume_record() -> Dict[str, Any]:
    """Iodine/dnscat2-style: long base64 subdomains, TXT/NULL queries, many per second."""
    parent = _random_domain()
    sub = _b64_label(RNG.randint(12, 24))
    query = f"{sub}.{parent}"

    return {
        "query_name": query,
        "query_type": RNG.choices(["TXT", "NULL", "CNAME", "A"], weights=[50, 20, 20, 10])[0],
        "response_code": RNG.choices(["NOERROR", "NXDOMAIN"], weights=[80, 20])[0],
        "response_len": RNG.randint(100, 512),
        "ttl": RNG.randint(0, 10),
        "label": 1,  # tunneling
    }


# ── Low-and-Slow Tunneling Record Generation ────────────────────────────────────

def _generate_lowslow_record() -> Dict[str, Any]:
    """Regular beacon: short encoded subdomain, very regular timing, low rate."""
    parent = _random_domain()
    # Short hex or b32 label
    sub = _hex_label(RNG.randint(4, 8))
    # Sometimes multi-level
    if RNG.random() < 0.3:
        sub2 = _hex_label(RNG.randint(4, 6))
        query = f"{sub}.{sub2}.{parent}"
    else:
        query = f"{sub}.{parent}"

    return {
        "query_name": query,
        "query_type": RNG.choices(["TXT", "A", "NULL"], weights=[40, 40, 20])[0],
        "response_code": "NOERROR",
        "response_len": RNG.randint(50, 200),
        "ttl": RNG.randint(1, 60),
        "label": 1,  # tunneling
    }


# ── Exfiltration Record Generation ─────────────────────────────────────────────

def _generate_exfil_record() -> Dict[str, Any]:
    """Data exfiltration: very long queries, deep nesting, high entropy labels."""
    parent = _random_domain()
    # Encode data across multiple labels
    chunk1 = _b64_label(RNG.randint(20, 40))
    chunk2 = _hex_label(RNG.randint(10, 20))
    seq = RNG.randint(0, 999)
    query = f"{chunk1}.{chunk2}.{seq}.{parent}"

    return {
        "query_name": query,
        "query_type": RNG.choices(["TXT", "NULL", "MX"], weights=[60, 30, 10])[0],
        "response_code": RNG.choices(["NOERROR", "NXDOMAIN"], weights=[70, 30])[0],
        "response_len": RNG.randint(200, 512),
        "ttl": RNG.randint(0, 5),
        "label": 1,  # tunneling
    }


# ── Dataset Generation ──────────────────────────────────────────────────────────

def generate_dataset(
    n_benign: int = 8000,
    n_highvolume: int = 1500,
    n_lowslow: int = 1000,
    n_exfil: int = 500,
) -> pd.DataFrame:
    """
    Generate a labeled synthetic DNS dataset.
    Returns a DataFrame with all per-query features + label column.
    """
    from app.ml.features import extract_per_query_features, ML_FEATURE_COLS

    records = []

    generators = [
        (_generate_benign_record, n_benign),
        (_generate_highvolume_record, n_highvolume),
        (_generate_lowslow_record, n_lowslow),
        (_generate_exfil_record, n_exfil),
    ]

    for gen_fn, count in generators:
        for _ in range(count):
            raw = gen_fn()
            feats = extract_per_query_features(
                query_name=raw["query_name"],
                query_type=raw["query_type"],
                response_code=raw["response_code"],
                response_len=raw["response_len"],
                ttl=raw["ttl"],
            )
            row = {col: feats.get(col, 0.0) for col in ML_FEATURE_COLS}
            row["label"] = raw["label"]
            records.append(row)

    df = pd.DataFrame(records)
    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


if __name__ == "__main__":
    print("Generating synthetic DNS dataset...")
    df = generate_dataset()
    print(f"Dataset shape: {df.shape}")
    print(f"Label distribution:\n{df['label'].value_counts()}")
    df.to_csv("synthetic_dns_dataset.csv", index=False)
    print("Saved to synthetic_dns_dataset.csv")
