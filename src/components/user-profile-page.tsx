"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  getUserBadges,
  getUserProfile,
  getUserPublicGroups,
  getUserPublicPosts,
  getUserPublicRecords,
  getUserPublicSummary,
  reportUser,
  type FeedPost,
  type PublicGroupItem,
  type PublicRecordItem,
  type PublicUserSummary,
  type UserBadgeItem,
  type UserProfile,
} from "@/lib/api";
import { getCategoryMeta } from "@/lib/community/categories";
import { levelLabel } from "@/lib/format/level-label";
import {
  avatarInitial,
  formatRelativeTime,
} from "@/lib/format/relative-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-user-profile.css";

type UserProfilePageProps = {
  userId: string;
};

function recordDistance(data: Record<string, unknown>): number {
  const raw = data.distance;
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function strokesLabel(data: Record<string, unknown>): string {
  const strokes = Array.isArray(data.strokes)
    ? (data.strokes as string[])
    : [];
  return strokes.length > 0 ? strokes.join(" · ") : "혼합";
}

export function UserProfilePage({ userId }: UserProfilePageProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [records, setRecords] = useState<PublicRecordItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [groups, setGroups] = useState<PublicGroupItem[]>([]);
  const [badges, setBadges] = useState<UserBadgeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const reportOptions = [
    { id: "spam", label: "스팸 / 홍보성 계정", icon: "block" },
    { id: "abuse", label: "욕설 / 비방", icon: "sentiment_very_dissatisfied" },
    { id: "fake", label: "허위 정보 / 사칭", icon: "person_off" },
    { id: "other", label: "기타", icon: "more_horiz" },
  ] as const;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [user, pubSummary, pubRecords, pubPosts, pubGroups, pubBadges] =
        await Promise.all([
          getUserProfile(userId),
          getUserPublicSummary(userId),
          getUserPublicRecords(userId, 5),
          getUserPublicPosts(userId, 10),
          getUserPublicGroups(userId),
          getUserBadges(userId),
        ]);
      setProfile(user);
      setSummary(pubSummary);
      setRecords(pubRecords);
      setPosts(pubPosts);
      setGroups(pubGroups);
      setBadges(pubBadges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setMyUserId(data.session?.user?.id ?? null);
    });
  }, []);
  async function handleSubmitReport() {
    if (!reportReason) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.alert("로그인 후 신고할 수 있습니다.");
        return;
      }
      await reportUser(
        userId,
        { reason_code: reportReason as "spam" | "abuse" | "fake" | "other" },
        session.access_token,
      );
      window.alert("신고가 접수되었습니다. 검토 후 처리됩니다.");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "신고 처리에 실패했습니다.");
    } finally {
      setReportOpen(false);
      setReportReason(null);
    }
  }


  const totalKm =
    summary && summary.total_distance >= 1000
      ? Math.round(summary.total_distance / 100) / 10
      : summary
        ? Math.round(summary.total_distance)
        : 0;

  return (
    <>
      <SiteGnb activeNav="home" />
      <div className="user-profile-screen">
        <div className="back-wrap">
          <Link href="/" className="back-btn">
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            뒤로가기
          </Link>
        </div>

        {loading && (
          <p style={{ padding: "0 32px", color: "var(--gray-500)" }}>
            불러오는 중…
          </p>
        )}
        {error && (
          <p style={{ padding: "0 32px", color: "var(--error)" }}>{error}</p>
        )}

        {profile && summary && !loading && (
          <div className="page">
            <div>
              <div className="profile-hero">
                <div className="hero-cover" />
                <div className="hero-body">
                  <div className="hero-row">
                    <div>
                      <div className="avatar-wrap">
                        <div className="profile-av">
                          {avatarInitial(profile.nickname)}
                        </div>
                      </div>
                      <h1 className="profile-name">{profile.nickname}</h1>
                      <div className="profile-meta">
                        {profile.level && (
                          <span className="level-badge">
                            {levelLabel(profile.level)}
                          </span>
                        )}
                        {groups[0]?.venue_name ? (
                          <span className="profile-pool">
                            <span className="ms" aria-hidden="true">
                              pool
                            </span>
                            {groups[0].venue_name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {myUserId !== profile.user_id && (
                      <button
                        type="button"
                        className="btn-report"
                        onClick={() => setReportOpen(true)}
                      >
                        <span className="ms" aria-hidden="true">
                          flag
                        </span>
                        신고
                      </button>
                    )}
                  </div>

                  <div className="profile-bio">
                    {profile.bio?.trim()
                      ? profile.bio
                      : profile.user_type === "instructor"
                        ? "강사 회원 · 커뮤니티 가이드를 함께 만들고 있어요."
                        : "잠실 중급반 월수금 새벽반. 자유형 위주로 수영해요"}
                  </div>

                  <div className="stats-row">
                    <div className="stat-item">
                      <div className="stat-num">{summary.swim_days}</div>
                      <div className="stat-label">활동일</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-num">
                        {summary.total_distance >= 1000
                          ? totalKm.toLocaleString()
                          : summary.total_distance.toLocaleString()}
                      </div>
                      <div className="stat-label">
                        누적 거리 ({summary.total_distance >= 1000 ? "km" : "m"})
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-num">{summary.post_count}</div>
                      <div className="stat-label">게시글</div>
                    </div>
                  </div>
                </div>
              </div>

              {groups.length > 0 && (
                <div className="affil-section">
                  <div className="sec-title">
                    <span className="ms" aria-hidden="true">
                      groups
                    </span>
                    현재 소속 반
                  </div>
                  {groups.map((g) => (
                    <div key={g.group_id} className="affil-item">
                      <div className="affil-ico">
                        <span className="ms" aria-hidden="true">
                          groups
                        </span>
                      </div>
                      <div className="affil-info">
                        <div className="affil-name">
                          {g.venue_name ?? "수영장"} · {levelLabel(g.level)}
                        </div>
                        <div className="affil-sub">{g.status}</div>
                      </div>
                      <span className="affil-badge">활동중</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="records-section">
                <div className="sec-title">
                  <span className="ms" aria-hidden="true">
                    pool
                  </span>
                  최근 공개 기록
                </div>
                {records.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    공개된 수영 기록이 없어요.
                  </p>
                ) : (
                  records.map((rec) => {
                    const dist = recordDistance(rec.record_data);
                    const memo =
                      typeof rec.record_data.memo === "string"
                        ? rec.record_data.memo
                        : "";
                    return (
                      <Link
                        key={rec.record_id}
                        href={`/record/${rec.record_id}`}
                        className="rec-item"
                      >
                        <div className="rec-ico">
                          <span className="ms" aria-hidden="true">
                            pool
                          </span>
                        </div>
                        <div className="rec-info">
                          <div className="rec-dist">
                            {dist.toLocaleString()}
                            <span> m · {strokesLabel(rec.record_data)}</span>
                          </div>
                          <div className="rec-meta">
                            {new Date(rec.recorded_at).toLocaleDateString(
                              "ko-KR",
                              { year: "numeric", month: "long", day: "numeric" },
                            )}
                          </div>
                          {memo ? <div className="rec-memo">{memo}</div> : null}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="posts-section">
                <div className="sec-title posts-sec-title">
                  <span className="ms" aria-hidden="true">
                    article
                  </span>
                  작성한 글
                  <span className="posts-count">{summary.post_count}</span>
                </div>
                {posts.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    작성한 광장 글이 없어요.
                  </p>
                ) : (
                  posts.map((post) => {
                    const cat = getCategoryMeta(post.category);
                    return (
                      <Link
                        key={post.post_id}
                        href={`/community/${post.post_id}`}
                        className="pub-post"
                      >
                        <div className="pp-cat">{cat.label}</div>
                        <div className="pp-title">
                          {post.title ?? post.content.slice(0, 80)}
                        </div>
                        <div className="pp-meta">
                          <span className="ms" aria-hidden="true">
                            favorite
                          </span>
                          {post.reaction_count}
                          <span className="ms" aria-hidden="true">
                            mode_comment
                          </span>
                          {post.comment_count}
                          <span className="ms" aria-hidden="true">
                            schedule
                          </span>
                          {formatRelativeTime(post.created_at)}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            <aside className="sidebar">
              <div className="widget">
                <div className="widget-title">
                  <span className="ms" aria-hidden="true">
                    military_tech
                  </span>
                  보유 뱃지
                </div>
                {badges.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--gray-500)" }}>
                    획득한 배지가 없어요.
                  </p>
                ) : (
                  <div className="badge-grid">
                    {badges.slice(0, 8).map((b) => (
                      <div key={b.badge_id} className="bdg-item">
                        <div className="bdg-circle">
                          <span className="ms" aria-hidden="true">
                            {b.icon}
                          </span>
                        </div>
                        <div className="bdg-label">
                          {b.label}
                          {b.earned_count > 1 ? ` ×${b.earned_count}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {groups.length > 0 && (
                <div className="widget">
                  <div className="widget-title">
                    <span className="ms" aria-hidden="true">
                      history
                    </span>
                    소속 이력
                  </div>
                  {groups.map((g, i) => (
                    <div
                      key={g.group_id}
                      className="pool-badge"
                      style={i > 0 ? { opacity: 0.6 } : undefined}
                    >
                      <span className="ms" aria-hidden="true">
                        pool
                      </span>
                      {g.venue_name ?? "수영장"} {levelLabel(g.level)}
                      {i === 0 ? " (현재)" : ""}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}

        <div
          className={`modal-ov${reportOpen ? " open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setReportOpen(false);
              setReportReason(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-title" id="report-modal-title">
              이 유저를 신고하는 이유는?
            </div>
            <div className="modal-desc">
              신고 내용은 운영팀에서 검토 후 처리됩니다.
              <br />
              허위 신고는 제재를 받을 수 있어요.
            </div>
            <div className="report-options">
              {reportOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`report-opt${reportReason === opt.id ? " on" : ""}`}
                  onClick={() => setReportReason(opt.id)}
                >
                  <span className="ms" aria-hidden="true">
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setReportOpen(false);
                  setReportReason(null);
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={`btn-submit-report${reportReason ? " active" : ""}`}
                disabled={!reportReason}
                onClick={() => void handleSubmitReport()}
              >
                신고하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
