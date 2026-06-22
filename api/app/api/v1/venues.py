import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id, get_optional_user_id
from app.db import get_db_connection
from app.services.venue_promotion import try_promote_t1_on_request

router = APIRouter(prefix="/venues", tags=["venues"])

MAX_PENDING_PER_USER = 2
MAX_VENUE_REQUEST_TOTAL = 15


class VenueItem(BaseModel):
    venue_id: UUID
    name: str
    region: str | None
    address: str | None
    status: str | None = None


class VenueRequestBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=5, max_length=200)
    region: str | None = Field(default=None, max_length=50)


class VenueRequestResponse(BaseModel):
    venue_id: UUID
    name: str
    status: str
    message: str


def _canonical_key(name: str, region: str | None, address: str | None) -> str:
    normalized_name = re.sub(r"\s+", "", name.strip().lower())
    region_part = (region or address or "").strip().lower()[:80]
    key = f"swimming:{normalized_name}:{region_part}"
    return key[:200]


@router.get("", response_model=list[VenueItem])
def list_venues(
    q: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    user_id: str | None = Depends(get_optional_user_id),
) -> list[VenueItem]:
    query = """
        SELECT venue_id, name, region, address, status
        FROM venues
        WHERE status = 'active'
    """
    params: list[object] = []

    if user_id:
        query = """
            SELECT venue_id, name, region, address, status
            FROM venues
            WHERE status = 'active'
               OR (status = 'pending' AND created_by = %s)
        """
        params = [user_id]

    if q and q.strip():
        query += " AND (name ILIKE %s OR region ILIKE %s OR address ILIKE %s)"
        pattern = f"%{q.strip()}%"
        params.extend([pattern, pattern, pattern])

    query += " ORDER BY status DESC, name LIMIT %s"
    params.append(limit)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return [VenueItem(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/similar", response_model=list[VenueItem])
def similar_venues(
    name: str = Query(min_length=2),
    region: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
) -> list[VenueItem]:
    pattern = f"%{name.strip()}%"
    query = """
        SELECT venue_id, name, region, address, status
        FROM venues
        WHERE status = 'active'
          AND (name ILIKE %s OR address ILIKE %s)
    """
    params: list[object] = [pattern, pattern]
    if region and region.strip():
        query += " AND region ILIKE %s"
        params.append(f"%{region.strip()}%")
    query += " ORDER BY name LIMIT %s"
    params.append(limit)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return [VenueItem(**row) for row in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/request", response_model=VenueRequestResponse, status_code=status.HTTP_201_CREATED)
def request_venue(
    body: VenueRequestBody,
    user_id: str = Depends(get_current_user_id),
) -> VenueRequestResponse:
    canonical = _canonical_key(body.name, body.region, body.address)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT venue_request_total_count FROM users WHERE user_id = %s",
                    [user_id],
                )
                user_row = cur.fetchone()
                if user_row is None:
                    raise HTTPException(status_code=403, detail="User profile not found")

                if int(user_row["venue_request_total_count"]) >= MAX_VENUE_REQUEST_TOTAL:
                    raise HTTPException(
                        status_code=403,
                        detail="Maximum venue registration limit reached (15)",
                    )

                cur.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM venues v
                    WHERE v.status = 'pending' AND v.created_by = %s
                    """,
                    [user_id],
                )
                pending_row = cur.fetchone()
                if pending_row and int(pending_row["count"]) >= MAX_PENDING_PER_USER:
                    raise HTTPException(
                        status_code=403,
                        detail="Maximum pending venue requests reached (2)",
                    )

                cur.execute(
                    """
                    SELECT venue_id, name, status FROM venues
                    WHERE canonical_key = %s
                    LIMIT 1
                    """,
                    [canonical],
                )
                existing = cur.fetchone()
                if existing:
                    if existing["status"] == "active":
                        raise HTTPException(
                            status_code=409,
                            detail="Venue already registered",
                        )
                    venue_id = existing["venue_id"]
                    cur.execute(
                        """
                        SELECT 1 FROM venue_requests
                        WHERE user_id = %s AND venue_id = %s
                        """,
                        [user_id, venue_id],
                    )
                    already_requested = cur.fetchone() is not None
                    if not already_requested:
                        cur.execute(
                            """
                            INSERT INTO venue_requests (
                                user_id, venue_id, name, address, canonical_key
                            )
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            [
                                user_id,
                                venue_id,
                                body.name.strip(),
                                body.address.strip(),
                                canonical,
                            ],
                        )
                        cur.execute(
                            """
                            UPDATE users
                            SET venue_request_total_count = venue_request_total_count + 1,
                                updated_at = NOW()
                            WHERE user_id = %s
                            """,
                            [user_id],
                        )
                    activated = try_promote_t1_on_request(
                        cur, venue_id=venue_id, requester_id=user_id
                    )
                    status_value = "active" if activated else existing["status"]
                    if already_requested:
                        message = "이미 등록 요청된 수영장입니다."
                    elif activated:
                        message = (
                            "등록 요청이 모여 수영장이 공개됐어요. "
                            "지금 이 수영장으로 반 설정을 이어갈 수 있어요."
                        )
                    else:
                        message = (
                            "등록 요청에 참여했어요. "
                            "다른 회원의 요청이 모이면 공개됩니다."
                        )
                    conn.commit()
                    return VenueRequestResponse(
                        venue_id=venue_id,
                        name=existing["name"],
                        status=status_value,
                        message=message,
                    )

                cur.execute(
                    """
                    INSERT INTO venues (
                        sport_type, name, region, address, canonical_key, status, created_by
                    )
                    VALUES ('swimming', %s, %s, %s, %s, 'pending', %s)
                    RETURNING venue_id, name, status
                    """,
                    [
                        body.name.strip(),
                        body.region,
                        body.address.strip(),
                        canonical,
                        user_id,
                    ],
                )
                venue_row = cur.fetchone()
                if venue_row is None:
                    raise HTTPException(status_code=500, detail="Failed to create venue")

                cur.execute(
                    """
                    INSERT INTO venue_requests (user_id, venue_id, name, address, canonical_key)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, venue_id) DO NOTHING
                    """,
                    [
                        user_id,
                        venue_row["venue_id"],
                        body.name.strip(),
                        body.address.strip(),
                        canonical,
                    ],
                )

                cur.execute(
                    """
                    UPDATE users
                    SET venue_request_total_count = venue_request_total_count + 1,
                        updated_at = NOW()
                    WHERE user_id = %s
                    """,
                    [user_id],
                )
                conn.commit()

                return VenueRequestResponse(
                    venue_id=venue_row["venue_id"],
                    name=venue_row["name"],
                    status="pending",
                    message="등록됐어요. 지금 이 수영장으로 반 설정을 이어갈 수 있어요.",
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class VenueDetail(VenueItem):
    group_count: int = 0
    post_count: int = 0


class VenuePostItem(BaseModel):
    post_id: UUID
    title: str | None
    content: str
    category: str
    tags: list[str]
    view_count: int
    reaction_count: int
    comment_count: int
    created_at: datetime
    nickname: str | None


@router.get("/{venue_id}", response_model=VenueDetail)
def get_venue(venue_id: UUID) -> VenueDetail:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT venue_id, name, region, address, status
                    FROM venues
                    WHERE venue_id = %s AND status = 'active'
                    """,
                    [venue_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Venue not found")

                cur.execute(
                    "SELECT COUNT(*) AS count FROM groups WHERE venue_id = %s",
                    [venue_id],
                )
                group_count = int(cur.fetchone()["count"])

                cur.execute(
                    """
                    SELECT COUNT(*) AS count FROM posts
                    WHERE group_id IS NULL
                      AND category = 'venue'
                      AND (venue_id = %s OR venue_id IS NULL)
                    """,
                    [venue_id],
                )
                post_count = int(cur.fetchone()["count"])

                return VenueDetail(
                    **row,
                    group_count=group_count,
                    post_count=post_count,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{venue_id}/posts", response_model=list[VenuePostItem])
def list_venue_posts(
    venue_id: UUID,
    sort: Literal["latest", "popular"] = Query(default="latest"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> list[VenuePostItem]:
    order = "p.created_at DESC"
    if sort == "popular":
        order = "(SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id) DESC, p.created_at DESC"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT venue_id FROM venues WHERE venue_id = %s AND status = 'active'",
                    [venue_id],
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Venue not found")

                cur.execute(
                    f"""
                    SELECT
                        p.post_id,
                        p.title,
                        p.content,
                        p.category,
                        p.tags,
                        p.view_count,
                        p.created_at,
                        u.nickname,
                        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id) AS reaction_count,
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count
                    FROM posts p
                    LEFT JOIN users u ON u.user_id = p.user_id
                    WHERE p.group_id IS NULL
                      AND p.category = 'venue'
                      AND (p.venue_id = %s OR p.venue_id IS NULL)
                    ORDER BY {order}
                    LIMIT %s OFFSET %s
                    """,
                    [venue_id, limit, offset],
                )
                return [VenuePostItem(**row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
