from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.db import get_db_connection

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationItem(BaseModel):
    noti_id: UUID
    user_id: UUID
    type: str
    ref_id: UUID | None
    message: str | None
    is_read: bool
    created_at: datetime


class UnreadCount(BaseModel):
    unread_count: int


@router.get("", response_model=list[NotificationItem])
def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    user_id: str = Depends(get_current_user_id),
) -> list[NotificationItem]:
    query = """
        SELECT noti_id, user_id, type, ref_id, message, is_read, created_at
        FROM notifications
        WHERE user_id = %s
    """
    params: list[object] = [user_id]
    if unread_only:
        query += " AND is_read = FALSE"
    query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return [NotificationItem(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(user_id: str = Depends(get_current_user_id)) -> UnreadCount:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS count FROM notifications
                    WHERE user_id = %s AND is_read = FALSE
                    """,
                    [user_id],
                )
                row = cur.fetchone()
                return UnreadCount(unread_count=int(row["count"]) if row else 0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user_id: str = Depends(get_current_user_id)) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE notifications SET is_read = TRUE WHERE user_id = %s",
                    [user_id],
                )
                conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/{noti_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    noti_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE notifications SET is_read = TRUE
                    WHERE noti_id = %s AND user_id = %s
                    """,
                    [noti_id, user_id],
                )
                conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
