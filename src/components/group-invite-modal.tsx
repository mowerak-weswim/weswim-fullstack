"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  copyInviteLink,
  shareInviteNative,
} from "@/lib/group-invite";

import "@/styles/weswim-group-invite-modal.css";

type GroupInviteModalProps = {
  open: boolean;
  inviteUrl: string;
  onClose: () => void;
  title?: string;
  description?: string;
};

function canUseNativeShare(inviteUrl: string): boolean {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }
  const data: ShareData = { url: inviteUrl };
  return typeof navigator.canShare !== "function" || navigator.canShare(data);
}

export function GroupInviteModal({
  open,
  inviteUrl,
  onClose,
  title = "친구 초대",
  description = "아래 링크를 친구에게 내 주면 같은 레인방(대기방)에 합류할 수 있어요.",
}: GroupInviteModalProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const showNativeShare = useMemo(
    () => canUseNativeShare(inviteUrl),
    [inviteUrl],
  );

  const handleBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCopyMessage(null);
      setShareMessage(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleCopy() {
    const ok = await copyInviteLink(inviteUrl);
    setCopyMessage(
      ok ? "초대 링크가 클립보드에 복사되었어요." : "복사에 실패했어요. 링크를 선택해 복사해 주세요.",
    );
  }

  function handleSelectUrl(
    event: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>,
  ) {
    event.currentTarget.select();
  }

  function handleOpenLink() {
    window.open(inviteUrl, "_blank", "noopener,noreferrer");
  }

  async function handleNativeShare() {
    setShareMessage(null);
    const result = await shareInviteNative(inviteUrl);
    if (result === "shared") {
      setShareMessage("공유했어요.");
      return;
    }
    if (result === "cancelled") {
      return;
    }
    setShareMessage("공유할 수 없어요. 링크 복사를 이용해 주세요.");
  }

  return (
    <div
      className="group-invite-modal-bg open"
      role="presentation"
      onClick={handleBackdrop}
    >
      <div
        className="group-invite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="groupInviteModalTitle"
      >
        <div className="group-invite-modal__title" id="groupInviteModalTitle">
          {title}
        </div>
        <p className="group-invite-modal__desc">{description}</p>

        <label className="group-invite-modal__label" htmlFor="group-invite-url">
          초대 링크
        </label>
        <input
          id="group-invite-url"
          type="text"
          className="group-invite-modal__url"
          readOnly
          value={inviteUrl}
          onFocus={handleSelectUrl}
          onClick={handleSelectUrl}
        />

        {copyMessage ? (
          <p className="group-invite-modal__feedback" role="status">
            {copyMessage}
          </p>
        ) : null}
        {shareMessage ? (
          <p className="group-invite-modal__feedback group-invite-modal__feedback--warn" role="status">
            {shareMessage}
          </p>
        ) : null}

        <div className="group-invite-modal__actions">
          <button
            type="button"
            className="group-invite-modal__btn group-invite-modal__btn--primary"
            onClick={() => void handleCopy()}
          >
            <span className="ms" aria-hidden="true">
              content_copy
            </span>
            링크 복사
          </button>
          <button
            type="button"
            className="group-invite-modal__btn"
            onClick={handleOpenLink}
          >
            <span className="ms" aria-hidden="true">
              open_in_new
            </span>
            링크 열기
          </button>
          {showNativeShare ? (
            <button
              type="button"
              className="group-invite-modal__btn"
              onClick={() => void handleNativeShare()}
            >
              <span className="ms" aria-hidden="true">
                share
              </span>
              앱으로 공유
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="group-invite-modal__close"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
