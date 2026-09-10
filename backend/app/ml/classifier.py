"""
ML Classifier — XGBoost-based DNS tunneling detector with SHAP explainability.
Trains on synthetic data if no saved model is found.
"""
from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.ml.features import (
    ML_FEATURE_COLS,
    build_evidence_string,
    compute_session_aggregates,
    extract_per_query_features,
    features_to_vector,
)

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "model.pkl"
EXPLAINER_PATH = Path(__file__).parent / "explainer.pkl"

_CACHED_MODEL = None
_CACHED_EXPLAINER = None


# ── Model Training ─────────────────────────────────────────────────────────────

def train_model():
    """Train XGBoost classifier on synthetic data and save to disk."""
    global _CACHED_MODEL, _CACHED_EXPLAINER
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    import xgboost as xgb
    import shap

    from app.ml.data_gen import generate_dataset

    logger.info("Generating synthetic DNS training dataset...")
    df = generate_dataset(
        n_benign=8000, n_highvolume=1500, n_lowslow=1000, n_exfil=500
    )

    X = df[ML_FEATURE_COLS].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info("Training XGBoost classifier...")
    clf = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    report = classification_report(y_test, clf.predict(X_test))
    logger.info(f"Test set performance:\n{report}")

    # SHAP TreeExplainer
    explainer = shap.TreeExplainer(clf)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(EXPLAINER_PATH, "wb") as f:
        pickle.dump(explainer, f)

    _CACHED_MODEL = clf
    _CACHED_EXPLAINER = explainer

    logger.info(f"Model saved to {MODEL_PATH}")
    return clf, explainer


def ensure_model_ready() -> Tuple[Any, Any]:
    """Load the model if it exists, otherwise train it (cached in memory)."""
    global _CACHED_MODEL, _CACHED_EXPLAINER
    if _CACHED_MODEL is not None and _CACHED_EXPLAINER is not None:
        return _CACHED_MODEL, _CACHED_EXPLAINER

    if MODEL_PATH.exists() and EXPLAINER_PATH.exists():
        logger.info("Loading existing model from disk into cache...")
        with open(MODEL_PATH, "rb") as f:
            _CACHED_MODEL = pickle.load(f)
        with open(EXPLAINER_PATH, "rb") as f:
            _CACHED_EXPLAINER = pickle.load(f)
        return _CACHED_MODEL, _CACHED_EXPLAINER
    else:
        logger.info("No trained model found — training now (this may take 30–60 seconds)...")
        _CACHED_MODEL, _CACHED_EXPLAINER = train_model()
        return _CACHED_MODEL, _CACHED_EXPLAINER


# ── Prediction ─────────────────────────────────────────────────────────────────

def classify_single(
    query_name: str,
    query_type: str = "A",
    response_code: str = "NOERROR",
    response_len: int = 0,
    ttl: int = 300,
    session_records: Optional[List[Dict[str, Any]]] = None,
    burst_threshold: float = 50.0,
    entropy_threshold: float = 3.5,
    beaconing_threshold: float = 0.1,
) -> Dict[str, Any]:
    """Classify a single DNS query and return full result with explanation."""
    clf, explainer = ensure_model_ready()

    features = extract_per_query_features(
        query_name=query_name,
        query_type=query_type,
        response_code=response_code,
        response_len=response_len,
        ttl=ttl,
    )

    x = np.array([features_to_vector(features)])
    proba = clf.predict_proba(x)[0]
    confidence = float(proba[1])
    is_tunneling = confidence >= 0.5

    # SHAP values
    shap_values = explainer.shap_values(x)
    # For binary XGBoost, shap_values may be a list [neg, pos] or just one array
    if isinstance(shap_values, list):
        sv = shap_values[1][0]
    else:
        sv = shap_values[0]

    # Top feature contributions
    contrib_pairs = sorted(
        zip(ML_FEATURE_COLS, sv), key=lambda p: abs(p[1]), reverse=True
    )[:5]
    top_contributors = [
        {
            "feature": col,
            "value": float(features.get(col, 0.0)),
            "impact": float(impact),
        }
        for col, impact in contrib_pairs
    ]

    # Session-level aggregates
    session_agg: Dict[str, float] = {}
    high_volume_flag = False
    low_and_slow_flag = False
    if session_records:
        session_agg = compute_session_aggregates(
            session_records, burst_threshold, beaconing_threshold
        )
        high_volume_flag = bool(session_agg.get("high_volume_flag", 0))
        low_and_slow_flag = bool(session_agg.get("low_and_slow_flag", 0))

    # Rule-based boost
    rule_score = 0.0
    if features.get("entropy", 0) > entropy_threshold:
        rule_score += 20
    if features.get("contains_base64_pattern"):
        rule_score += 15
    if features.get("qt_txt") or features.get("qt_null"):
        rule_score += 10
    if features.get("label_count", 0) > 5:
        rule_score += 10
    if high_volume_flag:
        rule_score += 20
    if low_and_slow_flag:
        rule_score += 15

    risk_score = min(100.0, confidence * 70 + rule_score)

    evidence = build_evidence_string(
        features=features,
        is_tunneling=is_tunneling,
        risk_score=risk_score,
        top_contributors=top_contributors,
        session_agg=session_agg if session_records else None,
    )

    return {
        "query_name": query_name,
        "is_tunneling": is_tunneling,
        "confidence": confidence,
        "risk_score": risk_score,
        "high_volume_flag": high_volume_flag,
        "low_and_slow_flag": low_and_slow_flag,
        "evidence_text": evidence,
        "feature_contributions": top_contributors,
        "raw_features": {k: v for k, v in features.items() if not k.startswith("_")},
    }


def classify_batch(
    records: List[Dict[str, Any]],
    burst_threshold: float = 50.0,
    entropy_threshold: float = 3.5,
    beaconing_threshold: float = 0.1,
) -> List[Dict[str, Any]]:
    """Classify a list of DNS records and return results with explanations."""
    results = []
    for rec in records:
        result = classify_single(
            query_name=rec.get("query_name", ""),
            query_type=rec.get("query_type", "A"),
            response_code=rec.get("response_code", "NOERROR"),
            response_len=int(rec.get("response_len", 0)),
            ttl=int(rec.get("ttl", 300)),
            burst_threshold=burst_threshold,
            entropy_threshold=entropy_threshold,
            beaconing_threshold=beaconing_threshold,
        )
        results.append(result)
    return results
