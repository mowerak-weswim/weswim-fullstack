from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.db import get_db_connection

router = APIRouter(prefix="/badges", tags=["badges"])


class BadgeDefinition(BaseModel):
    badge_id: UUID
    category: str
    level: str | None
    condition_type: str
    condition_value: int
    label: str
    icon: str


class UserBadgeItem(BaseModel):
    badge_id: UUID
    label: str
    icon: str
    category: str
    db_category: str
    ui_category: str
    level: str | None
    earned_count: int
    is_master: bool
    earned_at: datetime


class BadgeProgressItem(BaseModel):
    badge_id: UUID
    label: str
    icon: str
    db_category: str
    ui_category: str
    current_value: int
    condition_value: int
    progress_pct: int


class MyBadgesResponse(BaseModel):
    earned: list[UserBadgeItem]
    in_progress: list[BadgeProgressItem]


def _to_ui_category(db_category: str) -> str:
    if db_category in ("distance", "distance_total", "goal"):
        return "distance"
    if db_category == "distance_daily":
        return "daily"
    if db_category in ("attendance", "streak"):
        return "attend"
    return "special"


@router.get("", response_model=list[BadgeDefinition])
def list_badges(
    category: str | None = Query(default=None),
) -> list[BadgeDefinition]:
    query = """
        SELECT badge_id, category, level, condition_type, condition_value, label, icon
        FROM badges
    """
    params: list[object] = []
    if category:
        query += " WHERE category = %s"
        params.append(category)
    query += " ORDER BY category, condition_value"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return [BadgeDefinition(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/my", response_model=MyBadgesResponse)
def my_badges(user_id: str = Depends(get_current_user_id)) -> MyBadgesResponse:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        b.badge_id, b.label, b.icon, b.category, b.level,
                        ub.earned_count, ub.is_master, ub.earned_at
                    FROM user_badges ub
                    JOIN badges b ON b.badge_id = ub.badge_id
                    WHERE ub.user_id = %s
                    ORDER BY ub.earned_at DESC
                    """,
                    [user_id],
                )
                earned = [
                    UserBadgeItem(
                        **row,
                        db_category=row["category"],
                        ui_category=_to_ui_category(row["category"]),
                    )
                    for row in cur.fetchall()
                ]

                cur.execute(
                    """
                    SELECT
                        b.badge_id, b.label, b.icon, b.category,
                        bp.current_value, b.condition_value
                    FROM badge_progress bp
                    JOIN badges b ON b.badge_id = bp.badge_id
                    WHERE bp.user_id = %s
                      AND NOT EXISTS (
                        SELECT 1 FROM user_badges ub
                        WHERE ub.user_id = bp.user_id AND ub.badge_id = bp.badge_id
                      )
                    ORDER BY bp.current_value DESC
                    LIMIT 10
                    """,
                    [user_id],
                )
                in_progress = []
                for row in cur.fetchall():
                    cond = int(row["condition_value"]) or 1
                    current = int(row["current_value"])
                    in_progress.append(
                        BadgeProgressItem(
                            **row,
                            db_category=row["category"],
                            ui_category=_to_ui_category(row["category"]),
                            progress_pct=min(100, round((current / cond) * 100)),
                        )
                    )

                return MyBadgesResponse(earned=earned, in_progress=in_progress)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/users/{target_user_id}", response_model=list[UserBadgeItem])
def user_badges(target_user_id: UUID) -> list[UserBadgeItem]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        b.badge_id, b.label, b.icon, b.category, b.level,
                        ub.earned_count, ub.is_master, ub.earned_at
                    FROM user_badges ub
                    JOIN badges b ON b.badge_id = ub.badge_id
                    WHERE ub.user_id = %s
                    ORDER BY ub.earned_at DESC
                    """,
                    [str(target_user_id)],
                )
                return [
                    UserBadgeItem(
                        **row,
                        db_category=row["category"],
                        ui_category=_to_ui_category(row["category"]),
                    )
                    for row in cur.fetchall()
                ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
