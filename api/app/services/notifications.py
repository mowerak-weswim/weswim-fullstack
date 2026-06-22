"""Notification creation helpers."""

from uuid import UUID

from psycopg import Cursor


def create_notification(
    cur: Cursor,
    *,
    user_id: str | UUID,
    noti_type: str,
    ref_id: str | UUID | None = None,
    message: str | None = None,
) -> None:
    cur.execute(
        """
        INSERT INTO notifications (user_id, type, ref_id, message, is_read)
        VALUES (%s, %s, %s, %s, FALSE)
        """,
        [str(user_id), noti_type, str(ref_id) if ref_id else None, message],
    )


def notify_post_author_on_comment(
    cur: Cursor,
    *,
    post_id: UUID,
    commenter_id: str,
    commenter_nickname: str | None,
) -> None:
    cur.execute(
        "SELECT user_id, title FROM posts WHERE post_id = %s",
        [post_id],
    )
    post = cur.fetchone()
    if post is None:
        return
    author_id = str(post["user_id"])
    if author_id == commenter_id:
        return
    name = commenter_nickname or "회원"
    title = post.get("title") or "게시글"
    create_notification(
        cur,
        user_id=author_id,
        noti_type="comment",
        ref_id=post_id,
        message=f"{name}님이 「{title[:40]}」에 댓글을 남겼어요.",
    )


def notify_post_author_on_reaction(
    cur: Cursor,
    *,
    post_id: UUID,
    reactor_id: str,
    reactor_nickname: str | None,
    liked: bool,
) -> None:
    if not liked:
        return
    cur.execute("SELECT user_id, title FROM posts WHERE post_id = %s", [post_id])
    post = cur.fetchone()
    if post is None:
        return
    author_id = str(post["user_id"])
    if author_id == reactor_id:
        return
    name = reactor_nickname or "회원"
    title = post.get("title") or "게시글"
    create_notification(
        cur,
        user_id=author_id,
        noti_type="reaction",
        ref_id=post_id,
        message=f"{name}님이 「{title[:40]}」에 좋아요를 눌렀어요.",
    )


def notify_group_members_on_activation(
    cur: Cursor,
    *,
    group_id: UUID,
    venue_name: str | None,
    exclude_user_id: str | None = None,
) -> None:
    cur.execute(
        """
        SELECT user_id FROM group_members
        WHERE group_id = %s
        """,
        [group_id],
    )
    label = venue_name or "우리 반"
    message = f"「{label}」 레인방이 활성화됐어요! 지금 바로 소통을 시작해 보세요."
    for row in cur.fetchall():
        member_id = str(row["user_id"])
        if exclude_user_id and member_id == exclude_user_id:
            continue
        create_notification(
            cur,
            user_id=member_id,
            noti_type="group_activated",
            ref_id=group_id,
            message=message,
        )
