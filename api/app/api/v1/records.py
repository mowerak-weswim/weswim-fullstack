import json
from datetime import date, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id, get_optional_user_id
from app.db import get_db_connection
from app.services.badges import evaluate_after_record
from app.services.kickpani import share_record_to_groups

router = APIRouter(prefix="/records", tags=["records"])


class RecordItem(BaseModel):
    record_id: UUID
    user_id: UUID
    sport_type: str
    record_data: dict[str, Any]
    is_public: str
    recorded_at: date
    created_at: datetime


class CreateRecordRequest(BaseModel):
    sport_type: str = Field(default="swimming", max_length=30)
    record_data: dict[str, Any]
    is_public: str = Field(default="private", pattern="^(private|group|public)$")
    recorded_at: date | None = None


class UpdateRecordRequest(BaseModel):
    record_data: dict[str, Any] | None = None
    is_public: str | None = Field(default=None, pattern="^(private|group|public)$")
    recorded_at: date | None = None


class MonthlyStats(BaseModel):
    year: int
    month: int
    total_distance: int
    swim_days: int
    goal_distance: int
    goal_progress_pct: int


def _distance_from_data(data: dict[str, Any]) -> int:
    raw = data.get("distance", 0)
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 0


def _fetch_record(cur, record_id: UUID) -> dict | None:
    cur.execute(
        """
        SELECT record_id, user_id, sport_type, record_data, is_public, recorded_at, created_at
        FROM records
        WHERE record_id = %s
        """,
        [record_id],
    )
    return cur.fetchone()


def _monthly_stats(cur, user_id: str, year: int, month: int) -> MonthlyStats:
    cur.execute(
        """
        SELECT
            COALESCE(SUM((record_data->>'distance')::int), 0) AS total_distance,
            COUNT(DISTINCT recorded_at) AS swim_days
        FROM records
        WHERE user_id = %s
          AND sport_type = 'swimming'
          AND EXTRACT(YEAR FROM recorded_at) = %s
          AND EXTRACT(MONTH FROM recorded_at) = %s
        """,
        [user_id, year, month],
    )
    row = cur.fetchone() or {}
    total = int(row.get("total_distance") or 0)
    days = int(row.get("swim_days") or 0)

    cur.execute(
        """
        SELECT goal_value FROM user_badge_goals
        WHERE user_id = %s AND goal_type = 'monthly_distance'
        """,
        [user_id],
    )
    goal_row = cur.fetchone()
    goal = int(goal_row["goal_value"]) if goal_row else 25000
    pct = min(100, round((total / goal) * 100)) if goal > 0 else 0

    return MonthlyStats(
        year=year,
        month=month,
        total_distance=total,
        swim_days=days,
        goal_distance=goal,
        goal_progress_pct=pct,
    )


@router.post("", response_model=RecordItem, status_code=status.HTTP_201_CREATED)
def create_record(
    body: CreateRecordRequest,
    user_id: str = Depends(get_current_user_id),
) -> RecordItem:
    recorded_at = body.recorded_at or date.today()
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO records (user_id, sport_type, record_data, is_public, recorded_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s)
                    RETURNING record_id, user_id, sport_type, record_data, is_public, recorded_at, created_at
                    """,
                    [
                        user_id,
                        body.sport_type,
                        json.dumps(body.record_data),
                        body.is_public,
                        recorded_at,
                    ],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=500, detail="Failed to create record")

                if body.is_public == "group":
                    cur.execute(
                        "SELECT nickname FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    user_row = cur.fetchone()
                    share_record_to_groups(
                        cur,
                        user_id=user_id,
                        record_id=row["record_id"],
                        record_data=body.record_data,
                        nickname=user_row["nickname"] if user_row else None,
                    )

                evaluate_after_record(
                    cur,
                    user_id=user_id,
                    record_data=body.record_data,
                    recorded_at=recorded_at,
                )

                conn.commit()
                return RecordItem(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("", response_model=list[RecordItem])
def list_records(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    day: int | None = Query(default=None, ge=1, le=31),
    limit: int = Query(default=50, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
) -> list[RecordItem]:
    today = date.today()
    y = year or today.year
    m = month or today.month

    query = """
        SELECT record_id, user_id, sport_type, record_data, is_public, recorded_at, created_at
        FROM records
        WHERE user_id = %s AND sport_type = 'swimming'
          AND EXTRACT(YEAR FROM recorded_at) = %s
          AND EXTRACT(MONTH FROM recorded_at) = %s
    """
    params: list[object] = [user_id, y, m]

    if day is not None:
        query += " AND EXTRACT(DAY FROM recorded_at) = %s"
        params.append(day)

    query += " ORDER BY recorded_at DESC, created_at DESC LIMIT %s"
    params.append(limit)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return [RecordItem(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/stats/monthly", response_model=MonthlyStats)
def get_monthly_stats(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
) -> MonthlyStats:
    today = date.today()
    y = year or today.year
    m = month or today.month
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                return _monthly_stats(cur, user_id, y, m)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{record_id}", response_model=RecordItem)
def get_record(
    record_id: UUID,
    user_id: str | None = Depends(get_optional_user_id),
) -> RecordItem:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_record(cur, record_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Record not found")
                if row["is_public"] == "private" and str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")
                return RecordItem(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/{record_id}", response_model=RecordItem)
def update_record(
    record_id: UUID,
    body: UpdateRecordRequest,
    user_id: str = Depends(get_current_user_id),
) -> RecordItem:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_record(cur, record_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Record not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")

                record_data = body.record_data if body.record_data is not None else row["record_data"]
                is_public = body.is_public if body.is_public is not None else row["is_public"]
                recorded_at = body.recorded_at if body.recorded_at is not None else row["recorded_at"]

                cur.execute(
                    """
                    UPDATE records
                    SET record_data = %s::jsonb, is_public = %s, recorded_at = %s
                    WHERE record_id = %s
                    RETURNING record_id, user_id, sport_type, record_data, is_public, recorded_at, created_at
                    """,
                    [
                        json.dumps(record_data),
                        is_public,
                        recorded_at,
                        record_id,
                    ],
                )
                updated = cur.fetchone()
                if (
                    updated
                    and is_public == "group"
                    and row["is_public"] != "group"
                ):
                    cur.execute(
                        "SELECT nickname FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    user_row = cur.fetchone()
                    share_record_to_groups(
                        cur,
                        user_id=user_id,
                        record_id=record_id,
                        record_data=record_data,
                        nickname=user_row["nickname"] if user_row else None,
                    )

                conn.commit()
                return RecordItem(**updated)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_record(cur, record_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Record not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")
                cur.execute("DELETE FROM records WHERE record_id = %s", [record_id])
                conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
