"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import { createGroupSchedule } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-schedule-write.css";

const TIME_OPTIONS = [
  "",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "12:00",
  "18:00",
  "19:00",
  "20:00",
];

export function ScheduleWritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");

  const [scheduleType, setScheduleType] = useState<"rsvp" | "vote">("rsvp");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeTime, setNoticeTime] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [voteOptions, setVoteOptions] = useState(["", ""]);
  const [allowMultipleVote, setAllowMultipleVote] = useState(false);
  const [anonymousVote, setAnonymousVote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNotice = scheduleType === "rsvp";
  const titleCount = title.length;

  const scheduledAtIso = useMemo(() => {
    if (!isNotice || !noticeDate) {
      return null;
    }
    const time = noticeTime || "00:00";
    return new Date(`${noticeDate}T${time}:00`).toISOString();
  }, [isNotice, noticeDate, noticeTime]);

  const deadlineAtIso = useMemo(() => {
    if (!deadlineDate) {
      return null;
    }
    return new Date(`${deadlineDate}T23:59:00`).toISOString();
  }, [deadlineDate]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) {
      return false;
    }
    if (isNotice) {
      return Boolean(noticeDate);
    }
    return voteOptions.filter((o) => o.trim()).length >= 2;
  }, [title, isNotice, noticeDate, voteOptions]);

  function addVoteOption() {
    if (voteOptions.length < 5) {
      setVoteOptions((o) => [...o, ""]);
    }
  }

  function removeVoteOption(index: number) {
    if (voteOptions.length <= 2) {
      return;
    }
    setVoteOptions((o) => o.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!groupId) {
      setError("반 정보가 없습니다. 우리반에서 다시 시도해 주세요.");
      return;
    }
    if (!canSubmit) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace(`/login?next=/group/schedule/new?groupId=${groupId}`);
        return;
      }

      const created = await createGroupSchedule(
        groupId,
        {
          type: scheduleType,
          title: title.trim(),
          location: location.trim() || null,
          scheduled_at: scheduledAtIso,
          deadline_at: deadlineAtIso,
          vote_options: !isNotice
            ? voteOptions.map((o) => o.trim()).filter(Boolean)
            : undefined,
        },
        session.access_token,
      );

      router.push(
        `/group/schedule/${created.schedule_id}?groupId=${groupId}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const backHref = groupId ? `/group?tab=notice` : "/group";

  return (
    <>
      <SiteGnb activeNav="group" />
      <div className="schedule-write-screen">
        <div className="back-wrap">
          <Link href={backHref} className="back-btn">
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            공지·벙개
          </Link>
        </div>

        <div className="page" style={{ paddingBottom: 100 }}>
          <div className="type-select">
            <button
              type="button"
              className={`type-card notice${isNotice ? " on" : ""}`}
              onClick={() => setScheduleType("rsvp")}
            >
              <span className="tc-badge notice">타입 A</span>
              <div className="tc-icon notice">
                <span className="ms" aria-hidden="true">
                  event
                </span>
              </div>
              <div className="tc-name">일정 공지</div>
              <div className="tc-desc">
                날짜·장소가 확정된 일정. 멤버가 참석 여부만 응답해요.
              </div>
            </button>
            <button
              type="button"
              className={`type-card vote${!isNotice ? " on" : ""}`}
              onClick={() => setScheduleType("vote")}
            >
              <span className="tc-badge vote">타입 B</span>
              <div className="tc-icon vote">
                <span className="ms" aria-hidden="true">
                  how_to_vote
                </span>
              </div>
              <div className="tc-name">일정 투표</div>
              <div className="tc-desc">
                날짜·장소·메뉴 중 미정 항목을 멤버들과 함께 결정해요.
              </div>
            </button>
          </div>

          <div className="form-section show">
            <div className="preview-banner">
              <span className="ms" aria-hidden="true">
                {isNotice ? "event" : "how_to_vote"}
              </span>
              <span>
                {isNotice
                  ? "일정 공지 — 날짜와 장소를 입력해주세요."
                  : "일정 투표 — 투표 항목을 2개 이상 입력해주세요."}
              </span>
            </div>

            {error ? (
              <div
                className="form-card"
                style={{ borderColor: "var(--error)", color: "var(--error)" }}
              >
                {error}
              </div>
            ) : null}

            <div className="form-card">
              <div className="section-title">
                <span className="ms" aria-hidden="true">
                  edit_note
                </span>
                기본 정보
              </div>
              <div className="form-group">
                <div className="form-label">
                  제목<span className="req">*</span>
                </div>
                <input
                  className="form-input"
                  type="text"
                  placeholder="예: 5월 정기 회식, 6월 워크숍 날짜 투표"
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div className="form-hint">
                  <span className="ms" aria-hidden="true">
                    info
                  </span>
                  최대 50자
                  <span className="char-counter">{titleCount}/50</span>
                </div>
              </div>
            </div>

            {isNotice ? (
              <div className="form-card" id="noticeFields">
                <div className="section-title">
                  <span className="ms" aria-hidden="true">
                    calendar_month
                  </span>
                  일정 정보
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <div className="form-label">
                      날짜<span className="req">*</span>
                    </div>
                    <input
                      className="form-input"
                      type="date"
                      value={noticeDate}
                      onChange={(e) => setNoticeDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <div className="form-label">시간</div>
                    <select
                      className="form-select"
                      value={noticeTime}
                      onChange={(e) => setNoticeTime(e.target.value)}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t || "empty"} value={t}>
                          {t ? t : "시간 선택"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <div className="form-label">장소</div>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="예: 잠실역 3번 출구 앞"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="form-card">
                <div className="section-title vote-color">
                  <span className="ms" aria-hidden="true">
                    how_to_vote
                  </span>
                  투표 항목
                </div>
                <div className="vote-options">
                  {voteOptions.map((opt, index) => (
                    <div key={index} className="vote-opt-row">
                      <input
                        className="vote-opt-input"
                        type="text"
                        placeholder={`항목 ${index + 1}`}
                        maxLength={30}
                        value={opt}
                        onChange={(e) => {
                          const next = [...voteOptions];
                          next[index] = e.target.value;
                          setVoteOptions(next);
                        }}
                      />
                      <button
                        type="button"
                        className="vote-opt-del"
                        disabled={voteOptions.length <= 2}
                        aria-label="항목 삭제"
                        onClick={() => removeVoteOption(index)}
                      >
                        <span className="ms" aria-hidden="true">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                {voteOptions.length < 5 ? (
                  <button
                    type="button"
                    className="add-opt-btn"
                    onClick={addVoteOption}
                  >
                    <span className="ms" aria-hidden="true">
                      add
                    </span>
                    항목 추가 (최대 5개)
                  </button>
                ) : null}
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">중복 선택 허용</div>
                    <div className="toggle-desc">
                      멤버가 여러 항목을 동시에 선택할 수 있어요
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={allowMultipleVote}
                      onChange={(e) => setAllowMultipleVote(e.target.checked)}
                    />
                    <div className="toggle-track" />
                    <div className="toggle-thumb" />
                  </label>
                </div>
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">익명 투표</div>
                    <div className="toggle-desc">
                      누가 어떤 항목을 선택했는지 비공개로 처리해요
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={anonymousVote}
                      onChange={(e) => setAnonymousVote(e.target.checked)}
                    />
                    <div className="toggle-track" />
                    <div className="toggle-thumb" />
                  </label>
                </div>
              </div>
            )}

            <div className="form-card">
              <div className="section-title">
                <span className="ms" aria-hidden="true">
                  schedule
                </span>
                마감 설정
              </div>
              <div className="form-group">
                <div className="form-label">응답 마감일 (선택)</div>
                <input
                  className="form-input"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                />
                <div className="form-hint">
                  <span className="ms" aria-hidden="true">
                    info
                  </span>
                  마감일 이후에는 참석·투표 응답을 받지 않아요.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bottom-bar">
          <Link href={backHref} className="btn btn-ghost">
            취소
          </Link>
          <button
            type="button"
            className={`btn ${isNotice ? "btn-aqua" : "btn-coral"}${canSubmit && !saving ? " active" : ""}`}
            disabled={!canSubmit || saving}
            onClick={() => void handleSubmit()}
          >
            <span className="ms" aria-hidden="true">
              send
            </span>
            {saving ? "등록 중…" : "등록하기"}
          </button>
        </div>
      </div>
    </>
  );
}
