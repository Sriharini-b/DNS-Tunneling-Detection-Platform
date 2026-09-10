"""Analyze API endpoints — single, batch CSV, PCAP, history."""
from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.ml.classifier import classify_batch, classify_single
from app.models.models import ScanHistory, UserSettings
from app.schemas.schemas import AnalysisResult, BatchAnalysisResponse, SingleQueryRequest

router = APIRouter()


def _get_thresholds(db: Session):
    s = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if s:
        return s.burst_threshold, s.entropy_threshold, s.beaconing_threshold
    return 50.0, 3.5, 0.1


def _save_scan(db: Session, source_type: str, input_ref: str, result: Dict[str, Any]):
    scan = ScanHistory(
        source_type=source_type,
        input_ref=input_ref,
        risk_score=result.get("risk_score"),
        is_tunneling=result.get("is_tunneling"),
        high_volume_flag=result.get("high_volume_flag", False),
        low_and_slow_flag=result.get("low_and_slow_flag", False),
        evidence_text=result.get("evidence_text"),
        raw_features_json=json.dumps(result.get("raw_features", {})),
        created_at=datetime.utcnow(),
    )
    db.add(scan)
    db.commit()


@router.post("/single", response_model=AnalysisResult)
async def analyze_single(req: SingleQueryRequest, db: Session = Depends(get_db)):
    """Classify a single DNS query record."""
    burst_t, entropy_t, beacon_t = _get_thresholds(db)
    try:
        result = classify_single(
            query_name=req.query_name,
            query_type=req.query_type,
            response_code=req.response_code,
            response_len=req.response_len,
            ttl=req.ttl,
            burst_threshold=burst_t,
            entropy_threshold=entropy_t,
            beaconing_threshold=beacon_t,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    _save_scan(db, "single", req.query_name, result)
    return AnalysisResult(**result)


@router.post("/batch", response_model=BatchAnalysisResponse)
async def analyze_batch(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a CSV file with columns: timestamp, source_ip, query_name, query_type,
    response_code, response_len, ttl. Returns classification for each row.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()
    try:
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        records = [row for row in reader]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    if not records:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    burst_t, entropy_t, beacon_t = _get_thresholds(db)

    try:
        results = classify_batch(
            records,
            burst_threshold=burst_t,
            entropy_threshold=entropy_t,
            beaconing_threshold=beacon_t,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch classification failed: {str(e)}")

    flagged = [r for r in results if r["is_tunneling"]]

    # Save summary scan record
    job_id = str(uuid.uuid4())
    for r in results:
        _save_scan(db, "batch_csv", file.filename, r)

    return BatchAnalysisResponse(
        job_id=job_id,
        total_records=len(results),
        flagged_count=len(flagged),
        results=[AnalysisResult(**r) for r in results],
    )


@router.post("/pcap", response_model=BatchAnalysisResponse)
async def analyze_pcap(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a PCAP/PCAPNG file. Extracts DNS packets and classifies them."""
    import tempfile, os

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()

    # Write to temp file for scapy
    suffix = ".pcap"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    records: List[Dict[str, Any]] = []
    try:
        from scapy.all import rdpcap, DNS, DNSQR
        packets = rdpcap(tmp_path)
        for pkt in packets:
            if pkt.haslayer(DNS) and pkt.haslayer(DNSQR):
                dns_layer = pkt[DNS]
                qr_layer = pkt[DNSQR]
                if dns_layer.qr == 0:  # query (not response)
                    records.append({
                        "query_name": qr_layer.qname.decode(errors="replace").rstrip("."),
                        "query_type": {1: "A", 28: "AAAA", 15: "MX", 16: "TXT", 5: "CNAME",
                                       12: "PTR", 10: "NULL"}.get(qr_layer.qtype, "OTHER"),
                        "response_code": "NOERROR",
                        "response_len": 0,
                        "ttl": 0,
                    })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse PCAP file: {e}")
    finally:
        os.unlink(tmp_path)

    if not records:
        raise HTTPException(status_code=400, detail="No DNS queries found in PCAP")

    burst_t, entropy_t, beacon_t = _get_thresholds(db)
    results = classify_batch(records, burst_threshold=burst_t, entropy_threshold=entropy_t,
                              beaconing_threshold=beacon_t)
    flagged = [r for r in results if r["is_tunneling"]]
    job_id = str(uuid.uuid4())

    for r in results:
        _save_scan(db, "pcap", file.filename, r)

    return BatchAnalysisResponse(
        job_id=job_id,
        total_records=len(results),
        flagged_count=len(flagged),
        results=[AnalysisResult(**r) for r in results],
    )


@router.get("/history")
async def get_history(
    page: int = 1,
    page_size: int = 20,
    only_flagged: bool = False,
    db: Session = Depends(get_db),
):
    """Paginated scan history."""
    query = db.query(ScanHistory)
    if only_flagged:
        query = query.filter(ScanHistory.is_tunneling == True)
    total = query.count()
    items = (
        query.order_by(ScanHistory.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": h.id,
                "source_type": h.source_type,
                "input_ref": h.input_ref,
                "risk_score": h.risk_score,
                "is_tunneling": h.is_tunneling,
                "high_volume_flag": h.high_volume_flag,
                "low_and_slow_flag": h.low_and_slow_flag,
                "evidence_text": h.evidence_text,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in items
        ],
    }
