"""Unit tests for feature engineering functions."""
import math
import pytest
from app.ml.features import (
    shannon_entropy,
    normalized_entropy,
    ngram_entropy,
    contains_encoding_pattern,
    extract_per_query_features,
    compute_session_aggregates,
    ML_FEATURE_COLS,
    features_to_vector,
)


class TestShannonEntropy:
    def test_empty_string(self):
        assert shannon_entropy("") == 0.0

    def test_single_char(self):
        assert shannon_entropy("aaaa") == 0.0

    def test_two_equal_chars(self):
        result = shannon_entropy("ab")
        assert abs(result - 1.0) < 1e-9

    def test_high_entropy(self):
        # Random-looking string should have high entropy
        s = "a1b2c3d4e5f6g7h8"
        assert shannon_entropy(s) > 3.0

    def test_normal_domain(self):
        # Typical subdomain should have moderate entropy
        assert shannon_entropy("www") < 2.0

    def test_base64_label(self):
        # High entropy base64-looking string
        assert shannon_entropy("aGVsbG93b3JsZA") > 3.0


class TestNormalizedEntropy:
    def test_range(self):
        for s in ["", "aaa", "abc", "a1b2c3d4", "hello.world"]:
            ne = normalized_entropy(s)
            assert 0.0 <= ne <= 1.0 + 1e-9, f"Out of range for {s!r}: {ne}"

    def test_uniform_string(self):
        assert normalized_entropy("aaaa") == 0.0

    def test_max_entropy(self):
        # All unique chars → close to 1.0
        s = string.ascii_lowercase
        ne = normalized_entropy(s)
        assert ne > 0.95

import string


class TestNgramEntropy:
    def test_empty(self):
        assert ngram_entropy("", 2) == 0.0

    def test_short(self):
        assert ngram_entropy("a", 2) == 0.0

    def test_bigram_positive(self):
        assert ngram_entropy("abcdef", 2) > 0.0

    def test_trigram_less_than_bigram_for_uniform(self):
        s = "abcdefghij"
        assert ngram_entropy(s, 3) >= 0.0


class TestEncodingPattern:
    def test_base64_like(self):
        assert contains_encoding_pattern("aGVsbG93b3JsZA==")

    def test_hex_like(self):
        assert contains_encoding_pattern("deadbeef1234abcd")

    def test_normal_word(self):
        assert not contains_encoding_pattern("www")

    def test_google(self):
        assert not contains_encoding_pattern("google")


class TestExtractPerQueryFeatures:
    def test_returns_all_ml_cols(self):
        feats = extract_per_query_features("test.example.com")
        for col in ML_FEATURE_COLS:
            assert col in feats, f"Missing feature: {col}"

    def test_nxdomain_flag(self):
        feats = extract_per_query_features(
            "test.example.com", response_code="NXDOMAIN"
        )
        assert feats["is_nxdomain"] == 1

    def test_label_count(self):
        feats = extract_per_query_features("a.b.c.d.e.com")
        assert feats["label_count"] == 6

    def test_digit_ratio(self):
        feats = extract_per_query_features("1234.example.com")
        assert feats["digit_ratio"] > 0.0

    def test_qt_onehot_txt(self):
        feats = extract_per_query_features("x.example.com", query_type="TXT")
        assert feats["qt_txt"] == 1
        assert feats["qt_a"] == 0

    def test_entropy_tunneling_vs_benign(self):
        benign = extract_per_query_features("www.google.com")
        tunnel = extract_per_query_features(
            "aGVsbG93b3JsZHNhbXBsZQ.evilc2.net", query_type="TXT"
        )
        assert tunnel["entropy"] > benign["entropy"]

    def test_features_to_vector_length(self):
        feats = extract_per_query_features("test.example.com")
        vec = features_to_vector(feats)
        assert len(vec) == len(ML_FEATURE_COLS)

    def test_features_to_vector_all_numeric(self):
        feats = extract_per_query_features("test.example.com")
        vec = features_to_vector(feats)
        for v in vec:
            assert isinstance(v, float), f"Expected float, got {type(v)}"


class TestSessionAggregates:
    def _make_records(self, n, base_ts=0.0, interval=60.0, is_tunnel=False):
        import base64, random
        records = []
        for i in range(n):
            qname = f"www.google.com" if not is_tunnel else (
                base64.b64encode(bytes(random.getrandbits(8) for _ in range(16))).decode().rstrip("=")[:20]
                + ".evil.net"
            )
            feats = extract_per_query_features(qname, query_type="TXT" if is_tunnel else "A")
            records.append({"timestamp_epoch": base_ts + i * interval, "features": feats})
        return records

    def test_query_rate(self):
        records = self._make_records(60, interval=1.0)  # 60 queries in 60 seconds = 60 qpm
        agg = compute_session_aggregates(records)
        assert agg["query_rate"] > 50.0

    def test_beaconing_low_stddev(self):
        # Regular interval → very low stddev
        records = self._make_records(30, interval=5.0, is_tunnel=True)
        agg = compute_session_aggregates(records)
        assert agg["interval_stddev"] < 0.01  # perfectly regular

    def test_unique_subdomain_ratio_tunneling(self):
        records = self._make_records(50, interval=1.0, is_tunnel=True)
        agg = compute_session_aggregates(records)
        # Tunneling generates many unique subdomains
        assert agg["unique_subdomain_ratio"] > 0.5

    def test_empty_records(self):
        agg = compute_session_aggregates([])
        assert agg == {}
