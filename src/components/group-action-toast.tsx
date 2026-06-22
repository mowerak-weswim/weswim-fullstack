"use client";

import "@/styles/weswim-group-action-toast.css";

export type GroupActionToastPayload = {
  type: "ok" | "warn";
  title: string;
  sub?: string;
};

type GroupActionToastProps = {
  toast: GroupActionToastPayload | null;
};

export function GroupActionToast({ toast }: GroupActionToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`group-action-toast${toast ? " show" : ""}`} role="status">
      <div className={`group-action-toast__ico ${toast.type === "ok" ? "ok" : "warn"}`}>
        <span className="ms" aria-hidden="true">
          {toast.type === "ok" ? "check" : "warning"}
        </span>
      </div>
      <div className="group-action-toast__body">
        <div className="group-action-toast__title">{toast.title}</div>
        {toast.sub ? (
          <div className="group-action-toast__sub">{toast.sub}</div>
        ) : null}
      </div>
    </div>
  );
}

export const GROUP_JOIN_TOAST_KEY = "weswim_group_join_toast";

export function saveGroupJoinToast(payload: GroupActionToastPayload): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(GROUP_JOIN_TOAST_KEY, JSON.stringify(payload));
}

export function consumeGroupJoinToast(): GroupActionToastPayload | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(GROUP_JOIN_TOAST_KEY);
  sessionStorage.removeItem(GROUP_JOIN_TOAST_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as GroupActionToastPayload;
  } catch {
    return null;
  }
}
