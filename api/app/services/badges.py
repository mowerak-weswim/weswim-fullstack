"""Badge progress and awards (MVP)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from psycopg import Cursor

from app.services.notifications import create_notification


def _grant_badge(
    cur: Cursor,
    *,
    user_id: str,
    badge_id: UUID,
    label: str,
    is_new: bool,
) -> None:
    if is_new:
        create_notification(
            cur,
            user_id=user_id,
            noti_type="badge_earned",
            ref_id=badge_id,
            message=f"새 뱃지를 획득했어요: {label}",
        )


def _award_or_increment(
    cur: Cursor,
    *,
    user_id: str,
    badge_id: UUID,
    label: str,
    increment: bool = False,
) -> None:
    cur.execute(
        """
        SELECT id, earned_count, is_master FROM user_badges
        WHERE user_id = %s AND badge_id = %s
        """,
        [user_id, badge_id],
    )
    existing = cur.fetchone()
    if existing:
        if increment:
            new_count = int(existing["earned_count"]) + 1
            cur.execute(
                """
                UPDATE user_badges
                SET earned_count = %s, last_earned_at = NOW()
                WHERE id = %s
                """,
                [new_count, existing["id"]],
            )
        return

    cur.execute(
        """
        INSERT INTO user_badges (user_id, badge_id, earned_count, streak_count)
        VALUES (%s, %s, 1, 1)
        ON CONFLICT (user_id, badge_id) DO NOTHING
        """,
        [user_id, badge_id],
    )
    if cur.rowcount > 0:
        _grant_badge(cur, user_id=user_id, badge_id=badge_id, label=label, is_new=True)


def _set_progress(cur: Cursor, *, user_id: str, badge_id: UUID, value: int) -> None:
    cur.execute(
        """
        INSERT INTO badge_progress (user_id, badge_id, current_value)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id, badge_id)
        DO UPDATE SET current_value = EXCLUDED.current_value, updated_at = NOW()
        """,
        [user_id, badge_id, value],
    )


def _evaluate_threshold_badges(
    cur: Cursor,
    *,
    user_id: str,
    condition_type: str,
    current_value: int,
    increment_on_repeat: bool = False,
) -> None:
    cur.execute(
        """
        SELECT badge_id, label, condition_value, master_threshold
        FROM badges
        WHERE condition_type = %s AND condition_value <= %s
        ORDER BY condition_value ASC
        """,
        [condition_type, current_value],
    )
    for badge in cur.fetchall():
        bid = badge["badge_id"]
        _set_progress(cur, user_id=user_id, badge_id=bid, value=current_value)
        cur.execute(
            "SELECT 1 FROM user_badges WHERE user_id = %s AND badge_id = %s",
            [user_id, bid],
        )
        already = cur.fetchone() is not None
        if not already:
            _award_or_increment(
                cur,
                user_id=user_id,
                badge_id=bid,
                label=badge["label"],
                increment=False,
            )
        elif increment_on_repeat:
            _award_or_increment(
                cur,
                user_id=user_id,
                badge_id=bid,
                label=badge["label"],
                increment=True,
            )


def _count_metric(cur: Cursor, *, user_id: str, condition_type: str) -> int:
    if condition_type == "post_count":
        cur.execute(
            "SELECT COUNT(*) AS c FROM posts WHERE user_id = %s",
            [user_id],
        )
    elif condition_type == "comment_count":
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM comments c
            JOIN posts p ON p.post_id = c.post_id
            WHERE c.user_id = %s
            """,
            [user_id],
        )
    elif condition_type == "record_share":
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM posts
            WHERE user_id = %s AND category = 'record_share'
            """,
            [user_id],
        )
    else:
        return 0
    row = cur.fetchone()
    return int(row["c"]) if row else 0


def evaluate_count_badges(cur: Cursor, *, user_id: str, condition_type: str) -> None:
    value = _count_metric(cur, user_id=user_id, condition_type=condition_type)
    _evaluate_threshold_badges(
        cur,
        user_id=user_id,
        condition_type=condition_type,
        current_value=value,
        increment_on_repeat=False,
    )


def evaluate_after_record(
    cur: Cursor,
    *,
    user_id: str,
    record_data: dict,
    recorded_at: date,
) -> None:
    distance = 0
    raw = record_data.get("distance", 0)
    try:
        distance = max(0, int(raw))
    except (TypeError, ValueError):
        pass

    cur.execute(
        """
        SELECT COALESCE(SUM((record_data->>'distance')::int), 0) AS total
        FROM records
        WHERE user_id = %s AND sport_type = 'swimming'
        """,
        [user_id],
    )
    total_row = cur.fetchone()
    total_distance = int(total_row["total"]) if total_row else 0

    _evaluate_threshold_badges(
        cur,
        user_id=user_id,
        condition_type="distance_total",
        current_value=total_distance,
    )

    if distance > 0:
        _evaluate_threshold_badges(
            cur,
            user_id=user_id,
            condition_type="distance_daily",
            current_value=distance,
            increment_on_repeat=True,
        )

    cur.execute(
        """
        SELECT COALESCE(SUM((record_data->>'distance')::int), 0) AS total
        FROM records
        WHERE user_id = %s AND sport_type = 'swimming'
          AND EXTRACT(YEAR FROM recorded_at) = %s
          AND EXTRACT(MONTH FROM recorded_at) = %s
        """,
        [user_id, recorded_at.year, recorded_at.month],
    )
    monthly = int(cur.fetchone()["total"])
    _evaluate_threshold_badges(
        cur,
        user_id=user_id,
        condition_type="monthly_distance",
        current_value=monthly,
    )

    cur.execute(
        """
        SELECT COUNT(DISTINCT recorded_at) AS days
        FROM records
        WHERE user_id = %s AND sport_type = 'swimming'
          AND EXTRACT(YEAR FROM recorded_at) = %s
          AND EXTRACT(MONTH FROM recorded_at) = %s
        """,
        [user_id, recorded_at.year, recorded_at.month],
    )
    swim_days = int(cur.fetchone()["days"])
    _evaluate_threshold_badges(
        cur,
        user_id=user_id,
        condition_type="swim_days",
        current_value=swim_days,
    )


def evaluate_monthly_attendance_goals(cur: Cursor) -> int:
    """Batch: users who met monthly_distance goal in user_badge_goals."""
    cur.execute(
        """
        SELECT ubg.user_id, ubg.goal_value
        FROM user_badge_goals ubg
        WHERE ubg.goal_type = 'monthly_distance'
        """
    )
    awarded = 0
    today = date.today()
    for row in cur.fetchall():
        uid = str(row["user_id"])
        goal = int(row["goal_value"])
        cur.execute(
            """
            SELECT COALESCE(SUM((record_data->>'distance')::int), 0) AS total
            FROM records
            WHERE user_id = %s AND sport_type = 'swimming'
              AND EXTRACT(YEAR FROM recorded_at) = %s
              AND EXTRACT(MONTH FROM recorded_at) = %s
            """,
            [uid, today.year, today.month],
        )
        total = int(cur.fetchone()["total"])
        if total >= goal:
            cur.execute(
                """
                SELECT badge_id, label FROM badges
                WHERE condition_type = 'goal_distance' AND condition_value <= 1
                LIMIT 1
                """,
            )
            badge = cur.fetchone()
            if badge:
                cur.execute(
                    "SELECT 1 FROM user_badges WHERE user_id = %s AND badge_id = %s",
                    [uid, badge["badge_id"]],
                )
                if cur.fetchone() is None:
                    _award_or_increment(
                        cur,
                        user_id=uid,
                        badge_id=badge["badge_id"],
                        label=badge["label"],
                    )
                    awarded += 1
    return awarded
