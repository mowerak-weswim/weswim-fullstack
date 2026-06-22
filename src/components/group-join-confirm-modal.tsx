"use client";

import { GroupKindBadge } from "@/components/group-kind-badge";
import type { GroupDetail } from "@/lib/api";
import {
  formatGroupMetaLine,
  formatGroupTitleLine,
  isWaitingGroup,
} from "@/lib/group-membership-display";

import "@/styles/weswim-group-invite-modal.css";

type GroupJoinConfirmModalProps = {
  open: boolean;
  preview: GroupDetail | null;
  loading: boolean;
  joining: boolean;
  error: string | null;
  alreadyMember?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function GroupJoinConfirmModal({
  open,
  preview,
  loading,
  joining,
  error,
  alreadyMember = false,
  onConfirm,
  onCancel,
}: GroupJoinConfirmModalProps) {
  if (!open) {
    return null;
  }

  const waiting = preview ? isWaitingGroup(preview.status) : false;

  return (
    <div
      className="group-invite-modal-bg open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !joining) {
          onCancel();
        }
      }}
    >
      <div
        className="group-invite-modal group-join-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="groupJoinConfirmTitle"
      >
        <div className="group-invite-modal__title" id="groupJoinConfirmTitle">
          레인방 입장 확인
        </div>
        <p className="group-invite-modal__desc">
          {alreadyMember
            ? "이미 이 반에 소속되어 있어요. 레인방으로 이동할까요?"
            : "아래 레인방에 입장합니다. 수영장·시간·등급을 확인해 주세요."}
        </p>

        {loading ? (
          <p className="group-join-confirm-modal__loading">반 정보를 불러오는 중…</p>
        ) : preview ? (
          <div
            className={`group-join-confirm-modal__card${waiting ? " waiting" : ""}`}
          >
            <div className="group-join-confirm-modal__card-head">
              <span className="group-join-confirm-modal__name">
                {formatGroupTitleLine(preview)}
              </span>
              <GroupKindBadge status={preview.status} />
            </div>
            <p className="group-join-confirm-modal__meta">
              {formatGroupMetaLine(preview)}
            </p>
            <p className="group-join-confirm-modal__members">
              현재 멤버 {preview.member_count}명
              {waiting ? " · 2명 이상이면 레인방이 활성화돼요" : ""}
            </p>
          </div>
        ) : (
          <p className="group-join-confirm-modal__loading">
            반 정보를 불러오지 못했어요.
          </p>
        )}

        {error ? (
          <p className="group-invite-modal__feedback group-invite-modal__feedback--warn" role="alert">
            {error}
          </p>
        ) : null}

        <div className="group-invite-modal__actions">
          {alreadyMember ? (
            <button
              type="button"
              className="group-invite-modal__btn group-invite-modal__btn--primary"
              onClick={onConfirm}
            >
              <span className="ms" aria-hidden="true">
                pool
              </span>
              레인방으로 이동
            </button>
          ) : (
            <button
              type="button"
              className="group-invite-modal__btn group-invite-modal__btn--primary"
              disabled={!preview || joining || loading}
              onClick={onConfirm}
            >
              <span className="ms" aria-hidden="true">
                login
              </span>
              {joining ? "입장 중…" : "이 레인방에 입장"}
            </button>
          )}
          <button
            type="button"
            className="group-invite-modal__btn"
            disabled={joining}
            onClick={onCancel}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
