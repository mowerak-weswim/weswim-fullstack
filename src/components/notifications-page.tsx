"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { notificationDeepLink } from "@/lib/notifications/deep-link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-notifications.css";

function notiIconClass(type: string): string {
  if (type.includes("comment")) {
    return "comment";
  }
  if (type.includes("like") || type.includes("reaction")) {
    return "like";
  }
  if (type.includes("record") || type.includes("badge")) {
    return type.includes("badge") ? "badge-ico" : "record";
  }
  if (type.includes("group")) {
    return "group";
  }
  return "system";
}

function notiIcon(type: string): string {
  const cls = notiIconClass(type);
  if (cls === "comment") {
    return "chat";
  }
  if (cls === "like") {
    return "favorite";
  }
  if (cls === "record") {
    return "pool";
  }
  if (cls === "group") {
    return "groups";
  }
  if (cls === "badge-ico") {
    return "workspace_premium";
  }
  return "notifications";
}

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return "오늘";
  }
  if (diff < 86400000 * 7) {
    return "이번 주";
  }
  return "이전";
}

function notiActionLabel(type: string): string | null {
  if (type === "group_activated" || type === "venue_activated") {
    return "소통방 입장하기";
  }
  if (type === "record_share") {
    return "기록 보기";
  }
  if (type.startsWith("badge_")) {
    return "뱃지 보기";
  }
  return null;
}

export function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/notifications");
        return;
      }
      const list = await getNotifications(session.access_token);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const item of items) {
      const key = groupLabel(item.created_at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [items]);

  async function handleMarkAll() {
    setMarking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }
      await markAllNotificationsRead(session.access_token);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setMarking(false);
    }
  }

  async function handleItemClick(item: NotificationItem) {
    const href = notificationDeepLink(item);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && !item.is_read) {
        await markNotificationRead(item.noti_id, session.access_token);
        setItems((prev) =>
          prev.map((n) =>
            n.noti_id === item.noti_id ? { ...n, is_read: true } : n,
          ),
        );
      }
      if (href) {
        router.push(href);
      }
    } catch {
      if (href) {
        router.push(href);
      }
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <>
      <SiteGnb activeNav="home" />
      <div className="notifications-screen">
        <div className="wrap">
          <div className="inner">
            <div className="page-header">
              <h1 className="page-title">알림</h1>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="read-all-btn"
                  disabled={marking}
                  onClick={() => void handleMarkAll()}
                >
                  <span className="ms" aria-hidden="true">
                    done_all
                  </span>
                  모두 읽음
                </button>
              )}
            </div>

            {loading && (
              <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
                불러오는 중…
              </p>
            )}
            {error && (
              <p style={{ color: "var(--error)", marginBottom: 16 }}>{error}</p>
            )}

            {!loading && !error && items.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid var(--gray-200)",
                }}
              >
                <span
                  className="ms"
                  style={{ fontSize: 48, color: "var(--gray-300)" }}
                  aria-hidden="true"
                >
                  notifications_none
                </span>
                <p
                  style={{
                    marginTop: 12,
                    fontWeight: 800,
                    color: "var(--navy)",
                  }}
                >
                  알림이 없어요
                </p>
                <p style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 6 }}>
                  댓글·좋아요·반 활동 소식이 여기에 표시됩니다.
                </p>
                <Link
                  href="/"
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    color: "var(--aqua)",
                    fontWeight: 700,
                  }}
                >
                  홈으로
                </Link>
              </div>
            )}

            {grouped.map(([label, groupItems]) => (
              <div key={label} className="noti-group">
                <div className="noti-group-title">{label}</div>
                {groupItems.map((item) => {
                  const icoClass = notiIconClass(item.type);
                  const href = notificationDeepLink(item);
                  const actionLabel = notiActionLabel(item.type);
                  return (
                    <div
                      key={item.noti_id}
                      role="button"
                      tabIndex={0}
                      className={`noti-item${item.is_read ? "" : " unread"}`}
                      onClick={() => void handleItemClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleItemClick(item);
                        }
                      }}
                    >
                      <div className={`noti-ico ${icoClass}`}>
                        <span className="ms" aria-hidden="true">
                          {notiIcon(item.type)}
                        </span>
                      </div>
                      <div className="noti-body">
                        <p className="noti-text">
                          {item.message ?? item.type}
                        </p>
                        <p className="noti-time">
                          {formatRelativeTime(item.created_at)}
                        </p>
                        {href && actionLabel && (
                          <button
                            type="button"
                            className="noti-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleItemClick(item);
                            }}
                          >
                            <span className="ms" aria-hidden="true">
                              arrow_forward
                            </span>
                            {actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
