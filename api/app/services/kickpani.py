"""킥파니 — 기록 공유 자동 게시 (record_share)."""

import json
from typing import Any
from uuid import UUID

from psycopg import Cursor

from app.services.badges import evaluate_count_badges
from app.services.notifications import create_notification


def _distance_from_data(data: dict[str, Any]) -> int:
    raw = data.get("distance", 0)
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 0


def share_record_to_groups(
    cur: Cursor,
    *,
    user_id: str,
    record_id: UUID,
    record_data: dict[str, Any],
    nickname: str | None,
) -> list[UUID]:
    """Insert record_share posts for each group the user belongs to. Returns post_ids."""
    cur.execute(
        """
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.group_id = gm.group_id
        WHERE gm.user_id = %s AND g.status IN ('active', 'waiting')
        """,
        [user_id],
    )
    groups = cur.fetchall()
    if not groups:
        return []

    distance = _distance_from_data(record_data)
    name = nickname or "회원"
    content = (
        f"{name}님이 오늘 {distance:,}m 수영을 완주했어요! 🏊 "
        f"[기록 보기](/record/{record_id})"
    )
    created_posts: list[UUID] = []

    for row in groups:
        group_id = row["group_id"]
        cur.execute(
            """
            INSERT INTO posts (user_id, sport_type, group_id, category, title, content, tags)
            VALUES (%s, 'swimming', %s, 'record_share', NULL, %s, %s)
            RETURNING post_id
            """,
            [user_id, group_id, content, ["kickpani", "record_share"]],
        )
        post_row = cur.fetchone()
        if post_row is None:
            continue
        post_id = post_row["post_id"]
        created_posts.append(post_id)

        cur.execute(
            """
            SELECT gm.user_id
            FROM group_members gm
            WHERE gm.group_id = %s AND gm.user_id <> %s
            """,
            [group_id, user_id],
        )
        for member in cur.fetchall():
            create_notification(
                cur,
                user_id=str(member["user_id"]),
                noti_type="record_share",
                ref_id=post_id,
                message=f"킥파니: {name}님이 {distance:,}m 수영 기록을 공유했어요.",
            )

    if created_posts:
        evaluate_count_badges(cur, user_id=user_id, condition_type="record_share")

    return created_posts
