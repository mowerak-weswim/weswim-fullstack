"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getUnreadNotificationCount } from "@/lib/api";
import { avatarInitial } from "@/lib/format/relative-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SiteGnbProps = {
  activeNav?: "home" | "group" | "record" | "my";
};

const NAV_ITEMS = [
  { id: "home" as const, href: "/", label: "홈" },
  { id: "group" as const, href: "/group", label: "우리반" },
  { id: "record" as const, href: "/record/new", label: "기록" },
  { id: "my" as const, href: "/my", label: "마이" },
];

const AVATAR_STORAGE_KEY = "weswim_profile_avatar_data_url";

export function SiteGnb({ activeNav = "home" }: SiteGnbProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarLabel, setAvatarLabel] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setAvatarLabel(null);
        setAvatarImageUrl(null);
        setUnreadCount(0);
        return;
      }

      if (typeof window !== "undefined") {
        setAvatarImageUrl(window.localStorage.getItem(AVATAR_STORAGE_KEY));
      }

      const nickname =
        (session.user.user_metadata?.nickname as string | undefined) ??
        session.user.email?.split("@")[0] ??
        null;
      setAvatarLabel(avatarInitial(nickname));

      if (session.access_token) {
        try {
          const count = await getUnreadNotificationCount(session.access_token);
          setUnreadCount(count);
        } catch {
          setUnreadCount(0);
        }
      }
    }

    loadUser();

    function handleStorage(event: StorageEvent) {
      if (event.key === AVATAR_STORAGE_KEY) {
        setAvatarImageUrl(event.newValue);
      }
    }

    function handleAvatarUpdated() {
      if (typeof window !== "undefined") {
        setAvatarImageUrl(window.localStorage.getItem(AVATAR_STORAGE_KEY));
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("weswim-avatar-updated", handleAvatarUpdated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("weswim-avatar-updated", handleAvatarUpdated);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      <header className="gnb">
        <div className="gnb-inner">
          <Link className="gnb-logo" href="/">
            <span className="We">We</span>
            <span className="Swim">Swim</span>
          </Link>
          <nav className="gnb-nav" aria-label="주요 메뉴">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                className={activeNav === item.id ? "on" : undefined}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="gnb-right">
            <Link className="icon-btn" href="/search" aria-label="검색">
              <span className="ms" aria-hidden="true">
                search
              </span>
            </Link>
            <Link
              className="icon-btn icon-btn-noti"
              href="/notifications"
              aria-label="알림"
            >
              <span className="ms" aria-hidden="true">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge" aria-hidden="true">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            {avatarLabel ? (
              <Link className="gnb-avatar" href="/my" title="마이">
                {avatarImageUrl ? (
                  <Image
                    src={avatarImageUrl}
                    alt="내 아바타"
                    width={36}
                    height={36}
                    unoptimized
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  avatarLabel
                )}
              </Link>
            ) : (
              <Link className="gnb-avatar" href="/login" title="로그인">
                ?
              </Link>
            )}
            <button
              className="gnb-hamburger"
              aria-label="메뉴"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <span className="ms">menu</span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`drw-ov${drawerOpen ? " on" : ""}`}
        onClick={() => setDrawerOpen(false)}
        role="presentation"
      />
      <aside className={`drw${drawerOpen ? " on" : ""}`}>
        <div className="drw-hd">
          <div className="drw-logo">
            <span className="We">We</span>
            <span className="Sw">Swim</span>
          </div>
          <button
            className="drw-x"
            aria-label="닫기"
            onClick={() => setDrawerOpen(false)}
            type="button"
          >
            <span className="ms">close</span>
          </button>
        </div>
        <div className="drw-bd">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              className={`drw-it${activeNav === item.id ? " on" : ""}`}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
