from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import get_db_connection

router = APIRouter(prefix="/search", tags=["search"])


class SearchPostHit(BaseModel):
    post_id: UUID
    title: str | None
    content: str
    category: str
    created_at: datetime
    nickname: str | None


class SearchUserHit(BaseModel):
    user_id: UUID
    nickname: str
    user_type: str
    level: str | None


class SearchVenueHit(BaseModel):
    venue_id: UUID
    name: str
    region: str | None


class SearchResponse(BaseModel):
    posts: list[SearchPostHit]
    users: list[SearchUserHit]
    venues: list[SearchVenueHit]


class TrendingItem(BaseModel):
    label: str
    rank: int


TRENDING_SEARCHES: list[str] = [
    "자유형",
    "개인레슨",
    "마스터즈",
    "접영 킥",
    "잠실",
    "호흡법",
    "수경 추천",
    "새벽반",
]


@router.get("/trending", response_model=list[TrendingItem])
def trending_searches() -> list[TrendingItem]:
    return [
        TrendingItem(label=label, rank=index + 1)
        for index, label in enumerate(TRENDING_SEARCHES)
    ]


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=10, ge=1, le=30),
) -> SearchResponse:
    pattern = f"%{q.strip()}%"
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.post_id, p.title, p.content, p.category, p.created_at, u.nickname
                    FROM posts p
                    LEFT JOIN users u ON u.user_id = p.user_id
                    WHERE p.group_id IS NULL
                      AND (p.title ILIKE %s OR p.content ILIKE %s)
                    ORDER BY p.created_at DESC
                    LIMIT %s
                    """,
                    [pattern, pattern, limit],
                )
                posts = [SearchPostHit(**row) for row in cur.fetchall()]

                cur.execute(
                    """
                    SELECT u.user_id, u.nickname, u.user_type, sp.level
                    FROM users u
                    LEFT JOIN sport_profiles sp
                      ON sp.user_id = u.user_id AND sp.sport_type = 'swimming'
                    WHERE u.nickname ILIKE %s
                    ORDER BY u.nickname
                    LIMIT %s
                    """,
                    [pattern, limit],
                )
                users = [SearchUserHit(**row) for row in cur.fetchall()]

                cur.execute(
                    """
                    SELECT venue_id, name, region
                    FROM venues
                    WHERE status = 'active'
                      AND (name ILIKE %s OR region ILIKE %s)
                    ORDER BY name
                    LIMIT %s
                    """,
                    [pattern, pattern, limit],
                )
                venues = [SearchVenueHit(**row) for row in cur.fetchall()]

                return SearchResponse(posts=posts, users=users, venues=venues)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
