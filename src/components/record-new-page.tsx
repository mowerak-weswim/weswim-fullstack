"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  createRecord,
  getGroup,
  getMonthlyStats,
  getMyBadges,
  getMyGroups,
  getRecord,
  getRecords,
  updateRecord,
  type MonthlyStats,
  type MyBadgesResponse,
  type SwimRecord,
} from "@/lib/api";
import { levelLabel } from "@/lib/format/level-label";
import {
  buildStrokeDistances,
  strokesFromRecord,
  toggleStrokeSelection,
} from "@/lib/records/stroke-record";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-record.css";

const STROKES: Array<{ name: string; emoji: string }> = [
  { name: "자유형", emoji: "🏊" },
  { name: "배영", emoji: "🛟" },
  { name: "평영", emoji: "🐸" },
  { name: "접영", emoji: "🦋" },
  { name: "혼합", emoji: "🌀" },
];

const PRIVACY_OPTIONS = [
  {
    value: "private" as const,
    icon: "lock",
    label: "나만 보기",
    desc: "마이페이지에만 기록",
    recommended: false,
  },
  {
    value: "group" as const,
    icon: "groups",
    label: "우리 반",
    desc: "잡담탭에 메시지 게시",
    recommended: true,
  },
  {
    value: "public" as const,
    icon: "public",
    label: "전체 공개",
    desc: "마이페이지 공개 기록",
    recommended: false,
  },
];

function formatTodayMeta() {
  const now = new Date();
  const date = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const day = now.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${date} · ${day}`;
}

function formatRecordMiniDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const label = d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return isToday ? `오늘 · ${label}` : label;
}

function kickpaniRoomLabel(venueLabel: string | null): string {
  if (!venueLabel) {
    return "우리";
  }
  const parts = venueLabel.split(" · ");
  const venue = parts[0] ?? "";
  const levelPart = parts[1] ?? "";
  const venueShort =
    venue.replace(/실내수영장|국제수영장|수영장/g, "").trim() ||
    venue.slice(0, 4);
  const level = levelPart.replace(/반$/, "").trim();
  return level ? `${venueShort} ${level}반` : venueShort;
}

function KickpaniFannySvg() {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="5" width="20" height="24" rx="6" fill="#00A8B5" />
      <rect x="9" y="8" width="14" height="2.5" rx="1.25" fill="rgba(255,255,255,.4)" />
      <circle cx="12" cy="17" r="2.2" fill="#fff" />
      <circle cx="20" cy="17" r="2.2" fill="#fff" />
      <circle cx="12.5" cy="17" r="1" fill="#1B3A5C" />
      <circle cx="20.5" cy="17" r="1" fill="#1B3A5C" />
      <path
        d="M 11 22 Q 16 26 21 22"
        stroke="#1B3A5C"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="9" cy="20" r="1.2" fill="rgba(232,115,74,.45)" />
      <circle cx="23" cy="20" r="1.2" fill="rgba(232,115,74,.45)" />
    </svg>
  );
}

export function RecordNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRecordId = searchParams.get("edit");
  const isEditMode = Boolean(editRecordId);

  const [screenState, setScreenState] = useState<"form" | "success">("form");
  const [distance, setDistance] = useState(1500);
  const [baseDistance, setBaseDistance] = useState(0);
  const [strokes, setStrokes] = useState<string[]>(["자유형", "평영"]);
  const [memo, setMemo] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "group" | "public">("group");
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [badges, setBadges] = useState<MyBadgesResponse | null>(null);
  const [recentRecords, setRecentRecords] = useState<SwimRecord[]>([]);
  const [venueLabel, setVenueLabel] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("회원");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace(
          isEditMode && editRecordId
            ? `/login?next=/record/new?edit=${editRecordId}`
            : "/login?next=/record/new",
        );
        return;
      }

      const meta = session.user.user_metadata as { nickname?: string };
      setNickname(meta?.nickname ?? session.user.email?.split("@")[0] ?? "회원");

      const [monthly, records, groups, badgeData] = await Promise.all([
        getMonthlyStats(session.access_token),
        getRecords(session.access_token, { limit: 4 }),
        getMyGroups(session.access_token),
        getMyBadges(session.access_token),
      ]);
      setStats(monthly);
      setRecentRecords(records);
      setBadges(badgeData);

      if (groups[0]) {
        setGroupId(groups[0].group_id);
        const detail = await getGroup(groups[0].group_id);
        const venue = detail.venue_name ?? "수영장";
        const level = levelLabel(detail.level);
        setVenueLabel(`${venue} · ${level}반`);
      } else {
        setGroupId(null);
      }

      if (editRecordId) {
        const record = await getRecord(editRecordId, session.access_token);
        if (record.user_id !== session.user.id) {
          router.replace(`/record/${editRecordId}`);
          return;
        }
        const data = record.record_data;
        const dist = Number(data.distance ?? 0);
        setDistance(dist);
        setBaseDistance(dist);
        setStrokes(strokesFromRecord(data));
        setMemo(typeof data.memo === "string" ? data.memo : "");
        setPrivacy(
          (record.is_public as "private" | "group" | "public") ?? "group",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "통계를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [editRecordId, isEditMode, router]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const heroProgress = useMemo(() => {
    if (!stats) {
      return null;
    }
    const total = isEditMode
      ? stats.total_distance - baseDistance + distance
      : stats.total_distance + distance;
    const goal = stats.goal_distance > 0 ? stats.goal_distance : 25_000;
    const pct = Math.min(100, Math.round((total / goal) * 100));
    return {
      total,
      goal,
      remain: Math.max(0, goal - total),
      pct,
    };
  }, [stats, isEditMode, baseDistance, distance]);

  const sidebarBadges = useMemo(() => {
    if (!badges) {
      return [];
    }
    const earned = badges.earned.slice(0, 3);
    const slots = 6 - earned.length;
    const progress = badges.in_progress.slice(0, Math.max(0, slots));
    return [
      ...earned.map((b) => ({ ...b, earned: true as const })),
      ...progress.map((b) => ({ ...b, earned: false as const })),
    ].slice(0, 6);
  }, [badges]);

  const nextBadgeProgress = useMemo(
    () => badges?.in_progress[0] ?? null,
    [badges],
  );

  function toggleStroke(name: string) {
    setStrokes((prev) => toggleStrokeSelection(prev, name));
  }

  function addDistance(delta: number) {
    setDistance((d) => Math.max(0, Math.min(99999, d + delta)));
  }

  async function handleSave(forceGroupShare = false) {
    if (distance <= 0) {
      setError("거리를 입력해 주세요.");
      return;
    }
    if (strokes.length === 0) {
      setError("주요 영법을 하나 이상 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const isPublic = forceGroupShare ? "group" : privacy;

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/record/new");
        return;
      }

      const payload = {
        record_data: {
          distance,
          strokes,
          stroke_distances: buildStrokeDistances(distance, strokes),
          memo: memo.trim() || null,
        },
        is_public: isPublic,
        recorded_at: new Date().toISOString().slice(0, 10),
      };

      if (isEditMode && editRecordId) {
        await updateRecord(editRecordId, payload, session.access_token);
        router.push(`/record/${editRecordId}`);
        router.refresh();
        return;
      }

      await createRecord(payload, session.access_token);
      setPrivacy(isPublic);
      await loadStats();
      setScreenState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const distEmpty = distance === 0;
  const memoWarn = memo.length >= 90;
  const displayVenuePill = venueLabel ?? "수영장 · —";
  const kickpaniRoom = kickpaniRoomLabel(venueLabel);
  const successMonthlyTotal = stats?.total_distance ?? 0;
  const successStreakLabel = stats ? `${stats.swim_days}일` : "0일";
  const groupHref = groupId ? `/group?group=${groupId}` : "/group";

  return (
    <div className="record-screen" data-state={screenState}>
      <SiteGnb activeNav="record" />
      <div className="page">
          <div className="crumb">
            <Link href="/">홈</Link>
            <span className="ms sep" aria-hidden="true">
              chevron_right
            </span>
            <Link href="/my">기록</Link>
            <span className="ms sep" aria-hidden="true">
              chevron_right
            </span>
            <b>오늘의 기록</b>
          </div>

          <div className="page-head">
            <div>
              <h1>
                {isEditMode ? (
                  <>
                    기록 <span className="accent">수정</span>하기
                  </>
                ) : (
                  <>
                    오늘의 <span className="accent">레인</span> 기록
                  </>
                )}
              </h1>
              <div className="sub">
                탈의실에서 <b>30초</b>면 끝나요. 빠른 추가 버튼으로 거리를
                채워보세요.
              </div>
            </div>
            <div className="timer-wrap">
              <div className="timer-chip">
                <span className="ms" aria-hidden="true">
                  timer
                </span>
                목표: <b style={{ marginLeft: 2 }}>30초</b> 안에 입력하기
              </div>
              <div className="timer-bar">
                <div className="timer-fill" />
              </div>
              <div className="timer-bar-meta">
                <span>00:00</span>
                <span>
                  도전 <b>🙌</b>
                </span>
                <span>00:30</span>
              </div>
            </div>
          </div>

          {error ? (
            <p style={{ color: "var(--error)", marginBottom: 16 }}>{error}</p>
          ) : null}

          <div className="main">
            <section className="form-panel">
              <div className="hero-dist">
                <div className="meta-row">
                  <span className="meta-pill editable" title="날짜 변경">
                    <span className="ms" aria-hidden="true">
                      event
                    </span>
                    {formatTodayMeta()}
                  </span>
                  <span
                    className="meta-pill lock"
                    title="소속 반 기준 자동 입력"
                  >
                    <span className="ms" aria-hidden="true">
                      pool
                    </span>
                    {displayVenuePill}
                    <span
                      className="ms"
                      style={{
                        fontSize: 13,
                        marginLeft: 2,
                        color: "rgba(255,255,255,.4)",
                      }}
                      aria-hidden="true"
                    >
                      lock
                    </span>
                  </span>
                </div>

                <div className="dist-label">총 수영 거리</div>
                <div className="dist-display">
                  <span
                    className={`dist-number-text${distEmpty ? " empty" : ""}`}
                  >
                    {distance.toLocaleString()}
                  </span>
                  <span className="dist-unit">m</span>
                  <div className="dist-actions-tiny">
                    <button
                      type="button"
                      className="dist-step"
                      title="-50m"
                      onClick={() => addDistance(-50)}
                    >
                      <span className="ms" aria-hidden="true">
                        remove
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dist-step"
                      title="+50m"
                      onClick={() => addDistance(50)}
                    >
                      <span className="ms" aria-hidden="true">
                        add
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dist-step"
                      title="초기화"
                      onClick={() => setDistance(0)}
                    >
                      <span className="ms" aria-hidden="true">
                        refresh
                      </span>
                    </button>
                  </div>
                </div>

                <div className="quick-row">
                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => addDistance(100)}
                  >
                    <b>+ 100</b>m
                  </button>
                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => addDistance(500)}
                  >
                    <b>+ 500</b>m
                  </button>
                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => addDistance(1000)}
                  >
                    <b>+ 1,000</b>m
                  </button>
                </div>

                {heroProgress ? (
                  <div className="hero-progress">
                    <div className="hp-row">
                      <span>
                        이번 달 목표까지{" "}
                        <b>{heroProgress.remain.toLocaleString()}m</b>
                      </span>
                      <span>
                        <b>{heroProgress.total.toLocaleString()}</b> /{" "}
                        {heroProgress.goal.toLocaleString()}m{" "}
                        <span className="pct" style={{ marginLeft: 6 }}>
                          {heroProgress.pct}%
                        </span>
                      </span>
                    </div>
                    <div className="hp-bar">
                      <div
                        className="hp-fill"
                        style={{ width: `${heroProgress.pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="form-body">
                <div>
                  <div className="field-label">
                    <span className="ms" aria-hidden="true">
                      waves
                    </span>
                    주요 영법
                    <span className="opt">복수 선택 가능</span>
                  </div>
                  <div className="stroke-row" id="strokeRow">
                    {STROKES.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        className={`stroke${strokes.includes(s.name) ? " on" : ""}`}
                        onClick={() => toggleStroke(s.name)}
                      >
                        <span className="emoji">{s.emoji}</span>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="field-label">
                    <span className="ms" aria-hidden="true">
                      edit_note
                    </span>
                    한 줄 메모
                    <span className="opt">선택 · 100자</span>
                  </div>
                  <div className="memo-wrap">
                    <textarea
                      placeholder="오늘 어땠나요? 턴이 좋았는지, 컨디션은 어땠는지 짧게 남겨봐요"
                      maxLength={100}
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                    <div className="memo-footer">
                      <button type="button" className="emoji-btn">
                        <span
                          className="ms"
                          style={{ fontSize: 14 }}
                          aria-hidden="true"
                        >
                          mood
                        </span>
                        이모지
                      </button>
                      <span
                        className={`memo-count${memoWarn ? " warn" : ""}`}
                      >
                        {memo.length} / 100
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="field-label">
                    <span className="ms" aria-hidden="true">
                      visibility
                    </span>
                    공개 범위
                    <span className="opt">기본 — 우리 반에 자동 공유</span>
                  </div>
                  <div className="privacy-row" id="privacyRow">
                    {PRIVACY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`priv${privacy === opt.value ? " on" : ""}${opt.recommended ? " recommended" : ""}`}
                        onClick={() => setPrivacy(opt.value)}
                      >
                        <span className="ms" aria-hidden="true">
                          {opt.icon}
                        </span>
                        <span className="lbl">{opt.label}</span>
                        <span className="desc">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-aq"
                  disabled={saving || loading}
                  onClick={() => void handleSave(false)}
                >
                  <span className="ms" aria-hidden="true">
                    save
                  </span>
                  {isEditMode ? "수정 저장" : "레인에 저장"}
                </button>
                {!isEditMode && (
                  <button
                    type="button"
                    className="btn btn-co"
                    disabled={saving || loading}
                    onClick={() => void handleSave(true)}
                  >
                    <span className="ms" aria-hidden="true">
                      share
                    </span>
                    저장 후 우리반에 공유
                  </button>
                )}
              </div>

              {!isEditMode && (
                <div className="success-state">
                  <div className="succ-check">
                    <span className="ms" aria-hidden="true">
                      check
                    </span>
                  </div>
                  <div className="succ-title">
                    <span className="km">{distance.toLocaleString()}m</span>{" "}
                    기록이 레인에 저장됐어요!
                  </div>
                  <div className="succ-sub">
                    {formatTodayMeta()}
                    {` · ${displayVenuePill.split(" · ")[0]}`}
                    {strokes.length > 0 ? ` · ${strokes.join(" + ")}` : ""}
                  </div>

                  <div className="succ-stats">
                    <div className="ss-cell">
                      <span className="ms" aria-hidden="true">
                        trending_up
                      </span>
                      <div className="v">{successMonthlyTotal.toLocaleString()}</div>
                      <div className="l">이달 누적 (m)</div>
                    </div>
                    <div className="ss-cell flame">
                      <span className="ms" aria-hidden="true">
                        local_fire_department
                      </span>
                      <div className="v">{successStreakLabel}</div>
                      <div className="l">연속 운동</div>
                    </div>
                    <div className="ss-cell medal">
                      <span className="ms" aria-hidden="true">
                        workspace_premium
                      </span>
                      <div className="v">
                        {nextBadgeProgress
                          ? `${nextBadgeProgress.current_value.toLocaleString()}/${nextBadgeProgress.condition_value.toLocaleString()}`
                          : "—"}
                      </div>
                      <div className="l">
                        {nextBadgeProgress
                          ? `${nextBadgeProgress.label}까지`
                          : "다음 뱃지"}
                      </div>
                    </div>
                  </div>

                  <div className="bot-preview-label">
                    <span className="ms" aria-hidden="true">
                      auto_awesome
                    </span>
                    {kickpaniRoom} 잡담탭에 킥파니가 축하해줘요!
                  </div>
                  <div className="bot-preview">
                    <div className="bp-head">
                      <span className="fanny" aria-hidden="true">
                        <KickpaniFannySvg />
                      </span>
                      <span className="fanny-tag">킥파니</span>
                      <span className="bp-where">기록 축하 · 방금</span>
                    </div>
                    <div className="bp-body">
                      🎉 오늘도 구다구는{" "}
                      <b className="user">{nickname}</b>님!{" "}
                      <span className="km">{distance.toLocaleString()}m</span>{" "}
                      완주했어요. 다음 용월수금에도 구다구다 만나요!
                    </div>
                  </div>

                  <div className="succ-actions">
                    <Link href={groupHref} className="btn btn-aq">
                      <span className="ms" aria-hidden="true">
                        forum
                      </span>
                      우리반 가기
                    </Link>
                    <Link href={groupHref} className="btn btn-co">
                      <span className="ms" aria-hidden="true">
                        share
                      </span>
                      우리반에 지금 공유하기
                    </Link>
                  </div>

                  <button
                    type="button"
                    className="secondary-link"
                    id="recordAgain"
                    onClick={() => {
                      setScreenState("form");
                      setDistance(1500);
                      setMemo("");
                    }}
                  >
                    <span className="ms" aria-hidden="true">
                      restart_alt
                    </span>
                    새 기록 작성하기
                  </button>
                </div>
              )}
            </section>

            <div className="sidebar">
              <div className="widget">
                <div className="widget-title">
                  <span className="ms" aria-hidden="true">
                    military_tech
                  </span>
                  진행 중 뱃지
                </div>
                <div className="badge-grid">
                  {loading && (
                    <p
                      style={{
                        gridColumn: "1 / -1",
                        fontSize: 12,
                        color: "var(--gray-500)",
                      }}
                    >
                      …
                    </p>
                  )}
                  {!loading && sidebarBadges.length === 0 && (
                    <p
                      style={{
                        gridColumn: "1 / -1",
                        fontSize: 12,
                        color: "var(--gray-500)",
                      }}
                    >
                      진행 중인 뱃지가 없어요.
                    </p>
                  )}
                  {!loading &&
                    sidebarBadges.map((item) =>
                      "earned_count" in item ? (
                        <div
                          key={item.badge_id}
                          className="badge-item earned"
                        >
                          <div className="badge-ico">
                            <span className="ms" aria-hidden="true">
                              {item.icon}
                            </span>
                          </div>
                          <div className="badge-lbl">{item.label}</div>
                          {item.earned_count > 1 ? (
                            <div className="badge-count">
                              ×{item.earned_count}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div key={item.badge_id} className="badge-item">
                          <div className="badge-ico">
                            <span className="ms" aria-hidden="true">
                              {item.icon}
                            </span>
                          </div>
                          <div className="badge-lbl">{item.label}</div>
                        </div>
                      ),
                    )}
                </div>
              </div>

              <div className="widget">
                <div className="widget-title">
                  <span className="ms" aria-hidden="true">
                    history
                  </span>
                  최근 기록
                </div>
                {loading && (
                  <p style={{ fontSize: 12, color: "var(--gray-500)" }}>…</p>
                )}
                {!loading && recentRecords.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--gray-500)" }}>
                    아직 기록이 없어요.
                  </p>
                )}
                {!loading &&
                  recentRecords.map((rec) => {
                    const dist = Number(rec.record_data.distance ?? 0);
                    const recStrokes = strokesFromRecord(rec.record_data);
                    return (
                      <Link
                        key={rec.record_id}
                        href={`/record/${rec.record_id}`}
                        className="rec-mini"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="rec-mini-dist">
                          {dist.toLocaleString()}
                          <span>m</span>
                        </div>
                        <div className="rec-mini-info">
                          <div className="rec-mini-date">
                            {formatRecordMiniDate(rec.recorded_at)}
                          </div>
                          <div className="rec-mini-stroke">
                            {recStrokes.length > 0
                              ? recStrokes.join(" · ")
                              : "—"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
