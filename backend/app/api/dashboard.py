"""Dashboard summary endpoint."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.models import ScanHistory
from app.schemas.schemas import DashboardSummary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(db: Session = Depends(get_db)):
    total = db.query(ScanHistory).count()
    flagged = db.query(ScanHistory).filter(ScanHistory.is_tunneling == True).count()
    high_volume = db.query(ScanHistory).filter(ScanHistory.high_volume_flag == True).count()
    low_slow = db.query(ScanHistory).filter(ScanHistory.low_and_slow_flag == True).count()

    avg_risk_row = db.query(func.avg(ScanHistory.risk_score)).scalar()
    avg_risk = float(avg_risk_row) if avg_risk_row else 0.0

    # Recent flagged
    recent = (
        db.query(ScanHistory)
        .filter(ScanHistory.is_tunneling == True)
        .order_by(ScanHistory.created_at.desc())
        .limit(10)
        .all()
    )
    recent_flagged = [
        {
            "id": h.id,
            "input_ref": h.input_ref,
            "risk_score": h.risk_score,
            "source_type": h.source_type,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in recent
    ]

    # Risk over time — last 14 days, daily buckets
    cutoff = datetime.utcnow() - timedelta(days=14)
    history_rows = (
        db.query(ScanHistory)
        .filter(ScanHistory.created_at >= cutoff)
        .order_by(ScanHistory.created_at.asc())
        .all()
    )

    # Group by day
    daily: dict = {}
    for h in history_rows:
        if h.created_at:
            day = h.created_at.strftime("%Y-%m-%d")
            if day not in daily:
                daily[day] = {"date": day, "total": 0, "flagged": 0, "avg_risk": []}
            daily[day]["total"] += 1
            if h.is_tunneling:
                daily[day]["flagged"] += 1
            if h.risk_score is not None:
                daily[day]["avg_risk"].append(h.risk_score)

    risk_over_time = []
    for day, data in sorted(daily.items()):
        scores = data.pop("avg_risk")
        data["avg_risk"] = sum(scores) / len(scores) if scores else 0.0
        risk_over_time.append(data)

    # Top offending domains
    from collections import Counter
    domain_counts = Counter(
        h.input_ref for h in db.query(ScanHistory).filter(ScanHistory.is_tunneling == True).all()
        if h.input_ref
    )
    top_offending = [
        {"domain": d, "count": c} for d, c in domain_counts.most_common(10)
    ]

    return DashboardSummary(
        total_scans=total,
        flagged_count=flagged,
        high_volume_count=high_volume,
        low_and_slow_count=low_slow,
        avg_risk_score=avg_risk,
        recent_flagged=recent_flagged,
        risk_over_time=risk_over_time,
        top_offending_domains=top_offending,
    )
