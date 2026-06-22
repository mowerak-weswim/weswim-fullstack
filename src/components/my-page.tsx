"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GroupKindBadge } from "@/components/group-kind-badge";
import { MyBadgeCollection } from "@/components/my-badge-collection";
import { SiteGnb } from "@/components/layout/site-gnb";
import {
  getMonthlyStats,
  getMyBadges,
  getMyGroups,
  getMyProfile,
  getRecords,
  listBadges,
  type BadgeDefinition,
  type GroupMembership,
  type MonthlyStats,
  type MyBadgesResponse,
  type SwimRecord,
  type UserProfile,
} from "@/lib/api";
import {
  formatGroupMetaLine,
  formatGroupTitleLine,
  isRegisteredGroup,
  isWaitingGroup,
} from "@/lib/group-membership-display";
import { levelLabel } from "@/lib/format/level-label";
import { avatarInitial } from "@/lib/format/relative-time";
import { computeMonthlyStrokeStats } from "@/lib/records/stroke-stats";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-group-membership.css";
import "@/styles/weswim-my.css";

type CalendarCell = {
  day: number | null;
  classes: string[];
};

const AVATAR_STORAGE_KEY = "weswim_profile_avatar_data_url";

function buildMonthCalendar(
  year: number,
  month: number,
  swimDays: Set<number>,
  longDays: Set<number>,
): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const td = today.getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ day: null, classes: [] });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isFuture =
      year > ty ||
      (year === ty && month - 1 > tm) ||
      (year === ty && month - 1 === tm && day > td);
    const isToday = year === ty && month - 1 === tm && day === td;
    const classes: string[] = [];
    if (isFuture) {
      classes.push("future");
    } else {
      if (swimDays.has(day)) {
        classes.push("swim");
        if (longDays.has(day)) {
          classes.push("long");
        }
      }
      if (isToday) {
        classes.push("today");
      }
    }
    cells.push({ day, classes });
  }
  return cells;
}

function formatRecordRowDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = d.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${y}.${m}.${day} ${wd}`;
}

function strokesFromRecord(data: Record<string, unknown>): string[] {
  return Array.isArray(data.strokes) ? (data.strokes as string[]) : [];
}

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

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreakFromDays(days: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.has(localDateKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function visPill(isPublic: string) {
  if (isPublic === "public") {
    return { className: "vis-pill pub", icon: "public", label: "전체공개" };
  }
  if (isPublic === "group") {
    return { className: "vis-pill group", icon: "group", label: "우리반" };
  }
  return { className: "vis-pill private", icon: "lock", label: "나만보기" };
}

export function MyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [records, setRecords] = useState<SwimRecord[]>([]);
  const [allRecords, setAllRecords] = useState<SwimRecord[]>([]);
  const [badges, setBadges] = useState<MyBadgesResponse | null>(null);
  const [badgeCatalog, setBadgeCatalog] = useState<BadgeDefinition[]>([]);
  const [recordMonth, setRecordMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/my");
        return;
      }
      const token = session.access_token;
      const [
        me,
        monthly,
        myGroups,
        monthRecords,
        recentRecords,
        badgeData,
        catalog,
      ] = await Promise.all([
        getMyProfile(token),
        getMonthlyStats(token, recordMonth.year, recordMonth.month),
        getMyGroups(token),
        getRecords(token, {
          year: recordMonth.year,
          month: recordMonth.month,
          limit: 30,
        }),
        getRecords(token, { limit: 100 }),
        getMyBadges(token),
        listBadges(),
      ]);
      setProfile(me);
      setStats(monthly);
      setGroups(myGroups);
      setRecords(monthRecords);
      setAllRecords(recentRecords);
      setBadges(badgeData);
      setBadgeCatalog(catalog);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [recordMonth.month, recordMonth.year, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setAvatarImageUrl(window.localStorage.getItem(AVATAR_STORAGE_KEY));

    function handleStorage(event: StorageEvent) {
      if (event.key === AVATAR_STORAGE_KEY) {
        setAvatarImageUrl(event.newValue);
      }
    }

    function handleAvatarUpdated() {
      setAvatarImageUrl(window.localStorage.getItem(AVATAR_STORAGE_KEY));
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("weswim-avatar-updated", handleAvatarUpdated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("weswim-avatar-updated", handleAvatarUpdated);
    };
  }, []);

  const swimDays = useMemo(() => {
    const days = new Set<number>();
    for (const r of records) {
      days.add(new Date(r.recorded_at).getDate());
    }
    return days;
  }, [records]);

  const longSwimDays = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const r of records) {
      const day = new Date(r.recorded_at).getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + recordDistance(r.record_data));
    }
    const long = new Set<number>();
    for (const [day, total] of Array.from(byDay.entries())) {
      if (total >= 2000) {
        long.add(day);
      }
    }
    return long;
  }, [records]);

  const calendarCells = useMemo(
    () =>
      buildMonthCalendar(
        recordMonth.year,
        recordMonth.month,
        swimDays,
        longSwimDays,
      ),
    [recordMonth, swimDays, longSwimDays],
  );

  const recentListRecords = useMemo(() => allRecords.slice(0, 4), [allRecords]);

  const dayRecords = useMemo(() => {
    if (selectedDay === null) {
      return [];
    }
    return records.filter(
      (r) => new Date(r.recorded_at).getDate() === selectedDay,
    );
  }, [records, selectedDay]);

  const monthLabel = `${recordMonth.year}년 ${recordMonth.month}월`;

  const strokeStats = useMemo(
    () => computeMonthlyStrokeStats(records),
    [records],
  );

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

  const sortedGroups = useMemo(
    () => [
      ...groups.filter((g) => isRegisteredGroup(g.status)),
      ...groups.filter((g) => isWaitingGroup(g.status)),
      ...groups.filter(
        (g) => !isRegisteredGroup(g.status) && !isWaitingGroup(g.status),
      ),
    ],
    [groups],
  );

  const streakBadges = useMemo(
    () => (badges?.earned ?? []).filter((b) => b.earned_count > 1).slice(0, 2),
    [badges],
  );

  const dashExtras = useMemo(() => {
    const swimDayKeys = new Set<string>();
    for (const r of allRecords) {
      swimDayKeys.add(localDateKey(r.recorded_at));
    }
    let bestDistance = 0;
    let bestDate = "";
    for (const r of [...allRecords, ...records]) {
      const dist = recordDistance(r.record_data);
      if (dist > bestDistance) {
        bestDistance = dist;
        bestDate = r.recorded_at;
      }
    }
    const streak = computeStreakFromDays(swimDayKeys);
    return {
      totalSwimDays: swimDayKeys.size,
      bestDistance,
      bestDateLabel: bestDate
        ? new Date(bestDate).toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
          })
        : "—",
      streak,
    };
  }, [allRecords, records]);

  function shiftMonth(delta: number) {
    setRecordMonth((current) => {
      const d = new Date(current.year, current.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
    setSelectedDay(null);
  }

  return (
    <>
      <div className="my-screen">
        <SiteGnb activeNav="my" />
        {loading && (
          <p style={{ padding: 32, color: "var(--gray-500)" }}>불러오는 중…</p>
        )}
        {error && (
          <p style={{ padding: "0 32px", color: "var(--error)" }}>{error}</p>
        )}

        {profile && !loading && (
          <>
            <div className="profile-hero">
              <div className="hero-inner">
                <div className="hero-av" aria-label="프로필 아바타">
                  {avatarImageUrl ? (
                    <Image
                      src={avatarImageUrl}
                      alt="내 아바타"
                      width={80}
                      height={80}
                      unoptimized
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    avatarInitial(profile.nickname)
                  )}
                </div>
                <div className="hero-info">
                  <div className="hero-name">{profile.nickname}</div>
                  <div className="hero-meta">
                    {profile.level && (
                      <span className="lane-pill lv3">
                        <span />
                        {levelLabel(profile.level)}
                      </span>
                    )}
                    <span className="hero-join">
                      {new Date(profile.created_at).toLocaleDateString(
                        "ko-KR",
                        {
                          year: "numeric",
                          month: "long",
                        },
                      )}{" "}
                      가입
                    </span>
                  </div>
                </div>
                <div className="hero-settings">
                  <Link href="/my/settings" className="settings-btn">
                    <span className="ms" aria-hidden="true">
                      settings
                    </span>
                    설정
                  </Link>
                </div>
              </div>
            </div>

            <div className="page my-page-body">
              <div>
                {stats && (
                  <div className="dash-grid">
                    <div className="dash-card">
                      <div className="dash-label">
                        <span className="ms" aria-hidden="true">
                          straighten
                        </span>
                        이달 누적
                      </div>
                      <div className="dash-val">
                        {stats.total_distance.toLocaleString()}
                        <span>m</span>
                      </div>
                      <div className="dash-sub up">
                        ▲ 목표의 {stats.goal_progress_pct}%
                      </div>
                    </div>
                    <div className="dash-card">
                      <div className="dash-label">
                        <span className="ms" aria-hidden="true">
                          emoji_events
                        </span>
                        개인 최고
                      </div>
                      <div className="dash-val">
                        {dashExtras.bestDistance.toLocaleString()}
                        <span>m</span>
                      </div>
                      <div className="dash-sub">
                        {dashExtras.bestDateLabel} 기록
                      </div>
                    </div>
                    <div className="dash-card">
                      <div className="dash-label">
                        <span className="ms" aria-hidden="true">
                          calendar_month
                        </span>
                        총 운동일
                      </div>
                      <div className="dash-val">
                        {dashExtras.totalSwimDays}
                        <span>일</span>
                      </div>
                      <div className="dash-sub">이달 {stats.swim_days}일</div>
                    </div>
                    <div className="dash-card">
                      <div className="dash-label">
                        <span className="ms" aria-hidden="true">
                          local_fire_department
                        </span>
                        연속 운동
                      </div>
                      <div className="dash-val">
                        {dashExtras.streak}
                        <span>일</span>
                      </div>
                      {dashExtras.streak > 0 ? (
                        <div className="dash-sub streak">
                          <span className="ms" aria-hidden="true">
                            local_fire_department
                          </span>
                          🔥 불타는 중!
                        </div>
                      ) : (
                        <div className="dash-sub">기록을 이어가 보세요</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="section-card">
                  <div className="section-head">
                    <span
                      className="ms"
                      style={{ color: "var(--aqua)", fontSize: 18 }}
                      aria-hidden="true"
                    >
                      calendar_month
                    </span>
                    <div className="section-title">레인 로그</div>
                    <span className="section-sub">
                      운동한 날을 기록으로 채워요
                    </span>
                  </div>
                  <div className="lane-log-grid">
                    <div>
                      <div className="cal-nav">
                        <button
                          type="button"
                          className="cal-arrow"
                          onClick={() => shiftMonth(-1)}
                        >
                          <span className="ms" aria-hidden="true">
                            chevron_left
                          </span>
                        </button>
                        <div className="cal-month">{monthLabel}</div>
                        <button
                          type="button"
                          className="cal-arrow"
                          onClick={() => shiftMonth(1)}
                        >
                          <span className="ms" aria-hidden="true">
                            chevron_right
                          </span>
                        </button>
                      </div>
                      <div className="cal-dow">
                        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                      <div className="cal-grid" id="calGrid">
                        {calendarCells.map((cell, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={
                              cell.day === null ||
                              cell.classes.includes("future")
                            }
                            className={[
                              "cal-day",
                              ...cell.classes,
                              cell.day === null ? "empty" : "",
                              cell.day !== null && selectedDay === cell.day
                                ? "selected"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() =>
                              cell.day !== null && setSelectedDay(cell.day)
                            }
                          >
                            {cell.day ?? ""}
                          </button>
                        ))}
                      </div>
                      <div
                        id="calRecordPanel"
                        className={`cal-record-panel${selectedDay !== null ? " show" : ""}`}
                      >
                        {selectedDay !== null && (
                          <div className="crp-date">
                            <span className="ms" aria-hidden="true">
                              calendar_today
                            </span>
                            {monthLabel} {selectedDay}일
                          </div>
                        )}
                        {selectedDay !== null && dayRecords.length === 0 && (
                          <p className="crp-empty">
                            이 날은 수영 기록이 없어요 🌊
                          </p>
                        )}
                        {dayRecords.map((rec) => {
                          const dist = recordDistance(rec.record_data);
                          const strokes = strokesFromRecord(rec.record_data);
                          return (
                            <div key={rec.record_id} className="crp-rec">
                              <div className="crp-ico">
                                <span className="ms" aria-hidden="true">
                                  pool
                                </span>
                              </div>
                              <div>
                                <div className="crp-dist">
                                  {dist.toLocaleString()}
                                  <span>m</span>
                                </div>
                                <div className="crp-detail">
                                  {strokes.join(" · ") || "—"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {dayRecords.length > 0 && (
                          <div className="crp-link">
                            <Link href={`/record/${dayRecords[0].record_id}`}>
                              상세 보기
                              <span className="ms" aria-hidden="true">
                                arrow_forward
                              </span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="stroke-stats-panel">
                      <div className="stroke-stats-title">
                        <span className="ms" aria-hidden="true">
                          pool
                        </span>
                        이달 영법별 통계
                      </div>
                      {strokeStats.rows.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                          이 달 기록이 없어요.
                        </p>
                      ) : (
                        <div className="stroke-stats-list">
                          {strokeStats.rows.map((row) => (
                            <div
                              key={row.name}
                              className="rec-row"
                              style={{ cursor: "default" }}
                            >
                              <div
                                className="stroke-stat-ico"
                                style={{
                                  background: row.iconBg,
                                  color: row.iconColor,
                                }}
                              >
                                <span className="ms" aria-hidden="true">
                                  pool
                                </span>
                              </div>
                              <div className="rec-row-info">
                                <div className="rec-row-date">{row.name}</div>
                                <div className="rec-row-stroke">
                                  {row.distance.toLocaleString()}m ·{" "}
                                  {row.sessions}회
                                </div>
                              </div>
                              <div className="stroke-stat-pct">
                                <div className="stroke-stat-num">
                                  {row.pct}
                                  <span>%</span>
                                </div>
                                <div className="stroke-stat-bar">
                                  <div
                                    style={{
                                      width: `${row.pct}%`,
                                      background: row.barColor,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="stroke-stats-total">
                        <span>이달 총 거리</span>
                        <strong>
                          {strokeStats.totalDistance.toLocaleString()}
                          <span>m</span>
                        </strong>
                      </div>
                    </div>
                  </div>

                  <MyBadgeCollection catalog={badgeCatalog} badges={badges} />
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <span
                      className="ms"
                      style={{ color: "var(--aqua)", fontSize: 18 }}
                      aria-hidden="true"
                    >
                      pool
                    </span>
                    <div className="section-title">최근 기록</div>
                    <Link href="/my/badges" className="section-more">
                      전체보기
                      <span className="ms" aria-hidden="true">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                  <div className="rec-list">
                    {recentListRecords.length === 0 ? (
                      <p style={{ fontSize: 14, color: "var(--gray-500)" }}>
                        아직 수영 기록이 없어요.
                      </p>
                    ) : (
                      recentListRecords.map((record) => {
                        const dist = recordDistance(record.record_data);
                        const strokes = strokesFromRecord(record.record_data);
                        const pill = visPill(record.is_public);
                        const memo =
                          typeof record.record_data.memo === "string"
                            ? record.record_data.memo
                            : "";
                        return (
                          <Link
                            key={record.record_id}
                            href={`/record/${record.record_id}`}
                            className="rec-row"
                          >
                            <div className="rec-row-dist">
                              {dist.toLocaleString()}
                              <span>m</span>
                            </div>
                            <div className="rec-row-info">
                              <div className="rec-row-date">
                                {formatRecordRowDate(record.recorded_at)}
                              </div>
                              <div className="rec-row-stroke">
                                {strokes.join(" · ") || "—"}
                              </div>
                              {memo ? (
                                <div className="rec-row-memo">{memo}</div>
                              ) : null}
                            </div>
                            <div className="rec-row-badge">
                              <span className={pill.className}>
                                <span className="ms" aria-hidden="true">
                                  {pill.icon}
                                </span>
                                {pill.label}
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <span
                      className="ms"
                      style={{ color: "var(--aqua)", fontSize: 18 }}
                      aria-hidden="true"
                    >
                      groups
                    </span>
                    <div className="section-title">소속 이력</div>
                  </div>
                  <div className="history-list">
                    {sortedGroups.length === 0 ? (
                      <p style={{ fontSize: 14, color: "var(--gray-500)" }}>
                        아직 소속된 반이 없어요.{" "}
                        <Link
                          href="/group/find"
                          style={{ color: "var(--aqua-dark)" }}
                        >
                          반 찾기
                        </Link>
                      </p>
                    ) : (
                      sortedGroups.map((g) => (
                        <Link
                          key={g.group_id}
                          href={`/group?groupId=${g.group_id}`}
                          className={`group-card${isWaitingGroup(g.status) ? " waiting" : ""}`}
                        >
                          <div className="group-av">
                            <span className="ms" aria-hidden="true">
                              {isWaitingGroup(g.status)
                                ? "hourglass_top"
                                : "pool"}
                            </span>
                          </div>
                          <div className="group-info">
                            <div className="group-name">
                              {formatGroupTitleLine(g)}
                              <GroupKindBadge status={g.status} />
                            </div>
                            <div className="group-sub">
                              {isWaitingGroup(g.status)
                                ? `${formatGroupMetaLine(g)} · 멤버 2명 이상 시 활성화`
                                : formatGroupMetaLine(g)}
                            </div>
                          </div>
                          <span className="group-link-arrow" aria-hidden="true">
                            <span className="ms">chevron_right</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <aside className="sidebar">
                <div className="widget">
                  <div className="widget-title">
                    <span className="ms" aria-hidden="true">
                      military_tech
                    </span>
                    나의 뱃지
                  </div>
                  <div className="badge-grid">
                    {sidebarBadges.length === 0 ? (
                      <p
                        style={{
                          gridColumn: "1 / -1",
                          fontSize: 12,
                          color: "var(--gray-500)",
                        }}
                      >
                        아직 배지가 없어요.
                      </p>
                    ) : (
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
                      )
                    )}
                  </div>
                  <Link href="/my/badges" className="badge-all-btn">
                    <span className="ms" aria-hidden="true">
                      grid_view
                    </span>
                    전체 뱃지 보기
                  </Link>
                </div>

                <div className="widget">
                  <div className="widget-title">
                    <span className="ms" aria-hidden="true">
                      local_fire_department
                    </span>
                    연속 달성
                  </div>
                  {streakBadges.length > 0 ? (
                    streakBadges.map((b) => (
                      <div key={b.badge_id} className="streak-row">
                        <span className="streak-fire">🔥</span>
                        <div className="streak-info">
                          <div className="streak-label">{b.label}</div>
                          <div className="streak-sub">연속 달성 중</div>
                        </div>
                        <div className="streak-count">
                          {b.earned_count}
                          <span>연속</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="streak-row">
                      <span className="streak-fire">🔥</span>
                      <div className="streak-info">
                        <div className="streak-label">이번 달 수영</div>
                        <div className="streak-sub">
                          {stats?.swim_days ?? 0}일 운동했어요
                        </div>
                      </div>
                      <div className="streak-count">
                        {stats?.swim_days ?? 0}
                        <span>일</span>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}
