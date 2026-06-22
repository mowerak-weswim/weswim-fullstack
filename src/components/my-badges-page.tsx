"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteGnb } from "@/components/layout/site-gnb";
import {
  getMyBadges,
  getMyProfile,
  type MyBadgesResponse,
  type UserProfile,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-my-badges.css";

type Filter = "all" | "distance" | "daily" | "attend" | "special";

type SectionDef = {
  cat: Exclude<Filter, "all">;
  icon: string;
  title: string;
};

const SECTION_DEFS: SectionDef[] = [
  { cat: "distance", icon: "straighten", title: "누적 거리" },
  { cat: "daily", icon: "speed", title: "하루 거리" },
  { cat: "attend", icon: "calendar_month", title: "출석" },
  { cat: "special", icon: "workspace_premium", title: "스페셜" },
];

function normalizeCategory(category: string): Filter {
  if (category === "distance") return "distance";
  if (category === "daily") return "daily";
  if (category === "attend") return "attend";
  if (category === "special") return "special";
  return "all";
}

export function MyBadgesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<MyBadgesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/my/badges");
        return;
      }

      const token = session.access_token;
      const [me, badges] = await Promise.all([
        getMyProfile(token),
        getMyBadges(token),
      ]);
      setProfile(me);
      setData(badges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "배지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const earned = useMemo(() => data?.earned ?? [], [data]);
  const inProgress = useMemo(() => data?.in_progress ?? [], [data]);

  const earnedByCat = useMemo(() => {
    const map = new Map<Exclude<Filter, "all">, typeof earned>();
    for (const d of SECTION_DEFS) {
      map.set(d.cat, []);
    }
    for (const item of earned) {
      const cat = normalizeCategory(item.ui_category ?? item.category);
      if (cat === "all") continue;
      map.get(cat)?.push(item);
    }
    return map;
  }, [earned]);

  const inProgressByCat = useMemo(() => {
    const map = new Map<Exclude<Filter, "all">, typeof inProgress>();
    for (const d of SECTION_DEFS) {
      map.set(d.cat, []);
    }
    for (const item of inProgress) {
      const cat = normalizeCategory(item.ui_category);
      if (cat === "all") continue;
      map.get(cat)?.push(item);
    }
    return map;
  }, [inProgress]);

  const total = earned.length + inProgress.length;
  const completionPct =
    total > 0 ? Math.round((earned.length / total) * 100) : 0;

  const headerTitle = profile?.nickname
    ? `${profile.nickname}님의 뱃지 🏅`
    : "나의 뱃지 🏅";

  function iconBg(cat: SectionDef["cat"]): string {
    switch (cat) {
      case "distance":
        return "var(--aqua-light)";
      case "daily":
        return "var(--aqua-light)";
      case "attend":
        return "var(--mint-light)";
      case "special":
        return "var(--coral-light)";
    }
  }

  return (
    <>
      <SiteGnb activeNav="my" />
      <div className="my-badges-screen">
        <div className="back-wrap">
          <Link href="/my" className="back-btn">
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            마이
          </Link>
        </div>

        <div className="page">
          <div className="badge-header">
            <div className="bh-eyebrow">나의 레인 · 뱃지 컬렉션</div>
            <h1 className="bh-title">{headerTitle}</h1>
            <div className="bh-summary">
              <div className="bh-stat">
                <b>{earned.length}</b>
                <span>획득 뱃지</span>
              </div>
              <div className="bh-stat">
                <b>{inProgress.length}</b>
                <span>미획득</span>
              </div>
              <div className="bh-stat">
                <b>{completionPct}%</b>
                <span>달성률</span>
              </div>
            </div>
          </div>

          <div className="filter-tabs" id="filterTabs">
            {(
              [
                ["all", "전체"],
                ["distance", "누적 거리"],
                ["daily", "하루 거리"],
                ["attend", "출석"],
                ["special", "스페셜"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-cat={id}
                className={`ft${filter === id ? " on" : ""}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <p style={{ color: "var(--gray-500)" }}>불러오는 중…</p>}
          {error && <p style={{ color: "var(--error)" }}>{error}</p>}

          {!loading && !error && (
            <>
              {SECTION_DEFS.map((sec) => {
                const show = filter === "all" || filter === sec.cat;
                const earnedItems = earnedByCat.get(sec.cat) ?? [];
                const inProgressItems = inProgressByCat.get(sec.cat) ?? [];

                return (
                  <section
                    key={sec.cat}
                    className="badge-section"
                    data-cat={sec.cat}
                    style={{ display: show ? undefined : "none" }}
                  >
                    <div className="bs-title">
                      <span className="ms" aria-hidden="true">
                        {sec.icon}
                      </span>
                      {sec.title}
                      <span className="bs-sub">
                        {earnedItems.length + inProgressItems.length}개
                      </span>
                    </div>
                    <div className="badge-list">
                      {earnedItems.map((b) => (
                        <div key={b.badge_id} className="badge-item" data-cat={b.ui_category}>
                          <div className="bi-icon" style={{ background: iconBg(sec.cat) }}>
                            {b.icon}
                          </div>
                          <div className="bi-info">
                            <div className="bi-name">{b.label}</div>
                            <div className="bi-desc">획득 뱃지</div>
                            <div className="bi-progress-wrap">
                              <span style={{ fontSize: 11, color: "var(--aqua-dark)" }}>
                                {new Date(b.earned_at).toLocaleDateString("ko-KR")} 획득
                              </span>
                            </div>
                          </div>
                          <div className="bi-status">
                            <span className="ms" aria-hidden="true">
                              check_circle
                            </span>
                            달성
                          </div>
                        </div>
                      ))}

                      {inProgressItems.map((b) => (
                        <div
                          key={b.badge_id}
                          className="badge-item locked"
                          data-cat={b.ui_category}
                        >
                          <div className="bi-icon" style={{ background: "var(--gray-100)" }}>
                            {b.icon}
                          </div>
                          <div className="bi-info">
                            <div className="bi-name">{b.label}</div>
                            <div className="bi-progress-wrap">
                              <div className="bi-bar">
                                <div
                                  className="bi-fill"
                                  style={{ width: `${b.progress_pct}%` }}
                                />
                              </div>
                              <span className="bi-pct">
                                {b.current_value}/{b.condition_value}
                              </span>
                            </div>
                          </div>
                          <div className="bi-status locked-badge">
                            <span className="ms" aria-hidden="true">
                              lock
                            </span>
                            잠금
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {earned.length === 0 && inProgress.length === 0 && (
                <p style={{ fontSize: 14, color: "var(--gray-500)" }}>
                  표시할 배지가 없어요. 수영 기록을 쌓아보세요!
                </p>
              )}

              <Link
                href="/guide/badges"
                style={{
                  display: "inline-flex",
                  marginTop: 16,
                  color: "var(--aqua)",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                배지 가이드 보기 →
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
