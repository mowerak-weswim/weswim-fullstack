"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  createPostComment,
  deletePost,
  deletePostComment,
  getPost,
  getPostComments,
  getPosts,
  toggleCommentReaction,
  togglePostBookmark,
  togglePostReaction,
  updatePostComment,
  type FeedPost,
  type PostComment,
  type PostDetail,
} from "@/lib/api";
import { getCategoryMeta } from "@/lib/community/categories";
import { levelLabel } from "@/lib/format/level-label";
import {
  avatarInitial,
  avatarVariant,
  formatRelativeTime,
} from "@/lib/format/relative-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-community-post.css";

type CommunityPostDetailProps = {
  postId: string;
};

export function CommunityPostDetail({ postId }: CommunityPostDetailProps) {
  const router = useRouter();
  const [postLoading, setPostLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [authorNickname, setAuthorNickname] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<FeedPost[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInitial, setCurrentUserInitial] = useState("?");
  const [commentInput, setCommentInput] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [togglingReaction, setTogglingReaction] = useState(false);
  const [togglingCommentId, setTogglingCommentId] = useState<string | null>(null);
  const [togglingBookmark, setTogglingBookmark] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const loadAuthorNickname = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("users")
      .select("nickname")
      .eq("user_id", userId)
      .maybeSingle();

    setAuthorNickname(data?.nickname ?? "회원");
  }, []);

  const loadPost = useCallback(
    async (token?: string | null) => {
      setPostLoading(true);
      try {
        const detail = await getPost(postId, token ?? undefined);
        setPost(detail);
        if (detail.author?.nickname) {
          setAuthorNickname(detail.author.nickname);
        } else {
          await loadAuthorNickname(detail.user_id);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.",
        );
      } finally {
        setPostLoading(false);
      }
    },
    [loadAuthorNickname, postId],
  );

  const loadComments = useCallback(async (token?: string | null) => {
    setCommentsLoading(true);
    try {
      const rows = await getPostComments(postId, token ?? undefined);
      setComments(rows);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "댓글을 불러오지 못했습니다.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  const loadRelatedPosts = useCallback(
    async (category: string) => {
      setRelatedLoading(true);
      try {
        const rows = await getPosts({ category, limit: 5 });
        setRelatedPosts(rows.filter((item) => item.post_id !== postId).slice(0, 3));
      } catch {
        setRelatedPosts([]);
      } finally {
        setRelatedLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    async function init() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      setAccessToken(token);
      setCurrentUserId(session?.user?.id ?? null);

      if (session?.user) {
        const nickname =
          (session.user.user_metadata?.nickname as string | undefined) ??
          session.user.email?.split("@")[0];
        setCurrentUserInitial(avatarInitial(nickname));
      }

      await Promise.all([loadPost(token), loadComments(token)]);
    }

    init();
  }, [loadComments, loadPost]);

  useEffect(() => {
    if (post?.category) {
      loadRelatedPosts(post.category);
    }
  }, [loadRelatedPosts, post?.category]);

  async function handleToggleReaction() {
    if (!accessToken) {
      setErrorMessage("좋아요는 로그인 후 이용할 수 있습니다.");
      return;
    }

    setTogglingReaction(true);
    setErrorMessage(null);

    try {
      const result = await togglePostReaction(postId, accessToken);
      setPost((current) =>
        current
          ? {
              ...current,
              liked_by_me: result.liked,
              reaction_count: result.count,
            }
          : current,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.",
      );
    } finally {
      setTogglingReaction(false);
    }
  }

  async function handleSubmitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setErrorMessage("댓글 작성은 로그인 후 이용할 수 있습니다.");
      return;
    }

    const content = commentInput.trim();
    if (!content) {
      return;
    }

    setSubmittingComment(true);
    setErrorMessage(null);

    try {
      const created = await createPostComment(
        postId,
        content,
        accessToken,
        replyToCommentId ?? undefined,
      );
      setComments((current) => [
        ...current,
        {
          ...created,
          reaction_count: created.reaction_count ?? 0,
          liked_by_me: created.liked_by_me ?? false,
        },
      ]);
      setCommentInput("");
      setReplyToCommentId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "댓글 작성에 실패했습니다.",
      );
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleToggleCommentReaction(commentId: string) {
    if (!accessToken) {
      setErrorMessage("댓글 좋아요는 로그인 후 이용할 수 있습니다.");
      return;
    }

    setTogglingCommentId(commentId);
    setErrorMessage(null);

    try {
      const result = await toggleCommentReaction(postId, commentId, accessToken);
      setComments((current) =>
        current.map((comment) =>
          comment.comment_id === commentId
            ? {
                ...comment,
                liked_by_me: result.liked,
                reaction_count: result.count,
              }
            : comment,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "댓글 좋아요 처리에 실패했습니다.",
      );
    } finally {
      setTogglingCommentId(null);
    }
  }

  function startReply(comment: PostComment) {
    setReplyToCommentId(comment.comment_id);
    setEditingCommentId(null);
    setCommentInput(`@${comment.nickname ?? "회원"} `);
  }

  function startEdit(comment: PostComment) {
    setEditingCommentId(comment.comment_id);
    setEditingContent(comment.content);
    setReplyToCommentId(null);
  }

  async function saveEdit(commentId: string) {
    if (!accessToken) {
      return;
    }
    const content = editingContent.trim();
    if (!content) {
      return;
    }
    try {
      const updated = await updatePostComment(
        postId,
        commentId,
        content,
        accessToken,
      );
      setComments((current) =>
        current.map((c) => (c.comment_id === commentId ? updated : c)),
      );
      setEditingCommentId(null);
      setEditingContent("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "댓글 수정에 실패했습니다.",
      );
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!accessToken || !window.confirm("댓글을 삭제할까요?")) {
      return;
    }
    try {
      await deletePostComment(postId, commentId, accessToken);
      setComments((current) =>
        current.filter(
          (c) =>
            c.comment_id !== commentId && c.parent_comment_id !== commentId,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "댓글 삭제에 실패했습니다.",
      );
    }
  }

  async function handleToggleBookmark() {
    if (!accessToken) {
      setErrorMessage("북마크는 로그인 후 이용할 수 있습니다.");
      return;
    }

    setTogglingBookmark(true);
    try {
      const result = await togglePostBookmark(postId, accessToken);
      setPost((current) =>
        current ? { ...current, bookmarked_by_me: result.bookmarked } : current,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "북마크 처리에 실패했습니다.",
      );
    } finally {
      setTogglingBookmark(false);
    }
  }

  async function handleDeletePost() {
    if (!accessToken || !post?.is_author) {
      return;
    }
    if (!window.confirm("게시글을 삭제할까요?")) {
      return;
    }

    setDeletingPost(true);
    try {
      await deletePost(postId, accessToken);
      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "삭제에 실패했습니다.",
      );
    } finally {
      setDeletingPost(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("링크가 복사되었습니다.");
      setTimeout(() => setShareMessage(null), 2000);
    } catch {
      setShareMessage("링크 복사에 실패했습니다.");
    }
  }

  const categoryMeta = post ? getCategoryMeta(post.category) : null;
  const authorAvClass = post ? avatarVariant(post.user_id) : "aq";
  const isInstructor = post?.author?.user_type === "instructor";
  const authorLevel = post?.author?.level ?? null;

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }
    const close = () => setMoreMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [moreMenuOpen]);

  return (
    <>
      <SiteGnb activeNav="home" />
      <div className="community-post-screen">
      <div className="back-wrap">
        <Link className="back-btn" href="/">
          <span className="ms">arrow_back</span>
          커뮤니티
        </Link>
      </div>

      {errorMessage ? (
        <div className="ws-alert">
          <p className="ws-alert-error">{errorMessage}</p>
        </div>
      ) : null}

      {shareMessage ? (
        <div className="ws-alert">
          <p
            className="ws-alert-error"
            style={{ background: "var(--aqua-light)", color: "var(--aqua-dark)" }}
          >
            {shareMessage}
          </p>
        </div>
      ) : null}

      {postLoading ? (
        <p className="ws-loading">게시글을 불러오는 중...</p>
      ) : null}

      {!postLoading && post && categoryMeta ? (
        <div className="page">
          <div className="page-main">
            <article className="post-card">
              <div className="post-header">
                <span className={`cat-pill ${categoryMeta.pillClass}`}>
                  {categoryMeta.label}
                </span>
                <h1 className="post-title">{post.title ?? "(제목 없음)"}</h1>
                <div className="post-author">
                  <Link
                    href={`/users/${post.user_id}`}
                    className={`av ${authorAvClass}`}
                  >
                    {avatarInitial(authorNickname)}
                  </Link>
                  <div className="author-info">
                    <div className="author-name">
                      <Link href={`/users/${post.user_id}`}>
                        {authorNickname ?? "회원"}
                      </Link>
                      {isInstructor ? (
                        <span className="instructor-badge">
                          <span className="ms">workspace_premium</span>
                          강사
                        </span>
                      ) : null}
                    </div>
                    <div className="author-meta">
                      {authorLevel ? (
                        <>
                          <span className="lane-pill">
                            <span />
                            {levelLabel(authorLevel)}
                          </span>
                          <span>·</span>
                        </>
                      ) : null}
                      <span>{formatRelativeTime(post.created_at)}</span>
                      <span>·</span>
                      <span>조회 {post.view_count}</span>
                    </div>
                  </div>
                  {post.is_author ? (
                    <div
                      className="more-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="more-btn"
                        aria-expanded={moreMenuOpen}
                        aria-haspopup="menu"
                        onClick={() => setMoreMenuOpen((open) => !open)}
                      >
                        <span className="ms" aria-hidden="true">
                          more_horiz
                        </span>
                      </button>
                      <div
                        className={`more-menu${moreMenuOpen ? " open" : ""}`}
                        role="menu"
                      >
                        <Link
                          className="more-menu-item"
                          href={`/community/write?edit=${post.post_id}`}
                          role="menuitem"
                          onClick={() => setMoreMenuOpen(false)}
                        >
                          <span className="ms" aria-hidden="true">
                            edit
                          </span>
                          수정
                        </Link>
                        <div className="more-menu-divider" />
                        <button
                          type="button"
                          className="more-menu-item danger"
                          role="menuitem"
                          disabled={deletingPost}
                          onClick={() => {
                            setMoreMenuOpen(false);
                            void handleDeletePost();
                          }}
                        >
                          <span className="ms" aria-hidden="true">
                            delete
                          </span>
                          삭제
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="post-body">
                {post.content}
                {post.images.length > 0 ? (
                  <div className="post-images">
                    {post.images.slice(0, 3).map((image, index) => (
                      <div className="post-img" key={image.image_id}>
                        <img alt="" src={image.url} />
                        {index === 2 && post.images.length > 3 ? (
                          <div className="post-img-count">
                            +{post.images.length - 3}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {post.tags.length > 0 ? (
                <div className="post-tags">
                  {post.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="post-reactions">
                <button
                  className={`react-btn${post.liked_by_me ? " liked" : ""}`}
                  disabled={togglingReaction}
                  onClick={handleToggleReaction}
                  type="button"
                >
                  <span className="ms">favorite</span>
                  좋아요 {post.reaction_count}
                </button>
                {accessToken ? (
                  <button
                    className={`react-btn${post.bookmarked_by_me ? " liked" : ""}`}
                    disabled={togglingBookmark}
                    onClick={handleToggleBookmark}
                    type="button"
                  >
                    <span className="ms">bookmark</span>
                    {post.bookmarked_by_me ? "저장됨" : "저장"}
                  </button>
                ) : null}
                <button className="react-share" onClick={handleShare} type="button">
                  <span className="ms">share</span>
                  공유
                </button>
              </div>
            </article>

            <section className="comments-card">
              <div className="comments-header">
                댓글
                <span className="count">{comments.length}</span>
              </div>

              {commentsLoading ? (
                <p className="comments-empty">댓글을 불러오는 중...</p>
              ) : null}

              {!commentsLoading && comments.length === 0 ? (
                <p className="comments-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
              ) : null}

              {!commentsLoading &&
                comments.map((comment) => (
                  <div
                    className={`comment${comment.parent_comment_id ? " reply" : ""}`}
                    key={comment.comment_id}
                  >
                    <div
                      className={`av comment-av ${avatarVariant(comment.user_id)}`}
                    >
                      {avatarInitial(comment.nickname)}
                    </div>
                    <div className="comment-body">
                      <div className="comment-name-row">
                        <span className="comment-name">
                          {comment.nickname ?? "익명"}
                        </span>
                        <span className="comment-time">
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                      {editingCommentId === comment.comment_id ? (
                        <div className="comment-edit-row">
                          <textarea
                            className="comment-textarea"
                            maxLength={500}
                            rows={2}
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                          />
                          <button
                            type="button"
                            className="comment-btn"
                            onClick={() => void saveEdit(comment.comment_id)}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            className="comment-btn"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingContent("");
                            }}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <p className="comment-text">{comment.content}</p>
                      )}
                      <div className="comment-actions">
                        <button
                          type="button"
                          className={`comment-btn${comment.liked_by_me ? " liked-comment" : ""}`}
                          disabled={togglingCommentId === comment.comment_id}
                          onClick={() =>
                            void handleToggleCommentReaction(comment.comment_id)
                          }
                        >
                          <span className="ms" aria-hidden="true">
                            favorite
                          </span>
                          {comment.reaction_count}
                        </button>
                        {accessToken ? (
                          <button
                            type="button"
                            className="comment-btn"
                            onClick={() => startReply(comment)}
                          >
                            답글
                          </button>
                        ) : null}
                        {currentUserId === comment.user_id ? (
                          <>
                            <button
                              type="button"
                              className="comment-btn"
                              onClick={() => startEdit(comment)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="comment-btn"
                              onClick={() =>
                                void handleDeleteComment(comment.comment_id)
                              }
                            >
                              삭제
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

              {!accessToken ? (
                <p className="comments-empty">
                  댓글 작성은{" "}
                  <Link href="/login" style={{ color: "var(--aqua-dark)" }}>
                    로그인
                  </Link>
                  후 가능합니다.
                </p>
              ) : null}
            </section>
          </div>

          <aside className="sidebar">
            <div className="sidebar-widget">
              <div className="widget-title">
                <span className="ms">article</span>
                관련 게시글
              </div>
              {relatedLoading ? (
                <p className="r-meta">불러오는 중...</p>
              ) : null}
              {!relatedLoading && relatedPosts.length === 0 ? (
                <p className="r-meta">같은 카테고리 게시글이 없습니다.</p>
              ) : null}
              {!relatedLoading &&
                relatedPosts.map((item) => (
                  <Link
                    className="related-post"
                    href={`/community/${item.post_id}`}
                    key={item.post_id}
                  >
                    <div className="r-title">{item.title ?? "(제목 없음)"}</div>
                    <div className="r-meta">{formatRelativeTime(item.created_at)}</div>
                  </Link>
                ))}
            </div>
          </aside>
        </div>
      ) : null}

      {accessToken ? (
        <form className="comment-input-fixed" onSubmit={handleSubmitComment}>
          <div className={`av aq comment-av`}>{currentUserInitial}</div>
          {replyToCommentId ? (
            <button
              type="button"
              className="comment-btn"
              style={{ alignSelf: "center" }}
              onClick={() => {
                setReplyToCommentId(null);
                setCommentInput("");
              }}
            >
              답글 취소
            </button>
          ) : null}
          <textarea
            className="comment-textarea"
            maxLength={500}
            onChange={(event) => setCommentInput(event.target.value)}
            placeholder={
              replyToCommentId
                ? "답글을 입력하세요 (최대 500자)"
                : "댓글을 입력하세요 (최대 500자)"
            }
            rows={1}
            value={commentInput}
          />
          <button
            className="comment-submit"
            disabled={submittingComment || !commentInput.trim()}
            type="submit"
          >
            <span className="ms">send</span>
            {submittingComment ? "등록 중..." : "등록"}
          </button>
        </form>
      ) : null}
      </div>
    </>
  );
}
