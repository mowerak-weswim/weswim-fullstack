"""Venue pending → active (T1/T2/T3) and 90-day reject."""

from __future__ import annotations

from uuid import UUID

from psycopg import Cursor

from app.services.notifications import create_notification


def notify_venue_stakeholders(
    cur: Cursor,
    *,
    venue_id: UUID,
    venue_name: str,
    noti_type: str = "venue_activated",
    message: str | None = None,
) -> None:
    default_msg = (
        f"「{venue_name}」이(가) 수영장 목록에 공개됐어요. 다른 회원도 검색할 수 있습니다."
    )
    text = message or default_msg
    cur.execute(
        """
        SELECT DISTINCT user_id FROM venue_requests WHERE venue_id = %s
        UNION
        SELECT created_by FROM venues WHERE venue_id = %s AND created_by IS NOT NULL
        """,
        [venue_id, venue_id],
    )
    for row in cur.fetchall():
        create_notification(
            cur,
            user_id=row["user_id"],
            noti_type=noti_type,
            ref_id=venue_id,
            message=text,
        )


def activate_venue(cur: Cursor, venue_id: UUID) -> bool:
    """Set pending venue to active and notify stakeholders. Idempotent."""
    cur.execute(
        """
        SELECT venue_id, name, status FROM venues WHERE venue_id = %s
        """,
        [venue_id],
    )
    row = cur.fetchone()
    if row is None or row["status"] != "pending":
        return False

    cur.execute(
        """
        UPDATE venues
        SET status = 'active', activated_at = NOW()
        WHERE venue_id = %s AND status = 'pending'
        """,
        [venue_id],
    )
    if cur.rowcount == 0:
        return False

    notify_venue_stakeholders(cur, venue_id=venue_id, venue_name=row["name"])
    return True


def count_distinct_requesters(cur: Cursor, venue_id: UUID) -> int:
    cur.execute(
        """
        SELECT COUNT(DISTINCT user_id) AS count
        FROM venue_requests
        WHERE venue_id = %s
        """,
        [venue_id],
    )
    row = cur.fetchone()
    return int(row["count"]) if row else 0


def try_promote_t1_on_request(
    cur: Cursor,
    *,
    venue_id: UUID,
    requester_id: str,
) -> bool:
    """T1: second distinct requester for same pending venue → active."""
    if count_distinct_requesters(cur, venue_id) < 2:
        return False
    return activate_venue(cur, venue_id)


def try_promote_t2_on_signup(cur: Cursor, *, venue_id: UUID) -> bool:
    """T2: signup step selects pending venue → active."""
    cur.execute(
        "SELECT status FROM venues WHERE venue_id = %s",
        [venue_id],
    )
    row = cur.fetchone()
    if row is None or row["status"] != "pending":
        return False
    return activate_venue(cur, venue_id)


def promote_t3_pending_48h(cur: Cursor) -> int:
    """T3: pending older than 48h (KST calendar day proxy via created_at)."""
    cur.execute(
        f"""
        SELECT venue_id FROM venues
        WHERE status = 'pending'
          AND created_at <= NOW() - INTERVAL '48 hours'
        """
    )
    ids = [row["venue_id"] for row in cur.fetchall()]
    activated = 0
    for venue_id in ids:
        if activate_venue(cur, venue_id):
            activated += 1
    return activated


def reject_pending_90_days(cur: Cursor) -> int:
    cur.execute(
        """
        SELECT venue_id, name FROM venues
        WHERE status = 'pending'
          AND created_at <= NOW() - INTERVAL '90 days'
        """
    )
    rows = cur.fetchall()
    rejected = 0
    for row in rows:
        venue_id = row["venue_id"]
        cur.execute(
            """
            UPDATE venues SET status = 'rejected'
            WHERE venue_id = %s AND status = 'pending'
            """,
            [venue_id],
        )
        if cur.rowcount == 0:
            continue
        rejected += 1
        msg = (
            f"「{row['name']}」등록 요청이 90일 동안 확인되지 않아 종료됐어요. "
            "다시 유사 검색 후 재요청할 수 있습니다."
        )
        cur.execute(
            "SELECT DISTINCT user_id FROM venue_requests WHERE venue_id = %s",
            [venue_id],
        )
        for u in cur.fetchall():
            create_notification(
                cur,
                user_id=u["user_id"],
                noti_type="system",
                ref_id=venue_id,
                message=msg,
            )
    return rejected
