"""Group lane: posts (3 tabs) and schedules (RSVP / vote)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.v1.posts import (
    PostItem,
    _ensure_user_profile,
    _fetch_images,
    _row_to_post_item,
)
from app.core.auth import get_current_user_id
from app.db import get_db_connection

GroupTab = Literal["notice", "chat", "etiquette"]
GROUP_TABS: dict[str, list[str]] = {
    "notice": ["notice"],
    "chat": ["chat", "record_share"],
    "etiquette": ["etiquette"],
}
USER_POST_CATEGORIES = frozenset({"notice", "chat", "etiquette"})
RSVP_RESPONSES = frozenset({"attending", "maybe", "declined"})


class CreateGroupPostRequest(BaseModel):
    category: Literal["notice", "chat", "etiquette"]
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1)
    is_anonymous: bool = False


class VoteOptionItem(BaseModel):
    option_id: UUID
    label: str
    sort_order: int
    vote_count: int


class RsvpCounts(BaseModel):
    attending: int = 0
    maybe: int = 0
    declined: int = 0


class ScheduleItem(BaseModel):
    schedule_id: UUID
    group_id: UUID
    user_id: UUID
    author_nickname: str | None
    type: str
    status: str
    title: str | None
    scheduled_at: datetime | None
    location: str | None
    deadline_at: datetime | None
    created_at: datetime
    is_author: bool = False
    rsvp_counts: RsvpCounts | None = None
    my_rsvp: str | None = None
    vote_options: list[VoteOptionItem] = []
    my_vote_option_id: UUID | None = None
    total_votes: int = 0


class CreateScheduleRequest(BaseModel):
    type: Literal["rsvp", "vote"]
    title: str = Field(min_length=1, max_length=200)
    scheduled_at: datetime | None = None
    location: str | None = Field(default=None, max_length=200)
    deadline_at: datetime | None = None
    vote_options: list[str] = Field(default_factory=list, max_length=8)


class RsvpRequest(BaseModel):
    response: Literal["attending", "maybe", "declined"]


class VoteRequest(BaseModel):
    option_id: UUID


class ConfirmScheduleRequest(BaseModel):
    option_id: UUID
    scheduled_at: datetime | None = None
    location: str | None = None


class ScheduleCommentItem(BaseModel):
    comment_id: UUID
    schedule_id: UUID
    user_id: UUID
    parent_comment_id: UUID | None
    content: str
    created_at: datetime
    nickname: str | None = None


class CreateScheduleCommentRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_comment_id: UUID | None = None


def _require_member(cur, group_id: UUID, user_id: str) -> None:
    cur.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
        [group_id, user_id],
    )
    if cur.fetchone() is None:
        raise HTTPException(status_code=403, detail="Not a group member")


def _mask_anonymous(item: PostItem) -> PostItem:
    if "anonymous" in (item.tags or []):
        item.author = None
    return item


def _hydrate_schedule(
    cur,
    row: dict,
    *,
    viewer_id: str | None,
) -> ScheduleItem:
    schedule_id = row["schedule_id"]
    author_id = str(row["user_id"])
    is_author = viewer_id is not None and author_id == viewer_id

    rsvp_counts = None
    my_rsvp = None
    vote_options: list[VoteOptionItem] = []
    my_vote_option_id = None
    total_votes = 0

    if row["type"] == "rsvp":
        cur.execute(
            """
            SELECT response, COUNT(*) AS count
            FROM schedule_rsvps
            WHERE schedule_id = %s
            GROUP BY response
            """,
            [schedule_id],
        )
        counts = RsvpCounts()
        for r in cur.fetchall():
            key = r["response"]
            if key == "attending":
                counts.attending = int(r["count"])
            elif key == "maybe":
                counts.maybe = int(r["count"])
            elif key == "declined":
                counts.declined = int(r["count"])
        rsvp_counts = counts

        if viewer_id:
            cur.execute(
                """
                SELECT response FROM schedule_rsvps
                WHERE schedule_id = %s AND user_id = %s
                """,
                [schedule_id, viewer_id],
            )
            mine = cur.fetchone()
            if mine:
                my_rsvp = mine["response"]

    if row["type"] == "vote":
        cur.execute(
            """
            SELECT o.id, o.label, o.sort_order,
                   (SELECT COUNT(*) FROM schedule_votes v WHERE v.option_id = o.id) AS vote_count
            FROM schedule_vote_options o
            WHERE o.schedule_id = %s
            ORDER BY o.sort_order ASC, o.label ASC
            """,
            [schedule_id],
        )
        for opt in cur.fetchall():
            count = int(opt["vote_count"])
            total_votes += count
            vote_options.append(
                VoteOptionItem(
                    option_id=opt["id"],
                    label=opt["label"],
                    sort_order=int(opt["sort_order"]),
                    vote_count=count,
                )
            )

        if viewer_id:
            cur.execute(
                """
                SELECT v.option_id
                FROM schedule_votes v
                JOIN schedule_vote_options o ON o.id = v.option_id
                WHERE o.schedule_id = %s AND v.user_id = %s
                """,
                [schedule_id, viewer_id],
            )
            mine = cur.fetchone()
            if mine:
                my_vote_option_id = mine["option_id"]

    return ScheduleItem(
        schedule_id=row["schedule_id"],
        group_id=row["group_id"],
        user_id=row["user_id"],
        author_nickname=row.get("nickname"),
        type=row["type"],
        status=row["status"],
        title=row.get("title"),
        scheduled_at=row.get("scheduled_at"),
        location=row.get("location"),
        deadline_at=row.get("deadline_at"),
        created_at=row["created_at"],
        is_author=is_author,
        rsvp_counts=rsvp_counts,
        my_rsvp=my_rsvp,
        vote_options=vote_options,
        my_vote_option_id=my_vote_option_id,
        total_votes=total_votes,
    )


def register(router: APIRouter) -> None:
    @router.get("/{group_id}/posts", response_model=list[PostItem])
    def list_group_posts(
        group_id: UUID,
        tab: GroupTab = Query(default="chat"),
        limit: int = Query(default=30, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        user_id: str = Depends(get_current_user_id),
    ) -> list[PostItem]:
        categories = GROUP_TABS.get(tab, GROUP_TABS["chat"])
        placeholders = ", ".join(["%s"] * len(categories))

        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        f"""
                        SELECT
                            p.post_id,
                            p.user_id,
                            p.sport_type,
                            p.group_id,
                            p.category,
                            p.title,
                            p.content,
                            p.tags,
                            p.view_count,
                            p.created_at,
                            u.nickname,
                            u.user_type,
                            sp.level,
                            (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id) AS reaction_count,
                            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
                            FALSE AS liked_by_me,
                            FALSE AS bookmarked_by_me
                        FROM posts p
                        LEFT JOIN users u ON u.user_id = p.user_id
                        LEFT JOIN sport_profiles sp
                          ON sp.user_id = p.user_id AND sp.sport_type = 'swimming'
                        WHERE p.group_id = %s
                          AND p.category IN ({placeholders})
                        ORDER BY p.created_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        [group_id, *categories, limit, offset],
                    )
                    rows = cur.fetchall()
                    results: list[PostItem] = []
                    for row in rows:
                        images = _fetch_images(cur, row["post_id"])
                        item = _row_to_post_item(row, images=images)
                        results.append(_mask_anonymous(item))
                    return results
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post(
        "/{group_id}/posts",
        response_model=PostItem,
        status_code=status.HTTP_201_CREATED,
    )
    def create_group_post(
        group_id: UUID,
        body: CreateGroupPostRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> PostItem:
        if body.category not in USER_POST_CATEGORIES:
            raise HTTPException(status_code=422, detail="Invalid group post category")

        tags: list[str] = []
        if body.is_anonymous and body.category == "etiquette":
            tags.append("anonymous")

        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    _ensure_user_profile(cur, user_id)
                    cur.execute(
                        """
                        INSERT INTO posts (
                            user_id, sport_type, group_id, category, title, content, tags
                        )
                        VALUES (%s, 'swimming', %s, %s, %s, %s, %s)
                        RETURNING
                            post_id, user_id, sport_type, group_id, category,
                            title, content, tags, view_count, created_at
                        """,
                        [
                            user_id,
                            group_id,
                            body.category,
                            body.title,
                            body.content.strip(),
                            tags,
                        ],
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise HTTPException(
                            status_code=500, detail="Failed to create post"
                        )

                    cur.execute(
                        """
                        SELECT u.nickname, u.user_type, sp.level
                        FROM users u
                        LEFT JOIN sport_profiles sp
                          ON sp.user_id = u.user_id AND sp.sport_type = 'swimming'
                        WHERE u.user_id = %s
                        """,
                        [user_id],
                    )
                    author = cur.fetchone() or {}
                    row.update(author)
                    row["reaction_count"] = 0
                    row["comment_count"] = 0
                    conn.commit()

                    item = _row_to_post_item(row)
                    return _mask_anonymous(item)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/{group_id}/schedules", response_model=list[ScheduleItem])
    def list_group_schedules(
        group_id: UUID,
        limit: int = Query(default=20, ge=1, le=50),
        user_id: str = Depends(get_current_user_id),
    ) -> list[ScheduleItem]:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT
                            gs.schedule_id, gs.group_id, gs.user_id, gs.type, gs.status,
                            gs.title, gs.scheduled_at, gs.location, gs.deadline_at, gs.created_at,
                            u.nickname
                        FROM group_schedules gs
                        JOIN users u ON u.user_id = gs.user_id
                        WHERE gs.group_id = %s
                          AND gs.status NOT IN ('done')
                        ORDER BY gs.created_at DESC
                        LIMIT %s
                        """,
                        [group_id, limit],
                    )
                    rows = cur.fetchall()
                    return [
                        _hydrate_schedule(cur, row, viewer_id=user_id) for row in rows
                    ]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post(
        "/{group_id}/schedules",
        response_model=ScheduleItem,
        status_code=status.HTTP_201_CREATED,
    )
    def create_group_schedule(
        group_id: UUID,
        body: CreateScheduleRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleItem:
        if body.type == "vote":
            options = [o.strip() for o in body.vote_options if o.strip()]
            if len(options) < 2:
                raise HTTPException(
                    status_code=422,
                    detail="Vote schedules require at least 2 options",
                )
            status_value = "voting"
        else:
            options = []
            status_value = "open"

        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    _ensure_user_profile(cur, user_id)
                    cur.execute(
                        """
                        INSERT INTO group_schedules (
                            group_id, user_id, type, status, title,
                            scheduled_at, location, deadline_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING
                            schedule_id, group_id, user_id, type, status,
                            title, scheduled_at, location, deadline_at, created_at
                        """,
                        [
                            group_id,
                            user_id,
                            body.type,
                            status_value,
                            body.title.strip(),
                            body.scheduled_at,
                            body.location,
                            body.deadline_at,
                        ],
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise HTTPException(
                            status_code=500, detail="Failed to create schedule"
                        )

                    schedule_id = row["schedule_id"]
                    for index, label in enumerate(options):
                        cur.execute(
                            """
                            INSERT INTO schedule_vote_options (schedule_id, label, sort_order)
                            VALUES (%s, %s, %s)
                            """,
                            [schedule_id, label, index],
                        )

                    cur.execute(
                        "SELECT nickname FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    author = cur.fetchone()
                    row["nickname"] = author["nickname"] if author else None
                    conn.commit()
                    return _hydrate_schedule(cur, row, viewer_id=user_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/{group_id}/schedules/{schedule_id}", response_model=ScheduleItem)
    def get_group_schedule(
        group_id: UUID,
        schedule_id: UUID,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleItem:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT
                            gs.schedule_id, gs.group_id, gs.user_id, gs.type, gs.status,
                            gs.title, gs.scheduled_at, gs.location, gs.deadline_at, gs.created_at,
                            u.nickname
                        FROM group_schedules gs
                        JOIN users u ON u.user_id = gs.user_id
                        WHERE gs.schedule_id = %s AND gs.group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )
                    return _hydrate_schedule(cur, row, viewer_id=user_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post(
        "/{group_id}/schedules/{schedule_id}/rsvp", response_model=ScheduleItem
    )
    def submit_schedule_rsvp(
        group_id: UUID,
        schedule_id: UUID,
        body: RsvpRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleItem:
        if body.response not in RSVP_RESPONSES:
            raise HTTPException(status_code=422, detail="Invalid RSVP response")

        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT schedule_id, type, status FROM group_schedules
                        WHERE schedule_id = %s AND group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    sched = cur.fetchone()
                    if sched is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )
                    if sched["type"] != "rsvp":
                        raise HTTPException(
                            status_code=400, detail="Not an RSVP schedule"
                        )
                    if sched["status"] not in ("open",):
                        raise HTTPException(status_code=400, detail="RSVP is closed")

                    cur.execute(
                        """
                        INSERT INTO schedule_rsvps (schedule_id, user_id, response)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (schedule_id, user_id)
                        DO UPDATE SET response = EXCLUDED.response
                        """,
                        [schedule_id, user_id, body.response],
                    )
                    conn.commit()
                    return get_group_schedule(group_id, schedule_id, user_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post(
        "/{group_id}/schedules/{schedule_id}/vote", response_model=ScheduleItem
    )
    def submit_schedule_vote(
        group_id: UUID,
        schedule_id: UUID,
        body: VoteRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleItem:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT schedule_id, type, status FROM group_schedules
                        WHERE schedule_id = %s AND group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    sched = cur.fetchone()
                    if sched is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )
                    if sched["type"] != "vote":
                        raise HTTPException(
                            status_code=400, detail="Not a vote schedule"
                        )
                    if sched["status"] != "voting":
                        raise HTTPException(status_code=400, detail="Voting is closed")

                    cur.execute(
                        """
                        SELECT id FROM schedule_vote_options
                        WHERE id = %s AND schedule_id = %s
                        """,
                        [body.option_id, schedule_id],
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(
                            status_code=404, detail="Vote option not found"
                        )

                    cur.execute(
                        """
                        DELETE FROM schedule_votes
                        WHERE user_id = %s
                          AND option_id IN (
                            SELECT id FROM schedule_vote_options WHERE schedule_id = %s
                          )
                        """,
                        [user_id, schedule_id],
                    )
                    cur.execute(
                        """
                        INSERT INTO schedule_votes (option_id, user_id)
                        VALUES (%s, %s)
                        """,
                        [body.option_id, user_id],
                    )
                    conn.commit()
                    return get_group_schedule(group_id, schedule_id, user_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.patch(
        "/{group_id}/schedules/{schedule_id}/confirm",
        response_model=ScheduleItem,
    )
    def confirm_group_schedule(
        group_id: UUID,
        schedule_id: UUID,
        body: ConfirmScheduleRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleItem:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT schedule_id, user_id, type, status
                        FROM group_schedules
                        WHERE schedule_id = %s AND group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    sched = cur.fetchone()
                    if sched is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )
                    if str(sched["user_id"]) != user_id:
                        raise HTTPException(
                            status_code=403, detail="Only author can confirm"
                        )
                    if sched["type"] != "vote":
                        raise HTTPException(
                            status_code=400, detail="Not a vote schedule"
                        )
                    if sched["status"] != "voting":
                        raise HTTPException(
                            status_code=400, detail="Vote already confirmed"
                        )

                    cur.execute(
                        """
                        SELECT id, label FROM schedule_vote_options
                        WHERE id = %s AND schedule_id = %s
                        """,
                        [body.option_id, schedule_id],
                    )
                    option = cur.fetchone()
                    if option is None:
                        raise HTTPException(
                            status_code=404, detail="Vote option not found"
                        )

                    cur.execute(
                        """
                        UPDATE group_schedules
                        SET status = 'confirmed',
                            title = %s,
                            scheduled_at = COALESCE(%s, scheduled_at),
                            location = COALESCE(%s, location),
                            updated_at = NOW()
                        WHERE schedule_id = %s
                        """,
                        [
                            option["label"],
                            body.scheduled_at,
                            body.location,
                            schedule_id,
                        ],
                    )
                    conn.commit()
                    return get_group_schedule(group_id, schedule_id, user_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get(
        "/{group_id}/schedules/{schedule_id}/comments",
        response_model=list[ScheduleCommentItem],
    )
    def list_schedule_comments(
        group_id: UUID,
        schedule_id: UUID,
        user_id: str = Depends(get_current_user_id),
    ) -> list[ScheduleCommentItem]:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT schedule_id FROM group_schedules
                        WHERE schedule_id = %s AND group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )

                    cur.execute(
                        """
                        SELECT
                            sc.comment_id,
                            sc.schedule_id,
                            sc.user_id,
                            sc.parent_comment_id,
                            sc.content,
                            sc.created_at,
                            u.nickname
                        FROM schedule_comments sc
                        JOIN users u ON u.user_id = sc.user_id
                        WHERE sc.schedule_id = %s
                        ORDER BY sc.created_at ASC
                        """,
                        [schedule_id],
                    )
                    return [ScheduleCommentItem(**row) for row in cur.fetchall()]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post(
        "/{group_id}/schedules/{schedule_id}/comments",
        response_model=ScheduleCommentItem,
        status_code=status.HTTP_201_CREATED,
    )
    def create_schedule_comment(
        group_id: UUID,
        schedule_id: UUID,
        body: CreateScheduleCommentRequest,
        user_id: str = Depends(get_current_user_id),
    ) -> ScheduleCommentItem:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT schedule_id FROM group_schedules
                        WHERE schedule_id = %s AND group_id = %s
                        """,
                        [schedule_id, group_id],
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(
                            status_code=404, detail="Schedule not found"
                        )

                    if body.parent_comment_id:
                        cur.execute(
                            """
                            SELECT comment_id FROM schedule_comments
                            WHERE comment_id = %s AND schedule_id = %s
                            """,
                            [body.parent_comment_id, schedule_id],
                        )
                        if cur.fetchone() is None:
                            raise HTTPException(
                                status_code=404,
                                detail="Parent comment not found",
                            )

                    _ensure_user_profile(cur, user_id)
                    cur.execute(
                        """
                        INSERT INTO schedule_comments
                            (schedule_id, user_id, content, parent_comment_id)
                        VALUES (%s, %s, %s, %s)
                        RETURNING comment_id, schedule_id, user_id,
                                  parent_comment_id, content, created_at
                        """,
                        [
                            schedule_id,
                            user_id,
                            body.content,
                            body.parent_comment_id,
                        ],
                    )
                    row = cur.fetchone()
                    cur.execute(
                        "SELECT nickname FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    nick_row = cur.fetchone()
                    conn.commit()
                    if row is None:
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to create comment",
                        )
                    return ScheduleCommentItem(
                        **row,
                        nickname=nick_row["nickname"] if nick_row else None,
                    )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.delete(
        "/{group_id}/schedules/{schedule_id}/comments/{comment_id}",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    def delete_schedule_comment(
        group_id: UUID,
        schedule_id: UUID,
        comment_id: UUID,
        user_id: str = Depends(get_current_user_id),
    ) -> None:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    _require_member(cur, group_id, user_id)
                    cur.execute(
                        """
                        SELECT user_id FROM schedule_comments
                        WHERE comment_id = %s AND schedule_id = %s
                        """,
                        [comment_id, schedule_id],
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise HTTPException(status_code=404, detail="Comment not found")
                    if str(row["user_id"]) != user_id:
                        raise HTTPException(
                            status_code=403,
                            detail="Only author can delete",
                        )
                    cur.execute(
                        "DELETE FROM schedule_comments WHERE comment_id = %s",
                        [comment_id],
                    )
                    conn.commit()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
