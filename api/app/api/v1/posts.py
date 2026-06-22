from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id, get_optional_user_id
from app.db import get_db_connection
from app.services.badges import evaluate_count_badges
from app.services.notifications import (
    notify_post_author_on_comment,
    notify_post_author_on_reaction,
)

router = APIRouter()

SQUARE_CATEGORIES = {"info", "tips", "venue", "free", "instructor"}
SortOption = Literal["latest", "popular", "comment"]


class PostImage(BaseModel):
    image_id: UUID
    url: str
    sort_order: int


class PostAuthor(BaseModel):
    nickname: str | None = None
    user_type: str | None = None
    level: str | None = None


class PostItem(BaseModel):
    post_id: UUID
    user_id: UUID
    sport_type: str | None
    group_id: UUID | None
    category: str
    title: str | None
    content: str
    tags: list[str] = []
    view_count: int = 0
    created_at: datetime
    author: PostAuthor | None = None
    reaction_count: int = 0
    comment_count: int = 0
    liked_by_me: bool = False
    bookmarked_by_me: bool = False
    images: list[PostImage] = []


class PostDetail(PostItem):
    is_author: bool = False


class CreatePostRequest(BaseModel):
    category: Literal["info", "tips", "venue", "free", "instructor"]
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1)
    sport_type: str | None = Field(default=None, max_length=30)
    tags: list[str] = Field(default_factory=list, max_length=10)
    image_urls: list[str] = Field(default_factory=list, max_length=5)
    venue_id: UUID | None = None


class UpdatePostRequest(BaseModel):
    category: Literal["info", "tips", "venue", "free", "instructor"] | None = None
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None
    image_urls: list[str] | None = None


class CommentItem(BaseModel):
    comment_id: UUID
    post_id: UUID
    user_id: UUID
    parent_comment_id: UUID | None = None
    content: str
    created_at: datetime
    nickname: str | None = None
    reaction_count: int = 0
    liked_by_me: bool = False


class CreateCommentRequest(BaseModel):
    content: str = Field(min_length=1)
    parent_comment_id: UUID | None = None


class UpdateCommentRequest(BaseModel):
    content: str = Field(min_length=1)


class ReactionToggleResponse(BaseModel):
    liked: bool
    count: int


class BookmarkToggleResponse(BaseModel):
    bookmarked: bool


class ViewCountResponse(BaseModel):
    view_count: int


def _ensure_user_profile(cur, user_id: str) -> None:
    cur.execute("SELECT user_id FROM users WHERE user_id = %s", [user_id])
    if cur.fetchone() is None:
        raise HTTPException(
            status_code=403,
            detail="User profile not found. Complete signup profile first.",
        )


def _fetch_post_row(cur, post_id: UUID) -> dict | None:
    cur.execute(
        """
        SELECT
            post_id, user_id, sport_type, group_id, category,
            title, content, tags, view_count, created_at
        FROM posts
        WHERE post_id = %s
        """,
        [post_id],
    )
    return cur.fetchone()


def _fetch_images(cur, post_id: UUID) -> list[PostImage]:
    cur.execute(
        """
        SELECT image_id, url, sort_order
        FROM post_images
        WHERE post_id = %s
        ORDER BY sort_order ASC, created_at ASC
        """,
        [post_id],
    )
    return [PostImage(**row) for row in cur.fetchall()]


def _insert_images(cur, post_id: UUID, urls: list[str]) -> None:
    cur.execute("DELETE FROM post_images WHERE post_id = %s", [post_id])
    for index, url in enumerate(urls[:5]):
        cur.execute(
            """
            INSERT INTO post_images (post_id, url, sort_order)
            VALUES (%s, %s, %s)
            """,
            [post_id, url, index],
        )


def _engagement_joins(user_id: str | None) -> tuple[str, list[object]]:
    if not user_id:
        return (
            "",
            [],
        )
    return (
        """
        LEFT JOIN post_reactions pr_me
          ON pr_me.post_id = p.post_id AND pr_me.user_id = %s
        LEFT JOIN post_bookmarks pb_me
          ON pb_me.post_id = p.post_id AND pb_me.user_id = %s
        """,
        [user_id, user_id],
    )


def _row_to_post_item(
    row: dict,
    *,
    liked_by_me: bool = False,
    bookmarked_by_me: bool = False,
    images: list[PostImage] | None = None,
) -> PostItem:
    tags = row.get("tags") or []
    if isinstance(tags, str):
        tags = []

    author = PostAuthor(
        nickname=row.get("nickname"),
        user_type=row.get("user_type"),
        level=row.get("level"),
    )

    return PostItem(
        post_id=row["post_id"],
        user_id=row["user_id"],
        sport_type=row.get("sport_type"),
        group_id=row.get("group_id"),
        category=row["category"],
        title=row.get("title"),
        content=row["content"],
        tags=list(tags),
        view_count=int(row.get("view_count") or 0),
        created_at=row["created_at"],
        author=author,
        reaction_count=int(row.get("reaction_count") or 0),
        comment_count=int(row.get("comment_count") or 0),
        liked_by_me=liked_by_me,
        bookmarked_by_me=bookmarked_by_me,
        images=images or [],
    )


def _sort_clause(sort: SortOption) -> str:
    if sort == "popular":
        return "reaction_count DESC, p.created_at DESC"
    if sort == "comment":
        return "comment_count DESC, p.created_at DESC"
    return "p.created_at DESC"


@router.get("/posts", response_model=list[PostItem])
def get_posts(
    category: str | None = Query(default=None),
    sort: SortOption = Query(default="latest"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str | None = Depends(get_optional_user_id),
) -> list[PostItem]:
    engagement_join, engagement_params = _engagement_joins(user_id)
    liked_select = (
        "CASE WHEN pr_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_me"
        if user_id
        else "FALSE AS liked_by_me"
    )
    bookmarked_select = (
        "CASE WHEN pb_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS bookmarked_by_me"
        if user_id
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
        WHERE p.group_id IS NULL
    """
    params: list[object] = list(engagement_params)

    if category:
        query += " AND p.category = %s"
        params.append(category)

    query += f" ORDER BY {_sort_clause(sort)} LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch posts: {exc}") from exc


@router.get("/posts/{post_id}", response_model=PostDetail)
def get_post(
    post_id: UUID,
    user_id: str | None = Depends(get_optional_user_id),
) -> PostDetail:
    engagement_join, engagement_params = _engagement_joins(user_id)
    liked_select = (
        "CASE WHEN pr_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_me"
        if user_id
        else "FALSE AS liked_by_me"
    )
    bookmarked_select = (
        "CASE WHEN pb_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS bookmarked_by_me"
        if user_id
        else "FALSE AS bookmarked_by_me"
    )
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
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
                        {liked_select},
                        {bookmarked_select}
                    FROM posts p
                    LEFT JOIN users u ON u.user_id = p.user_id
                    LEFT JOIN sport_profiles sp
                      ON sp.user_id = p.user_id AND sp.sport_type = 'swimming'
                    {engagement_join}
                    WHERE p.post_id = %s
                    """,
                    [*engagement_params, post_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Post not found")

                cur.execute(
                    "UPDATE posts SET view_count = view_count + 1 WHERE post_id = %s",
                    [post_id],
                )
                row["view_count"] = int(row.get("view_count") or 0) + 1
                conn.commit()

                images = _fetch_images(cur, post_id)
                is_author = user_id is not None and str(row["user_id"]) == user_id
                post = _row_to_post_item(
                    row,
                    liked_by_me=bool(row.get("liked_by_me")),
                    bookmarked_by_me=bool(row.get("bookmarked_by_me")),
                    images=images,
                )
                return PostDetail(**post.model_dump(), is_author=is_author)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch post: {exc}") from exc


@router.post("/posts", response_model=PostItem, status_code=status.HTTP_201_CREATED)
def create_post(
    body: CreatePostRequest,
    user_id: str = Depends(get_current_user_id),
) -> PostItem:
    if body.category not in SQUARE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category for square post")

    tags = body.tags[:10] if body.tags else []

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _ensure_user_profile(cur, user_id)
                venue_id = body.venue_id if body.category == "venue" else None
                cur.execute(
                    """
                    INSERT INTO posts (
                        user_id, sport_type, group_id, category, title, content, tags, venue_id
                    )
                    VALUES (%s, %s, NULL, %s, %s, %s, %s, %s)
                    RETURNING
                        post_id, user_id, sport_type, group_id, category,
                        title, content, tags, view_count, created_at
                    """,
                    [
                        user_id,
                        body.sport_type,
                        body.category,
                        body.title,
                        body.content,
                        tags,
                        venue_id,
                    ],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=500, detail="Failed to create post")

                if body.image_urls:
                    _insert_images(cur, row["post_id"], body.image_urls)

                evaluate_count_badges(cur, user_id=user_id, condition_type="post_count")

                conn.commit()
                images = _fetch_images(cur, row["post_id"])
                return _row_to_post_item(row, images=images)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create post: {exc}") from exc


@router.patch("/posts/{post_id}", response_model=PostDetail)
def update_post(
    post_id: UUID,
    body: UpdatePostRequest,
    user_id: str = Depends(get_current_user_id),
) -> PostDetail:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_post_row(cur, post_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Post not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")

                category = body.category if body.category is not None else row["category"]
                title = body.title if body.title is not None else row["title"]
                content = body.content if body.content is not None else row["content"]
                tags = body.tags if body.tags is not None else (row.get("tags") or [])

                cur.execute(
                    """
                    UPDATE posts
                    SET category = %s, title = %s, content = %s, tags = %s, updated_at = NOW()
                    WHERE post_id = %s
                    RETURNING
                        post_id, user_id, sport_type, group_id, category,
                        title, content, tags, view_count, created_at
                    """,
                    [category, title, content, tags, post_id],
                )
                updated = cur.fetchone()

                if body.image_urls is not None:
                    _insert_images(cur, post_id, body.image_urls)

                conn.commit()
                images = _fetch_images(cur, post_id)
                post = _row_to_post_item(updated, images=images)
                return PostDetail(**post.model_dump(), is_author=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_post_row(cur, post_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="Post not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")
                cur.execute("DELETE FROM posts WHERE post_id = %s", [post_id])
                conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _comment_select_sql(user_id: str | None) -> tuple[str, list[object]]:
    liked_select = (
        "CASE WHEN cr_me.id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_me"
        if user_id
        else "FALSE AS liked_by_me"
    )
    join = (
        "LEFT JOIN comment_reactions cr_me ON cr_me.comment_id = c.comment_id AND cr_me.user_id = %s"
        if user_id
        else ""
    )
    params_prefix = [user_id] if user_id else []
    query = f"""
        SELECT
            c.comment_id,
            c.post_id,
            c.user_id,
            c.parent_comment_id,
            c.content,
            c.created_at,
            u.nickname,
            (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.comment_id) AS reaction_count,
            {liked_select}
        FROM comments c
        LEFT JOIN users u ON u.user_id = c.user_id
        {join}
        WHERE c.post_id = %s
        ORDER BY c.created_at ASC
    """
    return query, params_prefix


@router.get("/posts/{post_id}/comments", response_model=list[CommentItem])
def get_post_comments(
    post_id: UUID,
    user_id: str | None = Depends(get_optional_user_id),
) -> list[CommentItem]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if _fetch_post_row(cur, post_id) is None:
                    raise HTTPException(status_code=404, detail="Post not found")

                query, prefix_params = _comment_select_sql(user_id)
                cur.execute(query, [*prefix_params, post_id])
                return [CommentItem(**row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentItem,
    status_code=status.HTTP_201_CREATED,
)
def create_post_comment(
    post_id: UUID,
    body: CreateCommentRequest,
    user_id: str = Depends(get_current_user_id),
) -> CommentItem:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if _fetch_post_row(cur, post_id) is None:
                    raise HTTPException(status_code=404, detail="Post not found")

                if body.parent_comment_id:
                    cur.execute(
                        """
                        SELECT comment_id FROM comments
                        WHERE comment_id = %s AND post_id = %s
                        """,
                        [body.parent_comment_id, post_id],
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(status_code=404, detail="Parent comment not found")

                _ensure_user_profile(cur, user_id)
                cur.execute(
                    """
                    INSERT INTO comments (post_id, user_id, content, parent_comment_id)
                    VALUES (%s, %s, %s, %s)
                    RETURNING comment_id, post_id, user_id, parent_comment_id, content, created_at
                    """,
                    [post_id, user_id, body.content, body.parent_comment_id],
                )
                row = cur.fetchone()
                cur.execute(
                    "SELECT nickname FROM users WHERE user_id = %s",
                    [user_id],
                )
                nickname_row = cur.fetchone()
                nickname = nickname_row["nickname"] if nickname_row else None
                notify_post_author_on_comment(
                    cur,
                    post_id=post_id,
                    commenter_id=user_id,
                    commenter_nickname=nickname,
                )
                evaluate_count_badges(cur, user_id=user_id, condition_type="comment_count")
                conn.commit()

                if row is None:
                    raise HTTPException(status_code=500, detail="Failed to create comment")

                return CommentItem(
                    **row,
                    nickname=nickname_row["nickname"] if nickname_row else None,
                    reaction_count=0,
                    liked_by_me=False,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/posts/{post_id}/comments/{comment_id}/reactions",
    response_model=ReactionToggleResponse,
)
def toggle_comment_reaction(
    post_id: UUID,
    comment_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> ReactionToggleResponse:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT comment_id FROM comments
                    WHERE comment_id = %s AND post_id = %s
                    """,
                    [comment_id, post_id],
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Comment not found")

                _ensure_user_profile(cur, user_id)
                cur.execute(
                    """
                    SELECT id FROM comment_reactions
                    WHERE comment_id = %s AND user_id = %s
                    """,
                    [comment_id, user_id],
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        """
                        DELETE FROM comment_reactions
                        WHERE comment_id = %s AND user_id = %s
                        """,
                        [comment_id, user_id],
                    )
                    liked = False
                else:
                    cur.execute(
                        """
                        INSERT INTO comment_reactions (comment_id, user_id)
                        VALUES (%s, %s)
                        """,
                        [comment_id, user_id],
                    )
                    liked = True

                cur.execute(
                    """
                    SELECT COUNT(*) AS count FROM comment_reactions
                    WHERE comment_id = %s
                    """,
                    [comment_id],
                )
                count_row = cur.fetchone()
                conn.commit()
                return ReactionToggleResponse(
                    liked=liked,
                    count=int(count_row["count"]) if count_row else 0,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/posts/{post_id}/comments/{comment_id}", response_model=CommentItem)
def update_post_comment(
    post_id: UUID,
    comment_id: UUID,
    body: UpdateCommentRequest,
    user_id: str = Depends(get_current_user_id),
) -> CommentItem:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_id FROM comments
                    WHERE comment_id = %s AND post_id = %s
                    """,
                    [comment_id, post_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Comment not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")

                cur.execute(
                    """
                    UPDATE comments SET content = %s
                    WHERE comment_id = %s
                    RETURNING comment_id, post_id, user_id, parent_comment_id, content, created_at
                    """,
                    [body.content, comment_id],
                )
                updated = cur.fetchone()
                cur.execute(
                    "SELECT nickname FROM users WHERE user_id = %s",
                    [user_id],
                )
                nickname_row = cur.fetchone()
                conn.commit()
                return CommentItem(
                    **updated,
                    nickname=nickname_row["nickname"] if nickname_row else None,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_comment(
    post_id: UUID,
    comment_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_id FROM comments
                    WHERE comment_id = %s AND post_id = %s
                    """,
                    [comment_id, post_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Comment not found")
                if str(row["user_id"]) != user_id:
                    raise HTTPException(status_code=403, detail="Forbidden")
                cur.execute(
                    "DELETE FROM comments WHERE comment_id = %s",
                    [comment_id],
                )
                conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/posts/{post_id}/reactions", response_model=ReactionToggleResponse)
def toggle_post_reaction(
    post_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> ReactionToggleResponse:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if _fetch_post_row(cur, post_id) is None:
                    raise HTTPException(status_code=404, detail="Post not found")

                _ensure_user_profile(cur, user_id)
                cur.execute(
                    """
                    SELECT id FROM post_reactions
                    WHERE post_id = %s AND user_id = %s
                    """,
                    [post_id, user_id],
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        "DELETE FROM post_reactions WHERE post_id = %s AND user_id = %s",
                        [post_id, user_id],
                    )
                    liked = False
                else:
                    cur.execute(
                        "INSERT INTO post_reactions (post_id, user_id) VALUES (%s, %s)",
                        [post_id, user_id],
                    )
                    liked = True
                    cur.execute(
                        "SELECT nickname FROM users WHERE user_id = %s",
                        [user_id],
                    )
                    reactor = cur.fetchone()
                    notify_post_author_on_reaction(
                        cur,
                        post_id=post_id,
                        reactor_id=user_id,
                        reactor_nickname=reactor["nickname"] if reactor else None,
                        liked=True,
                    )

                cur.execute(
                    "SELECT COUNT(*) AS count FROM post_reactions WHERE post_id = %s",
                    [post_id],
                )
                count_row = cur.fetchone()
                conn.commit()
                return ReactionToggleResponse(
                    liked=liked,
                    count=int(count_row["count"]) if count_row else 0,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/posts/{post_id}/bookmarks", response_model=BookmarkToggleResponse)
def toggle_post_bookmark(
    post_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> BookmarkToggleResponse:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if _fetch_post_row(cur, post_id) is None:
                    raise HTTPException(status_code=404, detail="Post not found")

                _ensure_user_profile(cur, user_id)
                cur.execute(
                    """
                    SELECT id FROM post_bookmarks
                    WHERE post_id = %s AND user_id = %s
                    """,
                    [post_id, user_id],
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        "DELETE FROM post_bookmarks WHERE post_id = %s AND user_id = %s",
                        [post_id, user_id],
                    )
                    bookmarked = False
                else:
                    cur.execute(
                        "INSERT INTO post_bookmarks (post_id, user_id) VALUES (%s, %s)",
                        [post_id, user_id],
                    )
                    bookmarked = True

                conn.commit()
                return BookmarkToggleResponse(bookmarked=bookmarked)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
