"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  deleteRecord,
  getGroup,
  getMonthlyStats,
  getMyGroups,
  getRecord,
  getRecords,
  updateRecord,
  type MonthlyStats,
  type SwimRecord,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-record-detail.css";

type RecordDetailPageProps = {
  recordId: string;
};

function recordDistance(data: Record<string, unknown>): number {
  const raw = data.distance;
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function strokesFromRecord(data: Record<string, unknown>): string[] {
  return Array.isArray(data.strokes) ? (data.strokes as string[]) : [];
}

function privacyBadge(isPublic: string) {
  if (isPublic === "public") {
    return { icon: "public", label: "전체 공개" };
  }
  if (isPublic === "group") {
    return { icon: "group", label: "우리반 공개" };
  }
  return { icon: "lock", label: "나만 보기" };
}

function formatRecordDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatRecordTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRowDate(iso: string, isToday: boolean) {
  const d = new Date(iso);
  const md = d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
  const day = d.toLocaleDateString("ko-KR", { weekday: "short" });
  return { md, day: isToday ? `${day} · 오늘` : day, isToday };
}

type CalendarCell = {
  day: number | null;
  variant: "empty" | "sw" | "td" | "future" | "plain";
};

function buildMonthCalendar(
  year: number,
  month: number,
  swimDays: Set<number>,
): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startPad = first.getDay();
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const td = today.getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ day: null, variant: "empty" });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isFuture =
      year > ty ||
      (year === ty && month - 1 > tm) ||
      (year === ty && month - 1 === tm && day > td);
    const isToday = year === ty && month - 1 === tm && day === td;

    let variant: CalendarCell["variant"] = "plain";
    if (isFuture) {
      variant = "future";
    } else if (isToday) {
      variant = "td";
    } else if (swimDays.has(day)) {
      variant = "sw";
    }

    cells.push({ day, variant });
  }

  return cells;
}

export function RecordDetailPage({ recordId }: RecordDetailPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<SwimRecord | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<SwimRecord[]>([]);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [monthSwimDays, setMonthSwimDays] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const detail = await getRecord(recordId, accessToken);
      setRecord(detail);
      setIsOwner(Boolean(session?.user?.id && session.user.id === detail.user_id));
      setToken(accessToken ?? null);

      if (accessToken) {
        const recorded = new Date(detail.recorded_at);
        const y = recorded.getFullYear();
        const m = recorded.getMonth() + 1;
        const [monthly, monthRecords, recent, groups] = await Promise.all([
          getMonthlyStats(accessToken, y, m),
          getRecords(accessToken, { year: y, month: m }),
          getRecords(accessToken, { limit: 5 }),
          getMyGroups(accessToken),
        ]);
        setStats(monthly);
        setRecentRecords(recent.filter((r) => r.record_id !== recordId));
        setMonthSwimDays(
          new Set(
            monthRecords.map((r) => new Date(r.recorded_at).getDate()),
          ),
        );

        if (groups[0]) {
          const group = await getGroup(groups[0].group_id);
          setVenueName(group.venue_name ?? null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const swimDays = monthSwimDays;

  const calendarCells = useMemo(() => {
    if (!record) {
      return [];
    }
    const d = new Date(record.recorded_at);
    return buildMonthCalendar(
      d.getFullYear(),
      d.getMonth() + 1,
      swimDays,
    );
  }, [record, swimDays]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }

  async function handleShare() {
    if (!token || !record || record.is_public === "group") {
      showToast("이미 우리반에 공유된 기록이에요.");
      return;
    }
    setSharing(true);
    try {
      const updated = await updateRecord(
        recordId,
        { is_public: "group" },
        token,
      );
      setRecord(updated);
      showToast("우리반 잡담탭에 공유했어요!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "공유에 실패했습니다.");
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    if (!token) {
      router.replace(`/login?next=/record/${recordId}`);
      return;
    }
    setDeleting(true);
    try {
      await deleteRecord(recordId, token);
      setDeleteOpen(false);
      router.push("/my");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const data = record?.record_data ?? {};
  const dist = recordDistance(data);
  const strokes = strokesFromRecord(data);
  const memo = typeof data.memo === "string" ? data.memo : null;
  const badge = record ? privacyBadge(record.is_public) : null;
  const monthLabel = record
    ? `${new Date(record.recorded_at).getMonth() + 1}월`
    : "";

  const recordsWithDelta = useMemo(() => {
    const list = record ? [record, ...recentRecords] : recentRecords;
    return list.slice(0, 4).map((rec, idx, arr) => {
      const d = recordDistance(rec.record_data);
      const prev = arr[idx + 1];
      const delta = prev ? d - recordDistance(prev.record_data) : null;
      return { rec, dist: d, delta };
    });
  }, [record, recentRecords]);

  return (
    <>
      <SiteGnb activeNav="record" />
      <div className="record-detail-screen">
        <div className="back-wrap">
          <Link href="/my" className="back-btn">
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            기록 목록
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

        {record && !loading && (
          <div className="page">
            <div>
              <div className="rec-card">
                <div className="rec-hero">
                  <div className="rec-date-row">
                    <div className="rec-date">
                      {formatRecordDate(record.recorded_at)}
                    </div>
                    {badge && (
                      <div className="rec-public-badge">
                        <span className="ms" aria-hidden="true">
                          {badge.icon}
                        </span>
                        {badge.label}
                      </div>
                    )}
                  </div>
                  <div className="rec-distance">
                    {dist.toLocaleString()}
                    <span>m</span>
                  </div>
                  {venueName && (
                    <div className="rec-pool">
                      <span className="ms" aria-hidden="true">
                        location_on
                      </span>
                      {venueName}
                    </div>
                  )}
                </div>

                <div className="rec-body">
                  <div className="rec-meta-grid">
                    <div className="rec-meta-item">
                      <div className="rec-meta-label">
                        <span className="ms" aria-hidden="true">
                          waves
                        </span>
                        주요 영법
                      </div>
                      <div className="rec-stroke-chips">
                        {strokes.length > 0 ? (
                          strokes.map((s) => (
                            <span key={s} className="stroke-chip">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="rec-meta-value">—</span>
                        )}
                      </div>
                    </div>
                    <div className="rec-meta-item">
                      <div className="rec-meta-label">
                        <span className="ms" aria-hidden="true">
                          timer
                        </span>
                        기록 시각
                      </div>
                      <div className="rec-meta-value">
                        {formatRecordTime(record.recorded_at)}
                      </div>
                    </div>
                  </div>

                  {memo ? (
                    <div className="rec-memo">
                      <div className="rec-memo-label">
                        <span className="ms" aria-hidden="true">
                          edit_note
                        </span>
                        한 줄 메모
                      </div>
                      <div className="rec-memo-text">{memo}</div>
                    </div>
                  ) : null}

                  {isOwner ? (
                    <div className="rec-actions">
                      <button
                        type="button"
                        className="btn btn-coral"
                        disabled={sharing || record.is_public === "group"}
                        onClick={() => void handleShare()}
                      >
                        <span className="ms" aria-hidden="true">
                          share
                        </span>
                        {record.is_public === "group"
                          ? "우리반 공유됨"
                          : "우리반 공유"}
                      </button>
                      <div className="btn-spacer" />
                      <Link
                        href={`/record/new?edit=${record.record_id}`}
                        className="btn btn-ghost"
                      >
                        <span className="ms" aria-hidden="true">
                          edit
                        </span>
                        수정
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <span className="ms" aria-hidden="true">
                          delete
                        </span>
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {stats && (
                <div className="monthly-card">
                  <div className="monthly-title">
                    <span className="ms" aria-hidden="true">
                      bar_chart
                    </span>
                    이달 수영 통계 · {monthLabel}
                  </div>
                  <div className="monthly-nums">
                    <div className="m-num-item">
                      <div className="m-num-label">누적 거리</div>
                      <div className="m-num-val">
                        {stats.total_distance.toLocaleString()}
                        <span>m</span>
                      </div>
                    </div>
                    <div className="m-num-item">
                      <div className="m-num-label">수영 일수</div>
                      <div className="m-num-val">
                        {stats.swim_days}
                        <span>일</span>
                      </div>
                    </div>
                  </div>
                  <div className="monthly-bar-wrap">
                    <div className="monthly-bar-row">
                      <span>이번 달 목표</span>
                      <span>
                        <b>{stats.total_distance.toLocaleString()}</b> /{" "}
                        {stats.goal_distance.toLocaleString()}m
                      </span>
                    </div>
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${Math.min(100, stats.goal_progress_pct)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="insights">
              {stats && (
                <div className="widget goal-hero">
                  <div className="w-title" style={{ color: "var(--aqua-dark)" }}>
                    <span className="ms" aria-hidden="true">
                      flag
                    </span>
                    {monthLabel} 목표 달성률
                    <Link href="/my" className="more">
                      마이페이지
                    </Link>
                  </div>
                  <div className="goal-row">
                    <div className="goal-val">
                      {stats.total_distance.toLocaleString()}
                      <span className="unit">m</span>
                    </div>
                    <div className="goal-total">
                      목표
                      <b>{stats.goal_distance.toLocaleString()}m</b>
                    </div>
                  </div>
                  <div className="goal-bar">
                    <div
                      className="goal-fill"
                      style={{
                        width: `${Math.min(100, stats.goal_progress_pct)}%`,
                      }}
                    />
                  </div>
                  <div className="goal-foot">
                    <span>이번 기록 포함</span>
                    <span className="pct">{stats.goal_progress_pct}% 달성</span>
                  </div>
                </div>
              )}

              <div className="widget">
                <div className="w-title">
                  <span className="ms" aria-hidden="true">
                    history
                  </span>
                  최근 기록
                  <Link href="/my" className="more">
                    전체 보기 →
                  </Link>
                </div>
                <div className="records-list">
                  {recordsWithDelta.map(({ rec, dist: rowDist, delta }) => {
                    const rowStrokes = strokesFromRecord(rec.record_data);
                    const { md, day, isToday } = formatRowDate(
                      rec.recorded_at,
                      rec.record_id === recordId,
                    );
                    const isCurrent = rec.record_id === recordId;
                    return (
                      <Link
                        key={rec.record_id}
                        href={`/record/${rec.record_id}`}
                        className={`rec-row${isToday ? " today" : ""}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="rec-date">
                          {md}
                          <span className="day">{day}</span>
                        </div>
                        <div className="rec-info">
                          <div className="rec-d">
                            {rowDist.toLocaleString()}
                            <span className="unit">m</span>
                          </div>
                          <div className="rec-s">
                            {rowStrokes.length > 0
                              ? rowStrokes.join(" · ")
                              : "—"}
                            {isCurrent ? " · 현재" : ""}
                          </div>
                        </div>
                        {delta !== null && delta !== 0 ? (
                          <span
                            className={`rec-vs${delta < 0 ? " down" : ""}`}
                          >
                            <span className="ms" aria-hidden="true">
                              {delta > 0 ? "trending_up" : "trending_down"}
                            </span>
                            {delta > 0 ? "+" : ""}
                            {delta}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="milestone">
                <div className="ms-ico">
                  <span className="ms" aria-hidden="true">
                    workspace_premium
                  </span>
                </div>
                <div className="ms-info">
                  <div className="ms-t">이번 달 목표까지</div>
                  <div className="ms-s">
                    {stats && stats.goal_distance > stats.total_distance
                      ? `앞으로 ${(stats.goal_distance - stats.total_distance).toLocaleString()}m`
                      : "목표를 달성했어요!"}
                  </div>
                  {stats && (
                    <div className="ms-bar">
                      <div
                        className="ms-fill"
                        style={{
                          width: `${Math.min(100, stats.goal_progress_pct)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="badge-widget">
                <div className="bw-head">
                  <div className="bw-title">
                    <span className="ms" aria-hidden="true">
                      workspace_premium
                    </span>
                    도전 뱃지
                  </div>
                  <div className="bw-progress">
                    <b>4</b> / 25
                  </div>
                </div>
                <div className="badges-grid">
                  <div className="rec-badge earned coral" title="주 6회">
                    <span className="ms" aria-hidden="true">
                      local_fire_department
                    </span>
                    <span className="b-lbl">주6회</span>
                  </div>
                  <div className="rec-badge earned" title="누적 1km">
                    <span className="ms" aria-hidden="true">
                      straighten
                    </span>
                    <span className="b-lbl">1km</span>
                  </div>
                  <div className="rec-badge locked" title="Gold">
                    <span className="ms" aria-hidden="true">
                      emoji_events
                    </span>
                    <span className="b-lbl">Gold</span>
                  </div>
                </div>
                <div className="badge-foot">
                  <span className="ms" aria-hidden="true">
                    celebration
                  </span>
                  획득 가능한 뱃지
                  <Link href="/my/badges">전체 보기 →</Link>
                </div>
              </div>

              {calendarCells.length > 0 && (
                <div className="widget">
                  <div className="w-title">
                    <span className="ms" aria-hidden="true">
                      calendar_month
                    </span>
                    레인 로그 · {monthLabel}
                    {stats && (
                      <span className="more">{stats.swim_days}일 운동</span>
                    )}
                  </div>
                  <div className="cal-grid">
                    {["일", "월", "화", "수", "목", "금", "토"].map((hd) => (
                      <div key={hd} className="hd">
                        {hd}
                      </div>
                    ))}
                    {calendarCells.map((cell, i) => (
                      <div
                        key={i}
                        className={[
                          "cd",
                          cell.variant !== "plain" && cell.variant !== "empty"
                            ? cell.variant
                            : "",
                          cell.day === null ? "empty" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {cell.day ?? ""}
                      </div>
                    ))}
                  </div>
                  <div className="cal-legend">
                    <span className="lg">
                      <span style={{ background: "var(--aqua)" }} />
                      수영
                    </span>
                    <span className="lg">
                      <span
                        style={{
                          border: "2px solid var(--coral)",
                          background: "#fff",
                        }}
                      />
                      오늘
                    </span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        <div className={`toast${toast ? " show" : ""}`}>
          <span className="ms" aria-hidden="true">
            check_circle
          </span>
          {toast}
        </div>

        <div
          className={`modal-bg${deleteOpen ? " open" : ""}`}
          role="presentation"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon" aria-hidden="true">
              🗑️
            </div>
            <div className="modal-title" id="delete-modal-title">
              기록을 삭제할까요?
            </div>
            <div className="modal-desc">
              삭제한 기록은 복구할 수 없어요. 우리반 공유 메시지는 유지될 수
              있습니다.
            </div>
            <div className="modal-btns">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
