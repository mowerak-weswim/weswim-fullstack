"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  confirmGroupSchedule,
  createScheduleComment,
  getGroupSchedule,
  getScheduleComments,
  submitScheduleRsvp,
  submitScheduleVote,
  type GroupSchedule,
  type ScheduleComment,
} from "@/lib/api";
import {
  avatarInitial,
  formatRelativeTime,
} from "@/lib/format/relative-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-schedule-detail.css";

type ScheduleDetailPageProps = {
  scheduleId: string;
};

function statusPill(status: string) {
  if (status === "confirmed") {
    return { className: "status-pill status-confirmed", label: "확정됨" };
  }
  if (status === "closed") {
    return { className: "status-pill status-closed", label: "마감" };
  }
  return { className: "status-pill status-active", label: "진행중" };
}

function formatKoDate(iso: string | null) {
  if (!iso) {
    return "";
  }
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduleDetailPage({ scheduleId }: ScheduleDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<GroupSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [comments, setComments] = useState<ScheduleComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [myNickname, setMyNickname] = useState("");

  const load = useCallback(async () => {
    if (!groupId) {
      setError("반 정보가 없습니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace(
          `/login?next=/group/schedule/${scheduleId}?groupId=${groupId}`,
        );
        return;
      }
      setToken(session.access_token);
      const accessToken = session.access_token;
      const detail = await getGroupSchedule(groupId, scheduleId, accessToken);
      setSchedule(detail);
      const cmtList = await getScheduleComments(groupId, scheduleId, accessToken);
      setComments(cmtList);
      const meta = session.user.user_metadata as { nickname?: string };
      setMyNickname(
        meta.nickname ??
          session.user.email?.split("@")[0] ??
          "회원",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [groupId, router, scheduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxVotes = useMemo(
    () => Math.max(1, ...(schedule?.vote_options.map((o) => o.vote_count) ?? [1])),
    [schedule?.vote_options],
  );

  const winningCount = useMemo(() => {
    if (!schedule?.vote_options.length) {
      return 0;
    }
    return Math.max(...schedule.vote_options.map((o) => o.vote_count));
  }, [schedule?.vote_options]);

  async function handleRsvp(response: "attending" | "maybe" | "declined") {
    if (!groupId || !token) {
      return;
    }
    try {
      const updated = await submitScheduleRsvp(
        groupId,
        scheduleId,
        response,
        token,
      );
      setSchedule(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RSVP 처리에 실패했습니다.");
    }
  }

  async function handleVote(optionId: string) {
    if (!groupId || !token) {
      return;
    }
    try {
      const updated = await submitScheduleVote(
        groupId,
        scheduleId,
        optionId,
        token,
      );
      setSchedule(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "투표에 실패했습니다.");
    }
  }

  async function handleSendComment() {
    const text = commentDraft.trim();
    if (!groupId || !token || !text) {
      return;
    }
    setCommentSending(true);
    try {
      const created = await createScheduleComment(
        groupId,
        scheduleId,
        text,
        token,
      );
      setComments((prev) => [...prev, created]);
      setCommentDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 등록에 실패했습니다.");
    } finally {
      setCommentSending(false);
    }
  }

  async function handleConfirm(optionId: string) {
    if (!groupId || !token || !schedule) {
      return;
    }
    try {
      const updated = await confirmGroupSchedule(
        groupId,
        scheduleId,
        { option_id: optionId },
        token,
      );
      setSchedule(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "확정에 실패했습니다.");
    }
  }

  const backHref = groupId ? `/group?tab=notice` : "/group";
  const isVote = schedule?.type === "vote";
  const pill = statusPill(schedule?.status ?? "open");
  const showVote =
    isVote && schedule && ["open", "voting"].includes(schedule.status);
  const showRsvp =
    !isVote && schedule && schedule.status === "open";
  const showConfirm =
    isVote &&
    schedule?.is_author &&
    schedule.status === "voting" &&
    schedule.vote_options.length > 0;

  return (
    <>
      <SiteGnb activeNav="group" />
      <div className="schedule-detail-screen">
        <div className="back-wrap">
          <Link href={backHref} className="back-btn">
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            공지·벙개
          </Link>
        </div>

        {loading && (
          <p style={{ padding: "24px 32px", color: "var(--gray-500)" }}>
            불러오는 중…
          </p>
        )}
        {error && (
          <p style={{ padding: "0 32px", color: "var(--error)" }}>{error}</p>
        )}

        {schedule && !loading && (
          <div className="page">
            <div className="main-col">
              <div className="detail-hero">
                <div
                  className={`hero-inner ${isVote ? "hero-vote" : "hero-notice"}`}
                >
                  <div className="hero-eyebrow">
                    <span className="ms" aria-hidden="true">
                      {isVote ? "how_to_vote" : "event"}
                    </span>
                    {isVote ? "일정 투표" : "일정 공지"}
                    <span className={pill.className}>{pill.label}</span>
                  </div>
                  <div className="hero-title">{schedule.title}</div>
                  <div className="hero-meta-row">
                    {schedule.location ? (
                      <span className="hero-meta-item">
                        <span className="ms" aria-hidden="true">
                          location_on
                        </span>
                        {schedule.location}
                      </span>
                    ) : null}
                    {schedule.scheduled_at ? (
                      <span className="hero-meta-item">
                        <span className="ms" aria-hidden="true">
                          calendar_month
                        </span>
                        {formatKoDate(schedule.scheduled_at)}
                      </span>
                    ) : null}
                    {isVote ? (
                      <span className="hero-meta-item">
                        <span className="ms" aria-hidden="true">
                          how_to_vote
                        </span>
                        {schedule.total_votes}표 참여
                      </span>
                    ) : null}
                  </div>
                  <div className="hero-deadline">
                    {schedule.deadline_at
                      ? `마감 ${formatKoDate(schedule.deadline_at)}`
                      : "마감일 없음"}
                    {schedule.author_nickname
                      ? ` · 작성자: ${schedule.author_nickname}`
                      : ""}
                  </div>
                </div>
              </div>

              {showVote ? (
                <div className="vote-section">
                  <div className="sec-head">
                    <div className="sec-title">
                      <span className="ms" aria-hidden="true">
                        how_to_vote
                      </span>
                      투표하기
                    </div>
                    <div className="sec-meta">
                      총 {schedule.total_votes}명 참여
                    </div>
                  </div>
                  <div className="multi-hint">
                    <span className="ms" aria-hidden="true">
                      info
                    </span>
                    중복 선택이 가능해요. 가능한 날짜 모두 체크해주세요.
                  </div>
                  <div className="vote-opts">
                    {schedule.vote_options.map((opt) => {
                      const pct = (opt.vote_count / maxVotes) * 100;
                      const isWinner =
                        opt.vote_count > 0 && opt.vote_count === winningCount;
                      const selected =
                        schedule.my_vote_option_id === opt.option_id;
                      return (
                        <div
                          key={opt.option_id}
                          className="vote-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleVote(opt.option_id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void handleVote(opt.option_id);
                            }
                          }}
                        >
                          <div
                            className={`vote-check${selected ? " on" : ""}`}
                          >
                            <span className="ms" aria-hidden="true">
                              check
                            </span>
                          </div>
                          <div
                            className={`vbar-wrap${isWinner ? " vote-winner" : ""}`}
                          >
                            <div
                              className={`vbar-fill${isWinner ? " winning" : ""}`}
                              style={{ width: `${pct}%` }}
                            />
                            <span className="vbar-label">{opt.label}</span>
                            {isWinner ? (
                              <span className="winner-badge">최다 득표</span>
                            ) : null}
                          </div>
                          <span className="vbar-voters">{opt.vote_count}명</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="vote-submit-row">
                    <button
                      type="button"
                      className="btn-vote"
                      disabled={!schedule.my_vote_option_id}
                    >
                      <span className="ms" aria-hidden="true">
                        how_to_vote
                      </span>
                      {schedule.my_vote_option_id
                        ? "투표 반영됨"
                        : "항목을 선택해 주세요"}
                    </button>
                    <div className="vote-count-badge">
                      <b>{schedule.my_vote_option_id ? 1 : 0}</b>개 선택됨
                    </div>
                  </div>
                </div>
              ) : null}

              {showConfirm ? (
                <div className="confirm-section show">
                  <div className="confirm-hint">
                    <span className="ms" aria-hidden="true">
                      workspace_premium
                    </span>
                    작성자만 날짜를 확정할 수 있어요.
                  </div>
                  <div className="confirm-opts">
                    {schedule.vote_options.map((opt) => (
                      <button
                        key={opt.option_id}
                        type="button"
                        className="confirm-opt-btn"
                        onClick={() => void handleConfirm(opt.option_id)}
                      >
                        <span className="ms" aria-hidden="true">
                          check_circle
                        </span>
                        {opt.label}으로 확정하기 — {opt.vote_count}표
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showRsvp ? (
                <div className="rsvp-section">
                  <div className="sec-head">
                    <div className="sec-title">
                      <span className="ms" aria-hidden="true">
                        how_to_reg
                      </span>
                      참석 여부
                    </div>
                  </div>
                  <div className="rsvp-btns">
                    {(
                      [
                        ["attending", "attend", "check_circle", "참석"],
                        ["maybe", "undecided", "help", "미정"],
                        ["declined", "absent", "cancel", "불참"],
                      ] as const
                    ).map(([api, css, icon, label]) => (
                      <button
                        key={api}
                        type="button"
                        className={`rsvp-btn ${css}${schedule.my_rsvp === api ? " on" : ""}`}
                        onClick={() => void handleRsvp(api)}
                      >
                        <span className="ms" aria-hidden="true">
                          {icon}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                  {schedule.rsvp_counts ? (
                    <div className="rsvp-summary">
                      <div className="rsvp-stat">
                        <div className="num">{schedule.rsvp_counts.attending}</div>
                        <div className="lbl">참석</div>
                      </div>
                      <div className="rsvp-stat">
                        <div className="num">{schedule.rsvp_counts.maybe}</div>
                        <div className="lbl">미정</div>
                      </div>
                      <div className="rsvp-stat">
                        <div className="num">{schedule.rsvp_counts.declined}</div>
                        <div className="lbl">불참</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {schedule.status === "confirmed" ? (
                <div
                  className="form-card"
                  style={{
                    background: "var(--aqua-whisper)",
                    border: "1px solid var(--aqua)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <strong style={{ color: "var(--aqua-dark)" }}>
                    확정된 일정입니다.
                  </strong>
                </div>
              ) : null}

              <div className="comment-section">
                <div className="comment-head">
                  댓글
                  <span className="cnt">{comments.length}</span>
                </div>
                {comments.map((cmt, idx) => {
                  const avClass = ["aq", "co", "nv"][idx % 3];
                  const name = cmt.nickname ?? "회원";
                  return (
                    <div key={cmt.comment_id} className="comment">
                      <div className={`av ${avClass}`}>
                        {avatarInitial(name)}
                      </div>
                      <div className="comment-body">
                        <div className="cmt-name">
                          {name}
                          <span className="cmt-time">
                            {formatRelativeTime(cmt.created_at)}
                          </span>
                        </div>
                        <div className="cmt-text">{cmt.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div className="cmt-input-wrap">
                  <div
                    className="av aq"
                    style={{
                      width: 32,
                      height: 32,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {avatarInitial(myNickname)}
                  </div>
                  <textarea
                    className="cmt-textarea"
                    rows={1}
                    placeholder="댓글을 입력하세요…"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="cmt-send"
                    disabled={commentSending || !commentDraft.trim()}
                    onClick={() => void handleSendComment()}
                    aria-label="댓글 등록"
                  >
                    <span className="ms" aria-hidden="true">
                      send
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <aside className="side-col">
              <div className="widget">
                <div className="w-title">
                  <span className="ms" aria-hidden="true">
                    info
                  </span>
                  일정 정보
                </div>
                <div className="info-row">
                  <div className="info-ico">
                    <span className="ms" aria-hidden="true">
                      {isVote ? "how_to_vote" : "event"}
                    </span>
                  </div>
                  <div>
                    <div className="info-label">유형</div>
                    <div className="info-val">
                      {isVote ? "일정 투표" : "일정 공지"}
                    </div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-ico">
                    <span className="ms" aria-hidden="true">
                      schedule
                    </span>
                  </div>
                  <div>
                    <div className="info-label">응답 마감</div>
                    <div className="info-val">
                      {schedule.deadline_at
                        ? formatKoDate(schedule.deadline_at)
                        : "없음"}
                    </div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-ico">
                    <span className="ms" aria-hidden="true">
                      person
                    </span>
                  </div>
                  <div>
                    <div className="info-label">작성자</div>
                    <div className="info-val">
                      {schedule.author_nickname ?? "회원"}
                    </div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-ico">
                    <span className="ms" aria-hidden="true">
                      update
                    </span>
                  </div>
                  <div>
                    <div className="info-label">등록</div>
                    <div className="info-val">
                      {formatRelativeTime(schedule.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
