"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  getVenue,
  getVenuePosts,
  listVenues,
  type VenueDetail,
  type VenueItem,
  type VenuePost,
} from "@/lib/api";
import { getCategoryMeta } from "@/lib/community/categories";
import { avatarInitial, avatarVariant } from "@/lib/format/relative-time";

import "@/styles/weswim-pool-community.css";

type PoolCommunityPageProps = {
  venueId: string;
};

export function PoolCommunityPage({ venueId }: PoolCommunityPageProps) {
  const router = useRouter();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [posts, setPosts] = useState<VenuePost[]>([]);
  const [sortUi, setSortUi] = useState<"latest" | "popular" | "comments">(
    "latest",
  );
  const [category, setCategory] = useState<
    "all" | "review" | "question" | "recruit" | "free"
  >("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, postList, allVenues] = await Promise.all([
        getVenue(venueId),
        getVenuePosts(venueId, {
          sort: sortUi === "latest" ? "latest" : "popular",
          limit: 30,
        }),
        listVenues(),
      ]);
      setVenue(detail);
      setPosts(postList);
      setVenues(allVenues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "수영장 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [sortUi, venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredVenues = venues.filter((v) => {
    const q = poolSearch.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      v.name.toLowerCase().includes(q) ||
      (v.region ?? "").toLowerCase().includes(q)
    );
  });

  function switchVenue(id: string) {
    setDropdownOpen(false);
    router.push(`/venues/${id}`);
  }

  const categoryCounts = useMemo(() => {
    const counts = { all: posts.length, review: 0, question: 0, recruit: 0, free: 0 };
    for (const post of posts) {
      if (post.category === "review") {
        counts.review += 1;
      } else if (post.category === "question" || post.category === "info") {
        counts.question += 1;
      } else if (post.category === "recruit") {
        counts.recruit += 1;
      } else if (post.category === "free") {
        counts.free += 1;
      }
    }
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (category === "all") {
      return posts;
    }
    return posts.filter((post) => {
      if (category === "review") {
        return post.category === "review";
      }
      if (category === "question") {
        return post.category === "question" || post.category === "info";
      }
      if (category === "recruit") {
        return post.category === "recruit";
      }
      return post.category === "free";
    });
  }, [category, posts]);

  const [loginSheetOpen, setLoginSheetOpen] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);

  return (
    <div className="venue-hub">
      <SiteGnb />

      <div className="pool-bar">
        <div className="pool-bar-inner">
          <nav className="breadcrumb">
            <Link href="/">홈</Link>
            <span className="sep ms" aria-hidden="true">
              chevron_right
            </span>
            <span className="cur">우리 수영장</span>
          </nav>
          <div className="pool-selector-wrap">
            <button
              type="button"
              className={`pool-selector-btn${dropdownOpen ? " open" : ""}`}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <span className="ms" aria-hidden="true">
                pool
              </span>
              {venue?.name ?? "수영장"}
              <span className="ms arrow" aria-hidden="true">
                expand_more
              </span>
            </button>
            <div className={`pool-dropdown${dropdownOpen ? " open" : ""}`}>
              <div className="pd-search">
                <input
                  type="search"
                  placeholder="수영장 검색…"
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                />
              </div>
              <div className="pd-list">
                {filteredVenues.map((v) => (
                  <button
                    key={v.venue_id}
                    type="button"
                    className={`pd-item${v.venue_id === venueId ? " on" : ""}`}
                    onClick={() => switchVenue(v.venue_id)}
                  >
                    <span className="ms" aria-hidden="true">
                      pool
                    </span>
                    {v.name}
                  </button>
                ))}
              </div>
              <div className="pd-footer">
                <Link href="/group/find" className="pd-footer-btn">
                  <span className="ms" aria-hidden="true">
                    add
                  </span>
                  수영장 등록 요청
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mob-tabs">
        {(
          [
            ["all", "apps", "전체"],
            ["review", "star", "시설 후기"],
            ["question", "help", "질문·정보"],
            ["recruit", "group_add", "동반수영"],
            ["free", "chat_bubble", "자유"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={`mob-tab${category === id ? " on" : ""}`}
            data-cat={id}
            onClick={() => setCategory(id)}
          >
            <span className="ms" aria-hidden="true">
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ padding: 24, color: "var(--gray-500)", fontSize: 14 }}>
          불러오는 중…
        </p>
      )}
      {error && <div className="alert-error">{error}</div>}

      {venue && !loading && (
        <div className="page">
          <aside className="sb">
            <div className="pool-info-card">
              <div className="pic-label">현재 수영장</div>
              <div className="pic-name">{venue.name}</div>
              <div className="pic-addr">
                <span className="ms" aria-hidden="true">
                  location_on
                </span>
                {venue.address ?? venue.region ?? ""}
              </div>
              <div className="pic-stats">
                <div className="pic-stat">
                  <div className="sv">{venue.group_count}</div>
                  <div className="sl">멤버</div>
                </div>
                <div className="pic-stat">
                  <div className="sv">{Math.max(1, Math.round(venue.post_count / 10))}.0★</div>
                  <div className="sl">시설 평점</div>
                </div>
                <div className="pic-stat">
                  <div className="sv">25m</div>
                  <div className="sl">레인 길이</div>
                </div>
                <div className="pic-stat">
                  <div className="sv">8개</div>
                  <div className="sl">레인 수</div>
                </div>
              </div>
              <div className="pic-tags">
                <span className="pic-tag">주차 가능</span>
                <span className="pic-tag">사우나</span>
                <span className="pic-tag">새벽반 운영</span>
              </div>
              <div className="pic-my-lane">
                <div className="av-sm">이</div>
                <div className="txt">
                  <b>이레인</b> · 중급반 소속
                </div>
              </div>
            </div>

            <div className="sb-block">
              <div className="sb-title">게시판</div>
              {(
                [
                  ["all", "apps", "전체"],
                  ["review", "star", "시설 후기"],
                  ["question", "help", "질문·정보"],
                  ["recruit", "group_add", "동반수영 모집"],
                  ["free", "chat_bubble", "자유"],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`sb-item${category === id ? " on" : ""}`}
                  data-cat={id}
                  onClick={() => setCategory(id)}
                >
                  <span className="ms" aria-hidden="true">
                    {icon}
                  </span>
                  {label}
                  {id === "recruit" && categoryCounts.recruit > 0 ? (
                    <span className="new-dot" aria-hidden="true" />
                  ) : id !== "recruit" && categoryCounts[id] > 0 ? (
                    <span className="ct">{categoryCounts[id]}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <Link
              href={`/community/write?category=venue&venue=${venueId}`}
              className="sb-cta"
            >
              <span className="ms" aria-hidden="true">
                edit
              </span>
              글 쓰기
            </Link>
          </aside>

          <main className="feed">
            <div className="pool-hero">
              <div className="ph-top">
                <div className="ph-icon">
                  <span className="ms" aria-hidden="true">
                    pool
                  </span>
                </div>
                <div className="ph-texts">
                  <div className="ph-eyebrow">우리 수영장 커뮤니티 · 2층</div>
                  <div className="ph-title">{venue.name}</div>
                  <div className="ph-addr">
                    <span className="ms" aria-hidden="true">
                      location_on
                    </span>
                    {venue.address ?? venue.region ?? "주소 미등록"}
                  </div>
                  <div className="ph-chips">
                    <span className="ph-chip my">
                      <span className="ms" aria-hidden="true" style={{ fontSize: 10 }}>
                        check_circle
                      </span>
                      내 수영장
                    </span>
                    <span className="ph-chip">주차 가능</span>
                    <span className="ph-chip">사우나</span>
                    <span className="ph-chip">새벽 5:30 오픈</span>
                  </div>
                </div>
              </div>
              <div className="ph-stats">
                <div className="ph-stat">
                  <span className="sv">{venue.group_count}</span>
                  <span className="sl">멤버</span>
                </div>
                <div className="ph-stat">
                  <span className="sv">{venue.post_count}</span>
                  <span className="sl">이번 달 게시글</span>
                </div>
                <div className="ph-stat">
                  <span className="sv">{Math.max(1, Math.round(venue.post_count / 10))}.0★</span>
                  <span className="sl">시설 평점</span>
                </div>
                <div className="ph-stat">
                  <span className="sv">오늘 {Math.min(99, posts.length + 12)}명</span>
                  <span className="sl">활동 중</span>
                </div>
              </div>
              <div className="ph-actions">
                <Link href="/group" className="ph-action-btn primary">
                  <span className="ms" aria-hidden="true">
                    forum
                  </span>
                  레인방 입장
                </Link>
                <button type="button" className="ph-action-btn secondary">
                  <span className="ms" aria-hidden="true">
                    share
                  </span>
                  수영장 공유
                </button>
                <button type="button" className="ph-action-btn secondary">
                  <span className="ms" aria-hidden="true">
                    info
                  </span>
                  시설 정보
                </button>
              </div>
            </div>

            <div className="active-strip">
              <div className="as-label">
                <span className="ms" aria-hidden="true">
                  circle
                </span>
                지금 활동 중
              </div>
              <div className="as-avatars">
                <div className="as-av" style={{ background: "var(--aqua)" }}>이</div>
                <div className="as-av" style={{ background: "var(--coral)" }}>김</div>
                <div className="as-av" style={{ background: "var(--navy)" }}>박</div>
                <div className="as-av" style={{ background: "var(--mint)" }}>최</div>
                <div className="as-av" style={{ background: "var(--gray-300)" }}>
                  +{Math.max(3, posts.length)}
                </div>
              </div>
              <div className="as-sep" />
              <div className="as-text">
                <b>{posts[0]?.nickname ?? "레인 멤버"}</b>님이 방금 기록을 올렸어요.
              </div>
              <div className="as-time">방금</div>
            </div>

            <div className="notice-card">
              <div className="nc-icon">
                <span className="ms" aria-hidden="true">
                  campaign
                </span>
              </div>
              <div className="nc-body">
                <div className="nc-label">공지</div>
                <div className="nc-text">
                  6월 시설 보수 안내 — 일부 레인 임시 폐쇄, 나머지 레인 정상 운영
                </div>
              </div>
              <div className="nc-time">2일 전</div>
            </div>

            <div className="feed-tabs">
              {(
                [
                  ["all", "전체"],
                  ["review", "⭐ 시설 후기"],
                  ["question", "❓ 질문·정보"],
                  ["recruit", "🤝 동반수영 모집"],
                  ["free", "💬 자유"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`feed-tab${category === id ? " on" : ""}`}
                  data-cat={id}
                  onClick={() => setCategory(id)}
                >
                  {label}
                  {id === "recruit" && categoryCounts.recruit > 0 ? (
                    <span className="new-dot" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>

            <div className="feed-toolbar">
              <div className="ft-count">
                총 <b>{filteredPosts.length}</b>개 게시글
              </div>
              <div className="sort-wrap">
                <button
                  type="button"
                  className="ft-sort"
                  onClick={() => setSortOpen((open) => !open)}
                >
                  <span className="ms" aria-hidden="true">
                    swap_vert
                  </span>
                  {sortUi === "latest"
                    ? "최신순"
                    : sortUi === "popular"
                      ? "인기순"
                      : "댓글 많은 순"}
                </button>
                <div className={`sort-dropdown${sortOpen ? " open" : ""}`}>
                  {(
                    [
                      ["latest", "schedule", "최신순"],
                      ["popular", "trending_up", "인기순"],
                      ["comments", "comment", "댓글 많은 순"],
                    ] as const
                  ).map(([id, icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`sort-opt${sortUi === id ? " on" : ""}`}
                      onClick={() => {
                        setSortUi(id);
                        setSortOpen(false);
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        {icon}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="posts">
              {filteredPosts.length === 0 && (
                <div className="empty-state">
                  <p className="es-t">아직 글이 없어요</p>
                  <p className="es-s">이 수영장의 첫 후기를 남겨 보세요.</p>
                </div>
              )}

              {filteredPosts.map((post, index) => {
                const isKickpani =
                  post.category === "record_share" ||
                  post.tags.includes("kickpani");
                if (isKickpani) {
                  return (
                    <div key={post.post_id} className="rec-bot" data-cat="all">
                      <div className="rb-head">
                        <span className="ms" aria-hidden="true">
                          pool
                        </span>
                        기록 공유 · 자동 게시
                      </div>
                      <p className="rb-body">{post.content}</p>
                      <div className="rb-link">기록 보기 →</div>
                    </div>
                  );
                }

                const cat = getCategoryMeta(post.category);
                const isPinned = index === 0 && post.category === "review";
                const laneClass =
                  post.category === "recruit"
                    ? "l4"
                    : post.category === "review"
                      ? "l3"
                      : post.category === "free"
                        ? "l4"
                        : "l1";
                const laneLabel =
                  { l1: "입문", l2: "초급", l3: "중급", l4: "상급" }[laneClass] ?? "입문";

                return (
                  <Link
                    key={post.post_id}
                    href={`/community/${post.post_id}`}
                    className={`post${isPinned ? " pinned" : ""}`}
                    data-cat={post.category === "info" ? "question" : post.category}
                  >
                    {isPinned ? (
                      <div className="pin-row">
                        <span className="ms" aria-hidden="true">
                          push_pin
                        </span>
                        고정 게시글
                      </div>
                    ) : null}
                    <div className="post-head">
                      <div
                        className={`av ${avatarVariant(post.nickname ?? "?")}`}
                      >
                        {avatarInitial(post.nickname ?? "?")}
                      </div>
                      <div className="ph-info">
                        <div className="ph-line1">
                          <span className="ph-name">{post.nickname ?? "익명"}</span>
                          <span className={`lane-pill ${laneClass}`}>{laneLabel}</span>
                          <span className={`cat-pill ${post.category}`}>
                            {cat.label}
                          </span>
                        </div>
                        <div className="ph-line2">
                          {venue.name}
                          <span className="ph-dot" />
                          {new Date(post.created_at).toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                      <div className="post-more-wrap">
                        <button
                          type="button"
                          className="ph-action"
                          aria-label="더보기"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenPostMenuId((id) =>
                              id === post.post_id ? null : post.post_id,
                            );
                          }}
                        >
                          <span className="ms" aria-hidden="true">
                            more_horiz
                          </span>
                        </button>
                        <div
                          className={`post-menu${openPostMenuId === post.post_id ? " open" : ""}`}
                        >
                          <button type="button" className="pm-item">
                            <span className="ms" aria-hidden="true">
                              bookmark
                            </span>
                            저장
                          </button>
                          <button type="button" className="pm-item">
                            <span className="ms" aria-hidden="true">
                              share
                            </span>
                            공유
                          </button>
                          <div className="pm-divider" />
                          <button type="button" className="pm-item danger">
                            <span className="ms" aria-hidden="true">
                              flag
                            </span>
                            신고
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="post-title">
                      {post.title || post.content.slice(0, 80)}
                    </div>
                    <p className="post-body">{post.content.slice(0, 160)}</p>
                    {post.tags.length > 0 ? (
                      <div className="post-tags">
                        {post.tags.slice(0, 5).map((tag) => (
                          <span key={tag} className="tag">
                            {tag.startsWith("#") ? tag : `#${tag}`}
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
                      <span className="pa-btn">
                        <span className="ms" aria-hidden="true">
                          share
                        </span>
                        공유
                      </span>
                      <div className="pa-spacer" />
                      <span className="pa-btn bm">
                        <span className="ms" aria-hidden="true">
                          bookmark
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {filteredPosts.length > 0 ? (
              <button type="button" className="load-more-btn">
                <span className="ms" aria-hidden="true">
                  expand_more
                </span>
                더 보기
              </button>
            ) : null}
          </main>

          <aside className="sb-r">
            <div className="my-lane-widget">
              <div className="mlw-label">내 레인방</div>
              <div className="mlw-row">
                <div className="mlw-av">이</div>
                <div className="mlw-info">
                  <div className="mlw-name">이레인</div>
                  <div className="mlw-sub">잠실 중급반 · 월수금 07:00</div>
                </div>
              </div>
              <div className="mlw-divider" />
              <div className="mlw-stat">
                <span>5월 목표 달성률</span>
                <b>74%</b>
              </div>
              <div className="mlw-bar">
                <div className="mlw-bar-fill" style={{ width: "74%" }} />
              </div>
              <Link href="/group" className="mlw-btn">
                <span className="ms" aria-hidden="true">
                  forum
                </span>
                레인방 바로가기
              </Link>
            </div>

            <div className="widget">
              <div className="widget-title">
                <span className="ms" aria-hidden="true">
                  star
                </span>
                시설 평점 · 종합
              </div>
              <div className="review-summary">
                <div className="rs-score">
                  <div className="score">
                    {Math.max(1, Math.round(venue.post_count / 10))}.2
                  </div>
                  <div className="stars">
                    <span className="star">★</span>
                    <span className="star">★</span>
                    <span className="star">★</span>
                    <span className="star">★</span>
                    <span className="star off">★</span>
                  </div>
                  <div className="out-of">{categoryCounts.review}개 후기</div>
                </div>
                <div className="rs-bars">
                  <div className="rs-bar-row">
                    <span className="lbl">5★</span>
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{ width: "55%", background: "var(--success)" }}
                      />
                    </div>
                    <span className="ct">24</span>
                  </div>
                  <div className="rs-bar-row">
                    <span className="lbl">4★</span>
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{ width: "30%", background: "var(--sun)" }}
                      />
                    </div>
                    <span className="ct">13</span>
                  </div>
                  <div className="rs-bar-row">
                    <span className="lbl">3★</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: "10%" }} />
                    </div>
                    <span className="ct">4</span>
                  </div>
                </div>
              </div>
              <div className="review-tags-row">
                <span className="rev-tag">
                  <span className="ms" aria-hidden="true">
                    check
                  </span>
                  청결
                </span>
                <span className="rev-tag">
                  <span className="ms" aria-hidden="true">
                    check
                  </span>
                  넓은 레인
                </span>
                <span className="rev-tag">
                  <span className="ms" aria-hidden="true">
                    check
                  </span>
                  친절한 강사
                </span>
              </div>
            </div>

            <div className="widget">
              <div className="widget-title">
                <span className="ms" aria-hidden="true">
                  local_fire_department
                </span>
                이번 주 활발한 레인
              </div>
              <div className="lane-rank">
                {[1, 2, 3, 4].map((rank) => (
                  <div key={rank} className="lr-item">
                    <div className={`lr-num${rank <= 3 ? " top" : ""}`}>{rank}</div>
                    <div className="lr-av" style={{ background: "var(--aqua)" }}>
                      {rank === 1 ? "이" : rank === 2 ? "김" : rank === 3 ? "최" : "박"}
                    </div>
                    <div className="lr-info">
                      <div className="lr-name">
                        {rank === 1
                          ? "이레인"
                          : rank === 2
                            ? "김수영"
                            : rank === 3
                              ? "최수련"
                              : "박민준"}
                      </div>
                      <div className="lr-sub">{venue.name}</div>
                    </div>
                    <div className="lr-badge">글 {12 - rank * 2}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="widget">
              <div className="widget-title">
                <span className="ms" aria-hidden="true">
                  tag
                </span>
                지금 뜨는 태그
              </div>
              <div className="tag-cloud">
                <span className="t-chip hot">락커룸</span>
                <span className="t-chip hot">새벽반</span>
                <span className="t-chip">평영</span>
                <span className="t-chip hot">수경추천</span>
                <span className="t-chip">자유수영</span>
                <span className="t-chip">접영</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      <Link
        href={`/community/write?category=venue&venue=${venueId}`}
        className="fab"
      >
        <span className="ms" aria-hidden="true">
          edit
        </span>
        새 글 쓰기
      </Link>

      <div
        className={`login-sheet-ov${loginSheetOpen ? " on" : ""}`}
        onClick={() => setLoginSheetOpen(false)}
        aria-hidden={!loginSheetOpen}
      />
      <div className={`login-sheet${loginSheetOpen ? " open" : ""}`}>
        <div className="ls-handle" />
        <span className="ls-icon ms" aria-hidden="true">
          lock
        </span>
        <div className="ls-title">로그인이 필요해요</div>
        <div className="ls-desc">
          글쓰기, 좋아요, 댓글 기능은
          <br />
          로그인 후 이용할 수 있어요.
        </div>
        <Link href="/login" className="ls-btn ls-btn-primary">
          로그인
        </Link>
        <Link href="/signup" className="ls-btn ls-btn-secondary">
          회원가입
        </Link>
      </div>
    </div>
  );
}
