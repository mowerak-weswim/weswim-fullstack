"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { GroupLaneCompactLink } from "@/components/group-lane-compact-link";
import { SiteGnb } from "@/components/layout/site-gnb";
import {
  FEED_CATEGORY_TABS,
  MOB_FEED_CATEGORY_TABS,
  pubCategoryToApi,
  SIDEBAR_CATEGORIES,
  type PubCategoryFilter,
} from "@/lib/community/category-filter";
import { getCategoryMeta } from "@/lib/community/categories";
import {
  avatarInitial,
  avatarVariant,
  formatRelativeTime,
} from "@/lib/format/relative-time";
import {
  getMyGroups,
  getPosts,
  type FeedPost,
  type GroupMembership,
  type SortOption,
} from "@/lib/api";
import {
  isRegisteredGroup,
  isWaitingGroup,
} from "@/lib/group-membership-display";
import { upsertUserProfile } from "@/lib/auth/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-group-membership.css";

export function HomeAuthStatus() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedErrorMessage, setFeedErrorMessage] = useState<string | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PubCategoryFilter>("all");
  const [loginSheetOpen, setLoginSheetOpen] = useState(false);
  const [feedSort, setFeedSort] = useState<SortOption>("latest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<GroupMembership[]>([]);

  const sortOptions: Array<{ value: SortOption; label: string; icon: string }> =
    [
      { value: "latest", label: "최신순", icon: "schedule" },
      { value: "popular", label: "인기순", icon: "favorite" },
      { value: "comment", label: "댓글순", icon: "mode_comment" },
    ];

  const loadFeed = useCallback(
    async (
      category: PubCategoryFilter,
      token?: string | null,
      sort: SortOption = "latest",
    ) => {
      setFeedLoading(true);
      setFeedErrorMessage(null);

      try {
        const apiCategory = pubCategoryToApi(category);
        const posts = await getPosts(
          {
            category: apiCategory,
            sort,
            limit: 20,
            offset: 0,
          },
          token ?? undefined,
        );
        setFeedPosts(posts);
      } catch (error) {
        setFeedErrorMessage(
          error instanceof Error ? error.message : "피드를 불러오지 못했습니다.",
        );
      } finally {
        setFeedLoading(false);
      }
    },
    [],
  );

  const loadUser = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const user = session?.user;
      if (!user) {
        setIsLoggedIn(false);
        setNickname(null);
        setMyGroups([]);
        return;
      }

      setIsLoggedIn(true);

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("nickname")
        .eq("user_id", user.id)
        .single<{ nickname: string }>();

      if (profileError) {
        const fallbackNickname =
          (user.user_metadata?.nickname as string | undefined) ??
          user.email?.split("@")[0] ??
          "swimmer";

        await upsertUserProfile(supabase, {
          userId: user.id,
          email: user.email ?? "",
          nickname: fallbackNickname,
        });

        setNickname(fallbackNickname);
      } else {
        setNickname(profile?.nickname ?? null);
      }

      if (session?.access_token) {
        try {
          const groups = await getMyGroups(session.access_token);
          setMyGroups(groups);
        } catch {
          setMyGroups([]);
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "사용자 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadUser();
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await loadFeed(activeCategory, session?.access_token, feedSort);
    }

    init();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setNickname(
          (session.user.user_metadata?.nickname as string | undefined) ?? null,
        );
        void getMyGroups(session.access_token)
          .then(setMyGroups)
          .catch(() => setMyGroups([]));
        loadFeed(activeCategory, session.access_token, feedSort);
      } else {
        setIsLoggedIn(false);
        setNickname(null);
        setMyGroups([]);
        loadFeed(activeCategory, undefined, feedSort);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeCategory, feedSort, loadFeed, loadUser]);

  useEffect(() => {
    if (searchParams.get("created")) {
      setCreatedNotice(true);
      loadFeed(activeCategory, undefined, feedSort);
    }
  }, [activeCategory, feedSort, loadFeed, searchParams]);

  function handleCategoryChange(category: PubCategoryFilter) {
    setActiveCategory(category);
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadFeed(category, session?.access_token, feedSort);
    });
  }

  function handleFeedSort(next: SortOption) {
    setFeedSort(next);
    setSortMenuOpen(false);
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadFeed(activeCategory, session?.access_token, next);
    });
  }

  function handleFeedShare(event: React.MouseEvent, postId: string) {
    event.stopPropagation();
    const url = `${window.location.origin}/community/${postId}`;
    void navigator.clipboard?.writeText(url);
  }

  const todayPostCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return feedPosts.filter((post) => new Date(post.created_at) >= start).length;
  }, [feedPosts]);

  const sortedLaneGroups = useMemo(
    () => [
      ...myGroups.filter((g) => isRegisteredGroup(g.status)),
      ...myGroups.filter((g) => isWaitingGroup(g.status)),
      ...myGroups.filter(
        (g) => !isRegisteredGroup(g.status) && !isWaitingGroup(g.status),
      ),
    ],
    [myGroups],
  );

  const activeSortLabel =
    sortOptions.find((option) => option.value === feedSort)?.label ?? "최신순";

  function handleWriteClick() {
    if (isLoggedIn) {
      router.push("/community/write");
      return;
    }
    setLoginSheetOpen(true);
  }

  const avatarLabel = avatarInitial(nickname);

  return (
    <>
      <SiteGnb activeNav="home" />

      <div className="mob-tabs" role="tablist" aria-label="게시판 카테고리">
        {MOB_FEED_CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`mob-tab${activeCategory === tab.id ? " on" : ""}`}
            onClick={() => handleCategoryChange(tab.id)}
            type="button"
          >
            <span className="ms" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {createdNotice ? (
        <div className="feed-notice">
          <p className="feed-notice-success">게시글이 등록되었습니다.</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="feed-notice">
          <p className="feed-notice-error">{errorMessage}</p>
        </div>
      ) : null}

      <div className="home-screen">
        <div className="page">
        <aside className="sb">
          <div className="sb-block">
            <div className="sb-title">게시판</div>
            {SIDEBAR_CATEGORIES.map((item) => (
              <button
                key={item.id}
                className={`sb-item${activeCategory === item.id ? " on" : ""}`}
                onClick={() => handleCategoryChange(item.id)}
                type="button"
              >
                <span className="ms" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="sb-block">
            <div className="sb-title">내 레인방</div>
            {isLoggedIn && sortedLaneGroups.length > 0 ? (
              <div className="lane-compact-list">
                {sortedLaneGroups.map((g) => (
                  <GroupLaneCompactLink
                    key={g.group_id}
                    group={g}
                    href={`/group?groupId=${g.group_id}`}
                  />
                ))}
              </div>
            ) : (
              <p className="lane-compact-empty">
                {isLoggedIn
                  ? "소속된 반이 없어요."
                  : "로그인 후 레인방·대기방을 볼 수 있어요."}
              </p>
            )}
            <Link className="sb-item" href="/group">
              <span className="ms" aria-hidden="true">
                groups
              </span>
              레인방 보기
            </Link>
            <Link className="sb-item" href="/group/find">
              <span className="ms" aria-hidden="true">
                add
              </span>
              반 추가하기
            </Link>
          </div>
          <button className="sb-cta" onClick={handleWriteClick} type="button">
            <span className="ms" aria-hidden="true">
              edit
            </span>
            글쓰기
          </button>
        </aside>

        <main className="feed">
          <section className="feed-head">
            <div className="fh-eyebrow">광장 · 전국 수영 동호인</div>
            <h1>오늘의 레인, 함께 이야기해요</h1>
            <div className="h-sub">
              정보방, 초보팁, 우리 수영장, 자유게시판 — 같은 물을 사랑하는
              사람들이 모인 곳이에요.
            </div>
            <div className="h-stats">
              <div className="stat">
                <b>2,400+</b>
                <span>활동 회원</span>
              </div>
              <div className="stat">
                <b>180+</b>
                <span>등록 수영장</span>
              </div>
              <div className="stat">
                <b>{feedPosts.length || "—"}</b>
                <span>오늘의 새 글</span>
              </div>
            </div>
          </section>

          <nav className="feed-tabs" aria-label="카테고리 필터">
            {FEED_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`feed-tab${activeCategory === tab.id ? " on" : ""}`}
                onClick={() => handleCategoryChange(tab.id)}
                type="button"
              >
                {tab.icon ? (
                  <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">
                    {tab.icon}
                  </span>
                ) : null}
                {tab.label}
                {tab.newDot ? <span className="new-dot" aria-hidden="true" /> : null}
              </button>
            ))}
          </nav>

          <div className="feed-toolbar">
            <div className="ft-count">
              총 <b>{feedPosts.length}</b>개의 글 · 오늘 <b>+{todayPostCount}</b>
            </div>
            <div className="sort-wrap">
              <button
                className="ft-sort"
                type="button"
                aria-expanded={sortMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setSortMenuOpen((open) => !open)}
              >
                <span className="ms" aria-hidden="true">
                  sort
                </span>
                {activeSortLabel}
                <span className="ms" style={{ fontSize: 14 }} aria-hidden="true">
                  expand_more
                </span>
              </button>
              <div
                className={`sort-dropdown${sortMenuOpen ? " open" : ""}`}
                role="listbox"
              >
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`sort-opt${feedSort === option.value ? " on" : ""}`}
                    role="option"
                    aria-selected={feedSort === option.value}
                    onClick={() => handleFeedSort(option.value)}
                  >
                    <span className="ms" aria-hidden="true">
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {feedLoading ? (
            <p className="feed-empty">피드를 불러오는 중...</p>
          ) : null}

          {feedErrorMessage ? (
            <p className="feed-notice-error">{feedErrorMessage}</p>
          ) : null}

          {!feedLoading && !feedErrorMessage && feedPosts.length === 0 ? (
            <div className="feed-empty">
              아직 게시글이 없습니다.
              {isLoggedIn ? (
                <>
                  {" "}
                  <Link href="/community/write">첫 글 작성하기</Link>
                </>
              ) : (
                " 로그인 후 첫 글을 작성해 보세요."
              )}
            </div>
          ) : null}

          {!feedLoading && !feedErrorMessage && feedPosts.length > 0 ? (
            <div className="posts">
              {feedPosts.map((post) => {
                const meta = getCategoryMeta(post.category);
                const authorName =
                  post.author?.nickname ?? avatarInitial(post.user_id);

                return (
                  <div
                    key={post.post_id}
                    className="post"
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/community/${post.post_id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/community/${post.post_id}`);
                      }
                    }}
                  >
                    <div className="post-head">
                      <div className={`av ${avatarVariant(post.user_id)}`}>
                        {avatarInitial(authorName)}
                      </div>
                      <div className="ph-info">
                        <div className="ph-line1">
                          <span className="ph-name">{authorName}</span>
                        </div>
                        <div className="ph-line2">
                          <span className={`cat-pill ${meta.pillClass}`}>
                            {meta.label}
                          </span>
                          <span className="ph-dot" />
                          <span>{formatRelativeTime(post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="post-title">
                      {post.title ?? "(제목 없음)"}
                    </div>
                    <div className="post-body">{post.content}</div>
                    {post.tags.length > 0 ? (
                      <div className="post-tags">
                        {post.tags.map((tag) => (
                          <span className="tag" key={tag}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="post-actions">
                      <span className="pa-btn">
                        <span className="ms" aria-hidden="true">
                          favorite
                        </span>
                        {post.reaction_count}
                      </span>
                      <span className="pa-btn">
                        <span className="ms" aria-hidden="true">
                          mode_comment
                        </span>
                        {post.comment_count}
                      </span>
                      <button
                        className="pa-btn"
                        type="button"
                        onClick={(event) => handleFeedShare(event, post.post_id)}
                      >
                        <span className="ms" aria-hidden="true">
                          share
                        </span>
                        공유
                      </button>
                      <div className="pa-spacer" />
                      <button
                        className="pa-btn"
                        type="button"
                        aria-label="저장하기"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="ms" aria-hidden="true">
                          bookmark
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </main>

        <aside className="sb-r">
          <div className="widget">
            <div className="widget-title">
              <span className="ms" aria-hidden="true">
                pool
              </span>
              내 레인
              <Link className="more" href="/my">
                자세히 →
              </Link>
            </div>
            <div className="lane-mini">
              <div className="av-lg">{loading ? "…" : avatarLabel}</div>
              <div className="info">
                <div className="nm">{nickname ?? "게스트"}</div>
                <div className="sub">
                  {isLoggedIn ? "WeSwim 회원" : "로그인 후 이용 가능"}
                </div>
              </div>
            </div>
            <div className="progress-row">
              <span>이번 달 목표</span>
              <span>
                <b>—</b>
                <span style={{ color: "var(--gray-500)", fontWeight: 500 }}>
                  {" "}
                  / 25,000m
                </span>
              </span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: "0%" }} />
            </div>
            <div className="quick-links">
              <Link className="quick-link" href="/record/new">
                <span className="ms" aria-hidden="true">
                  edit_note
                </span>
                <span className="lbl">기록</span>
              </Link>
              <Link className="quick-link" href="/group">
                <span className="ms" aria-hidden="true">
                  forum
                </span>
                <span className="lbl">우리반</span>
              </Link>
              <Link className="quick-link" href="/my">
                <span className="ms" aria-hidden="true">
                  calendar_month
                </span>
                <span className="lbl">마이</span>
              </Link>
            </div>
          </div>
          <div className="pool-promo">
            <div className="pp-eb">우리 수영장</div>
            <div className="pp-t">수영장 정보를 공유해요</div>
            <div className="pp-s">
              시설, 물온도, 혼잡도 — 동네 수영장 후기를 남겨보세요.
            </div>
            <Link className="pp-cta" href="/group/find">
              수영장 찾기
            </Link>
          </div>
        </aside>
        </div>
      </div>

      <Link className="fab" href={isLoggedIn ? "/community/write" : "/login"}>
        <span className="ms" aria-hidden="true">
          edit
        </span>
        글쓰기
      </Link>

      <div
        className={`login-sheet-ov${loginSheetOpen ? " on" : ""}`}
        onClick={() => setLoginSheetOpen(false)}
        role="presentation"
      />
      <div className={`login-sheet${loginSheetOpen ? " open" : ""}`}>
        <div className="ls-handle" />
        <span className="ms ls-icon">lock</span>
        <div className="ls-title">로그인이 필요해요</div>
        <div className="ls-desc">
          로그인하면 글쓰기, 댓글, 기록 등
          <br />
          모든 기능을 이용할 수 있어요.
        </div>
        <Link
          className="ls-btn ls-btn-primary"
          href="/login"
          onClick={() => setLoginSheetOpen(false)}
        >
          로그인하기
        </Link>
        <Link
          className="ls-btn ls-btn-secondary"
          href="/signup"
          onClick={() => setLoginSheetOpen(false)}
        >
          회원가입
        </Link>
      </div>
    </>
  );
}
