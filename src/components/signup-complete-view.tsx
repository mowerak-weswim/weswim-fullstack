"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { daysKoFromValues, levelPubLabel } from "@/lib/group-find/constants";
import { GroupInviteModal } from "@/components/group-invite-modal";
import { buildGroupInviteUrl } from "@/lib/group-invite";

import "@/styles/weswim-signup-complete.css";

export type SignupCompleteViewProps = {
  nickname: string;
  venueName: string;
  level: string;
  days: string[];
  time: string;
  groupId: string | null;
  /** API `find` 응답 status — `waiting` 이면 오리발 대기방 UI */
  groupStatus: string;
};

export function SignupCompleteView({
  nickname,
  venueName,
  level,
  days,
  time,
  groupId,
  groupStatus,
}: SignupCompleteViewProps) {
  const isWaiting = groupStatus === "waiting";
  const scheduleLabel = `${levelPubLabel(level)} · ${daysKoFromValues(days)} ${time}`;
  const displayName = nickname.trim() || "회원";
  const initial = displayName.slice(0, 1);

  const dataState = isWaiting ? "waiting" : "found";

  const memberAvatars = useMemo(
    () => (isWaiting ? ["이"] : ["김", "박", "정", "민"]),
    [isWaiting],
  );
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalUrl, setInviteModalUrl] = useState("");

  function handleInviteShare() {
    if (typeof window === "undefined") {
      return;
    }
    const origin = window.location.origin;
    setInviteModalUrl(
      groupId ? buildGroupInviteUrl(origin, groupId) : `${origin}/group/find`,
    );
    setInviteModalOpen(true);
  }

  return (
    <div className="signup-complete-page" data-state={dataState}>
      <header className="header">
        <div className="logo">
          <span className="We">We</span>
          <span className="Swim">Swim</span>
        </div>
        <Link className="skip" href="/">
          홈으로{" "}
          <span className="ms" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </header>

      <main className="stage">
        <section className="hero">
          <div className="check-stack">
            <div className="check-ring" />
            <div className="check-ring" />
            <div className="check-ring" />
            <div className="check-orb">
              <span className="ms found-only" aria-hidden="true">
                check
              </span>
              <span className="ms waiting-only" aria-hidden="true">
                hourglass_top
              </span>
            </div>
          </div>

          <div className="hero-eyebrow found-only">
            <span className="ms" aria-hidden="true">
              celebration
            </span>{" "}
            가입 완료 · 첫 레인 입장
          </div>
          <div className="hero-eyebrow waiting-only">
            <span className="ms" aria-hidden="true">
              schedule
            </span>{" "}
            가입 완료 · 활성화 대기 중
          </div>

          <h1 className="found-only">
            레인방에
            <br />
            <span className="accent">{displayName}</span>님이 입장했어요!
          </h1>
          <h1 className="waiting-only">
            <span className="accent">오리발 대기방</span>에서
            <br />
            친구를 기다리고 있어요
          </h1>

          <p className="sub found-only">
            <b>{venueName}</b> · <b>{levelPubLabel(level)}</b> ·{" "}
            <b>
              {daysKoFromValues(days)} {time}
            </b>
            <br />
            같은 레인 멤버가 함께할 준비가 되어 있어요. 인사부터 건네볼까요?
          </p>
          <p className="sub waiting-only">
            같은 조합의 레인방이 아직 없어서 <b>오리발 대기방</b>이 만들어졌어요.
            <br />
            멤버가 <b>2명 이상</b>이 되면 자동으로 활성화되고 알림으로
            알려드릴게요.
          </p>
        </section>

        <section className="info-row">
          <div className="info-card">
            <div className="corner-deco" />
            <div className="top-ico">
              <span className="ms" aria-hidden="true">
                pool
              </span>
            </div>
            <div className="ic-label">소속 레인방</div>
            <div className="ic-value">
              {venueName}
              <br />
              {scheduleLabel}
            </div>
            <div className="ic-extra">
              <span className="dot" />
              <span className="found-only">활동 중인 레인방</span>
              <span className="waiting-only">오리발 대기방 · 활성화 전</span>
            </div>
          </div>

          <div className="info-card mint">
            <div
              className="corner-deco"
              style={{
                background:
                  "radial-gradient(circle, var(--mint-light) 0%, transparent 70%)",
              }}
            />
            <div className="top-ico">
              <span className="ms" aria-hidden="true">
                groups
              </span>
            </div>
            <div className="ic-label">현재 멤버</div>
            <div className="ic-value">
              <span className="found-only">멤버 모집 중</span>
              <span className="waiting-only">1명 (나)</span>
            </div>
            <div className="av-stack">
              {memberAvatars.map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className={`av${i === 0 ? " nv" : i === 1 ? " co" : i === 2 ? " mint" : ""}`}
                >
                  {label}
                </span>
              ))}
              <span className="av me" title="나">
                {initial}
              </span>
            </div>
            <div className="ic-extra" style={{ marginTop: 6 }}>
              <span className="found-only">+ 나, 방금 입장!</span>
              <span className="waiting-only">친구 초대로 활성화 가능</span>
            </div>
          </div>

          <div className="info-card coral">
            <div
              className="corner-deco"
              style={{
                background:
                  "radial-gradient(circle, var(--coral-light) 0%, transparent 70%)",
              }}
            />
            <div className="top-ico">
              <span className="ms" aria-hidden="true">
                workspace_premium
              </span>
            </div>
            <div className="ic-label">레인 등급</div>
            <div className="ic-value">{levelPubLabel(level)}</div>
            <div className="ic-extra">
              <span
                className="ms"
                style={{ fontSize: 14, color: "var(--gray-500)" }}
                aria-hidden="true"
              >
                tune
              </span>
              마이페이지에서 변경 가능
            </div>
          </div>
        </section>

        <section className="next-section">
          <div className="next-title">
            <span className="ms" aria-hidden="true">
              stars
            </span>
            이제 뭐부터 해볼까요?
            <span className="count">3</span>
          </div>
          <div className="next-grid">
            <Link
              className="next-item"
              href={groupId ? `/group?group=${groupId}` : "/group"}
            >
              <div className="n-ico">
                <span className="ms found-only" aria-hidden="true">
                  waving_hand
                </span>
                <span className="ms waiting-only" aria-hidden="true">
                  share
                </span>
              </div>
              <div className="n-info">
                <div className="n-t found-only">레인방에 첫 인사 남기기</div>
                <div className="n-t waiting-only">친구에게 초대 링크 공유</div>
                <div className="n-s found-only">잡담탭에 한 줄만 적어보세요</div>
                <div className="n-s waiting-only">
                  2명 이상이면 자동 활성화돼요
                </div>
              </div>
              <span className="ms arrow" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
            <Link className="next-item" href="/record/new">
              <div className="n-ico">
                <span className="ms" aria-hidden="true">
                  edit_note
                </span>
              </div>
              <div className="n-info">
                <div className="n-t">오늘의 첫 기록 남기기</div>
                <div className="n-s">탈의실에서 30초면 완료</div>
              </div>
              <span className="ms arrow" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
            <Link className="next-item" href="/my">
              <div className="n-ico">
                <span className="ms" aria-hidden="true">
                  photo_camera
                </span>
              </div>
              <div className="n-info">
                <div className="n-t">프로필 꾸미기</div>
                <div className="n-s">아바타와 소개 한 줄</div>
              </div>
              <span className="ms arrow" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>

        <section className="actions">
          <Link className="btn btn-secondary" href="/">
            홈 둘러보기
          </Link>
          {groupId && !isWaiting ? (
            <Link className="btn btn-primary found-only" href={`/group?group=${groupId}`}>
              <span className="ms" aria-hidden="true">
                pool
              </span>
              레인방 바로 가기
            </Link>
          ) : null}
          {isWaiting ? (
            <button
              type="button"
              className="btn btn-accent waiting-only"
              onClick={handleInviteShare}
            >
              <span className="ms" aria-hidden="true">
                share
              </span>
              친구에게 초대 공유
            </button>
          ) : null}
        </section>
      </main>

      <div className="lanes" aria-hidden="true">
        <div className="lane-line" />
        <div className="lane-line" />
        <div className="lane-line" />
        <div className="lane-line" />
      </div>
      <span className="bubble b1" />
      <span className="bubble b2" />
      <span className="bubble b3" />
      <span className="bubble b4" />
      <span className="bubble b5" />
      <span className="bubble b6" />
      <GroupInviteModal
        open={inviteModalOpen}
        inviteUrl={inviteModalUrl}
        onClose={() => setInviteModalOpen(false)}
        description={
          groupId
            ? "아래 링크를 친구에게 내 주면 같은 오리발 대기방에 합류할 수 있어요."
            : "아래 링크로 반 찾기 페이지로 이동할 수 있어요."
        }
      />
    </div>
  );
}
