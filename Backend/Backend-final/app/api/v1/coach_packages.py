# app/api/v1/coach_packages.py
"""
Coach-side endpoints for managing their own packages.
  POST   /coaches/me/packages         - create package (status='pending')
  GET    /coaches/me/packages         - list own packages (all statuses)
  PUT    /coaches/me/packages/{id}    - edit own package (resets status to 'pending')
  DELETE /coaches/me/packages/{id}    - soft-delete (is_active=False)
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.coach import Coach
from app.models.coach_package import CoachPackage
from app.models.subscription import Subscription

router = APIRouter(prefix="/coaches", tags=["Coach Packages"])


# ── helpers ────────────────────────────────────────────────────────────────

def _pkg_to_dict(pkg: CoachPackage, subscriber_count: int = 0) -> dict:
    features = pkg.features
    if features:
        try:
            features = json.loads(features)
        except Exception:
            features = [f.strip() for f in features.split(",") if f.strip()]
    else:
        features = []

    return {
        "id": pkg.id,
        "coach_id": pkg.coach_id,
        "package_name": pkg.package_name,
        "period": pkg.period,
        "sessions": pkg.sessions,
        "price": pkg.price,
        "original_price": pkg.original_price,
        "savings": pkg.savings,
        "price_per_session": pkg.price_per_session,
        "features": features,
        "is_popular": pkg.is_popular,
        "color": pkg.color,
        "is_active": pkg.is_active,
        "status": pkg.status or "pending",
        "rejection_reason": pkg.rejection_reason,
        "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
        "subscriber_count": subscriber_count,
    }


def _require_coach(current_user: User, db: Session) -> Coach:
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    coach = db.query(Coach).filter(Coach.user_id == current_user.id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    return coach


# ── Pydantic schemas ────────────────────────────────────────────────────────

class PackageCreate(BaseModel):
    package_name: str
    sessions: int
    price: float
    period: Optional[str] = None
    original_price: Optional[float] = None
    features: Optional[List[str]] = None
    is_popular: bool = False
    color: str = "blue"


class PackageUpdate(BaseModel):
    package_name: Optional[str] = None
    sessions: Optional[int] = None
    price: Optional[float] = None
    period: Optional[str] = None
    original_price: Optional[float] = None
    features: Optional[List[str]] = None
    is_popular: Optional[bool] = None
    color: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/me/packages", status_code=201)
def create_package(
    data: PackageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach = _require_coach(current_user, db)

    price_per_session = round(data.price / data.sessions, 2) if data.sessions else None
    savings = round(data.original_price - data.price, 2) if data.original_price else None
    features_json = json.dumps(data.features) if data.features else None

    pkg = CoachPackage(
        coach_id=coach.id,
        package_name=data.package_name,
        sessions=data.sessions,
        price=data.price,
        period=data.period,
        original_price=data.original_price,
        savings=savings,
        price_per_session=price_per_session,
        features=features_json,
        is_popular=data.is_popular,
        color=data.color,
        is_active=True,
        status="pending",
        rejection_reason=None,
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return _pkg_to_dict(pkg)


@router.get("/me/packages")
def list_my_packages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach = _require_coach(current_user, db)
    packages = db.query(CoachPackage).filter(CoachPackage.coach_id == coach.id).all()
    result = []
    for p in packages:
        count = db.query(Subscription).filter(
            Subscription.coach_package_id == p.id,
            Subscription.status == "active",
        ).count()
        result.append(_pkg_to_dict(p, subscriber_count=count))
    return result


@router.put("/me/packages/{pkg_id}")
def update_package(
    pkg_id: int,
    data: PackageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach = _require_coach(current_user, db)
    pkg = db.query(CoachPackage).filter(
        CoachPackage.id == pkg_id,
        CoachPackage.coach_id == coach.id,
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    if data.package_name is not None:
        pkg.package_name = data.package_name
    if data.sessions is not None:
        pkg.sessions = data.sessions
    if data.price is not None:
        pkg.price = data.price
    if data.period is not None:
        pkg.period = data.period
    if data.original_price is not None:
        pkg.original_price = data.original_price
        pkg.savings = round(data.original_price - (data.price or pkg.price), 2)
    if data.features is not None:
        pkg.features = json.dumps(data.features)
    if data.is_popular is not None:
        pkg.is_popular = data.is_popular
    if data.color is not None:
        pkg.color = data.color

    # Recalculate derived fields
    sessions = data.sessions or pkg.sessions
    price = data.price or pkg.price
    if sessions and price:
        pkg.price_per_session = round(price / sessions, 2)

    # Reset to pending for re-approval
    pkg.status = "pending"
    pkg.rejection_reason = None

    db.commit()
    db.refresh(pkg)
    return _pkg_to_dict(pkg)


@router.delete("/me/packages/{pkg_id}", status_code=204)
def delete_package(
    pkg_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach = _require_coach(current_user, db)
    pkg = db.query(CoachPackage).filter(
        CoachPackage.id == pkg_id,
        CoachPackage.coach_id == coach.id,
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    pkg.is_active = False
    db.commit()
