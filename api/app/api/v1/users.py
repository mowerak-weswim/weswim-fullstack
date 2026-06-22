import json
from datetime import date, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.v1.posts import PostItem, _engagement_joins, _fetch_images, _row_to_post_item
from app.core.auth import get_current_user_id, get_optional_user_id
from app.db import get_db_connection
from app.services.venue_promotion import try_promote_t2_on_signup

router = APIRouter(prefix="/users", tags=["users"])

SWIM_LEVELS = frozenset(
    {
        "beginner_1",
        "beginner_2",
        "intermediate",
        "advanced",
    }
)


class UserProfile(BaseModel):
    user_id: UUID
    email: str
    nickname: str
    user_type: str
    created_at: datetime
    level: str | None = None
    bio: str | None = None
    notification_prefs: dict[str, Any] | None = None


class UpdateMeRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=2, max_length=20)
    level: str | None = None
    user_type: str | None = Field(default=None, pattern="^(member|instructor)$")
    bio: str | None = Field(default=None, max_length=100)
    notification_prefs: dict[str, bool] | None = None


class CreateProfileRequest(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)
    user_type: str = Field(default="member", pattern="^(member|instructor)$")
    signup_venue_id: UUID | None = None
    referrer_user_id: UUID | None = None


class GroupMembership(BaseModel):
    group_id: UUID
    venue_name: str | None
    level: str
    schedule: dict[str, Any]
    status: str
    role: str


class PublicUserSummary(BaseModel):
    swim_days: int
    total_distance: int
    post_count: int


class PublicRecordItem(BaseModel):
    record_id: UUID
    record_data: dict[str, Any]
    recorded_at: date


class PublicGroupItem(BaseModel):
    group_id: UUID
    venue_name: str | None
    level: str
    status: str


def _fetch_user(cur, user_id: str) -> dict | None:
    cur.execute(
        """
        SELECT
            u.user_id,
            u.email,
            u.nickname,
            u.user_type,
            u.created_at,
            sp.level,
            u.bio,
            u.notification_prefs
        FROM users u
        LEFT JOIN sport_profiles sp
          ON sp.user_id = u.user_id AND sp.sport_type = 'swimming'
        WHERE u.user_id = %s
        """,
        [user_id],
    )
    row = cur.fetchone()
    if row is None:
        return None
    prefs = row.get("notification_prefs")
    if isinstance(prefs, str):
        row["notification_prefs"] = json.loads(prefs)
    return row


@router.post("/profile", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: CreateProfileRequest,
    user_id: str = Depends(get_current_user_id),
) -> UserProfile:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if _fetch_user(cur, user_id):
                    raise HTTPException(status_code=409, detail="Profile already exists")

                cur.execute(
                    "SELECT user_id FROM users WHERE nickname = %s",
                    [body.nickname],
                )
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Nickname already taken")

                cur.execute(
                    """
                    INSERT INTO users (user_id, email, nickname, user_type)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [user_id, f"{user_id}@local", body.nickname, body.user_type],
                )

                cur.execute(
                    """
                    INSERT INTO sport_profiles (user_id, sport_type, level)
                    VALUES (%s, 'swimming', 'beginner_1')
                    ON CONFLICT (user_id, sport_type) DO NOTHING
                    """,
                    [user_id],
                )

                if body.signup_venue_id is not None:
                    if body.referrer_user_id is not None:
                        cur.execute(
                            "SELECT 1 FROM users WHERE user_id = %s",
                            [str(body.referrer_user_id)],
                        )
                        if cur.fetchone() is None:
                            raise HTTPException(
                                status_code=422,
                                detail="Invalid referrer user",
                            )
                    try_promote_t2_on_signup(cur, venue_id=body.signup_venue_id)

                conn.commit()

                row = _fetch_user(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=500, detail="Failed to create profile")
                return UserProfile(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {exc}") from exc


@router.get("/check-nickname")
def check_nickname(nickname: str = Query(min_length=2, max_length=20)) -> dict[str, bool]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM users WHERE nickname = %s",
                    [nickname],
                )
                return {"available": cur.fetchone() is None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/me", response_model=UserProfile)
def get_me(user_id: str = Depends(get_current_user_id)) -> UserProfile:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Profile not found")
                return UserProfile(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user_id: str = Depends(get_current_user_id)) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Ensure local profile row is removed even if auth cascade is unavailable.
                cur.execute("DELETE FROM users WHERE user_id = %s", [user_id])
                # Supabase auth account hard-delete.
                cur.execute("DELETE FROM auth.users WHERE id = %s::uuid", [user_id])
                conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {exc}") from exc


@router.patch("/me", response_model=UserProfile)
def update_me(
    body: UpdateMeRequest,
    user_id: str = Depends(get_current_user_id),
) -> UserProfile:
    if (
        body.nickname is None
        and body.level is None
        and body.user_type is None
        and body.bio is None
        and body.notification_prefs is None
    ):
        raise HTTPException(status_code=400, detail="No fields to update")

    if body.level is not None and body.level not in SWIM_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid swimming level")

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if body.nickname is not None:
                    cur.execute(
                        "SELECT user_id FROM users WHERE nickname = %s AND user_id <> %s",
                        [body.nickname, user_id],
                    )
                    if cur.fetchone():
                        raise HTTPException(status_code=409, detail="Nickname already taken")
                    cur.execute(
                        """
                        UPDATE users
                        SET nickname = %s, updated_at = NOW()
                        WHERE user_id = %s
                        """,
                        [body.nickname, user_id],
                    )

                if body.user_type is not None:
                    cur.execute(
                        """
                        UPDATE users
                        SET user_type = %s, updated_at = NOW()
                        WHERE user_id = %s
                        """,
                        [body.user_type, user_id],
                    )

                if body.bio is not None:
                    normalized_bio = body.bio.strip() or None
                    cur.execute(
                        """
                        UPDATE users
                        SET bio = %s, updated_at = NOW()
                        WHERE user_id = %s
                        """,
                        [normalized_bio, user_id],
                    )

                if body.level is not None:
                    cur.execute(
                        """
                        INSERT INTO sport_profiles (user_id, sport_type, level)
                        VALUES (%s, 'swimming', %s)
                        ON CONFLICT (user_id, sport_type)
                        DO UPDATE SET level = EXCLUDED.level
                        """,
                        [user_id, body.level],
                    )

                if body.notification_prefs is not None:
                    cur.execute(
                        "SELECT notification_prefs FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    current_row = cur.fetchone()
                    if current_row is None:
                        raise HTTPException(status_code=404, detail="Profile not found")
                    current = current_row.get("notification_prefs") or {}
                    if isinstance(current, str):
                        current = json.loads(current)
                    merged = {**current, **body.notification_prefs}
                    if "system" not in merged:
                        merged["system"] = True
                    cur.execute(
                        """
                        UPDATE users
                        SET notification_prefs = %s::jsonb, updated_at = NOW()
                        WHERE user_id = %s
                        """,
                        [json.dumps(merged), user_id],
                    )

                conn.commit()
                row = _fetch_user(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Profile not found")
                return UserProfile(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/me/groups", response_model=list[GroupMembership])
def get_my_groups(user_id: str = Depends(get_current_user_id)) -> list[GroupMembership]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        g.group_id,
                        v.name AS venue_name,
                        g.level,
                        g.schedule,
                        g.status,
                        gm.role
                    FROM group_members gm
                    JOIN groups g ON g.group_id = gm.group_id
                    LEFT JOIN venues v ON v.venue_id = g.venue_id
                    WHERE gm.user_id = %s
                    ORDER BY gm.joined_at DESC
                    """,
                    [user_id],
                )
                return [GroupMembership(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _require_user(cur, user_id: str) -> None:
    cur.execute("SELECT 1 FROM users WHERE user_id = %s", [user_id])
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="User not found")


@router.get("/{target_user_id}/summary", response_model=PublicUserSummary)
def get_user_summary(target_user_id: UUID) -> PublicUserSummary:
    uid = str(target_user_id)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_user(cur, uid)
                cur.execute(
                    """
                    SELECT
                        COALESCE(SUM((record_data->>'distance')::int), 0) AS total_distance,
                        COUNT(DISTINCT recorded_at) AS swim_days
                    FROM records
                    WHERE user_id = %s
                      AND sport_type = 'swimming'
                      AND is_public = 'public'
                    """,
                    [uid],
                )
                rec = cur.fetchone() or {}
                cur.execute(
                    """
                    SELECT COUNT(*) AS post_count
                    FROM posts
                    WHERE user_id = %s AND group_id IS NULL
                    """,
                    [uid],
                )
                post_row = cur.fetchone() or {}
                return PublicUserSummary(
                    swim_days=int(rec.get("swim_days") or 0),
                    total_distance=int(rec.get("total_distance") or 0),
                    post_count=int(post_row.get("post_count") or 0),
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{target_user_id}/records", response_model=list[PublicRecordItem])
def get_user_public_records(
    target_user_id: UUID,
    limit: int = Query(default=5, ge=1, le=20),
) -> list[PublicRecordItem]:
    uid = str(target_user_id)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_user(cur, uid)
                cur.execute(
                    """
                    SELECT record_id, record_data, recorded_at
                    FROM records
                    WHERE user_id = %s
                      AND sport_type = 'swimming'
                      AND is_public = 'public'
                    ORDER BY recorded_at DESC, created_at DESC
                    LIMIT %s
                    """,
                    [uid, limit],
                )
                return [PublicRecordItem(**row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{target_user_id}/posts", response_model=list[PostItem])
def get_user_posts(
    target_user_id: UUID,
    limit: int = Query(default=10, ge=1, le=50),
    viewer_id: str | None = Depends(get_optional_user_id),
) -> list[PostItem]:
    uid = str(target_user_id)
    engagement_join, engagement_params = _engagement_joins(viewer_id)
    liked_select = (
        "CASE WHEN pr_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_me"
        if viewer_id
        else "FALSE AS liked_by_me"
    )
    bookmarked_select = (
        "CASE WHEN pb_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS bookmarked_by_me"
        if viewer_id
        else "FALSE AS bookmarked_by_me"
    )

    query = f"""
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
            {liked_select},
            {bookmarked_select}
        FROM posts p
        LEFT JOIN users u ON u.user_id = p.user_id
        LEFT JOIN sport_profiles sp
          ON sp.user_id = p.user_id AND sp.sport_type = 'swimming'
        {engagement_join}
        WHERE p.user_id = %s AND p.group_id IS NULL
        ORDER BY p.created_at DESC
        LIMIT %s
    """
    params: list[object] = [*engagement_params, uid, limit]

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_user(cur, uid)
                cur.execute(query, params)
                rows = cur.fetchall()
                results: list[PostItem] = []
                for row in rows:
                    images = _fetch_images(cur, row["post_id"])
                    results.append(
                        _row_to_post_item(
                            row,
                            liked_by_me=bool(row.get("liked_by_me")),
                            bookmarked_by_me=bool(row.get("bookmarked_by_me")),
                            images=images,
                        )
                    )
                return results
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{target_user_id}/groups", response_model=list[PublicGroupItem])
def get_user_public_groups(target_user_id: UUID) -> list[PublicGroupItem]:
    uid = str(target_user_id)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _require_user(cur, uid)
                cur.execute(
                    """
                    SELECT g.group_id, v.name AS venue_name, g.level, g.status
                    FROM group_members gm
                    JOIN groups g ON g.group_id = gm.group_id
                    LEFT JOIN venues v ON v.venue_id = g.venue_id
                    WHERE gm.user_id = %s AND g.status = 'active'
                    ORDER BY gm.joined_at DESC
                    LIMIT 5
                    """,
                    [uid],
                )
                return [PublicGroupItem(**row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{target_user_id}", response_model=UserProfile)
def get_user(target_user_id: UUID) -> UserProfile:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user(cur, str(target_user_id))
                if row is None:
                    raise HTTPException(status_code=404, detail="User not found")
                return UserProfile(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
