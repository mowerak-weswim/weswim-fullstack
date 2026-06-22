"use client";

import { useMemo } from "react";

import type { BadgeDefinition, MyBadgesResponse } from "@/lib/api";

type UiCategory = "distance" | "daily" | "attend" | "special";

const CATEGORY_SECTIONS: Array<{
  key: UiCategory;
  title: string;
  icon: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  earnedBg: string;
}> = [
  {
    key: "distance",
    title: "총 누적 거리",
    icon: "route",
    tag: "무한 성장",
    tagBg: "var(--aqua-light)",
    tagColor: "var(--aqua-dark)",
    earnedBg: "linear-gradient(135deg,#00A8B5,#006970)",
  },
  {
    key: "daily",
    title: "하루 수영 거리",
    icon: "emoji_events",
    tag: "월 레벨업",
    tagBg: "#FAEEDA",
    tagColor: "#633806",
    earnedBg: "linear-gradient(135deg,#EF9F27,#BA7517)",
  },
  {
    key: "attend",
    title: "출석",
    icon: "calendar_month",
    tag: "월 레벨업",
    tagBg: "#EAF3DE",
    tagColor: "#3B6D11",
    earnedBg: "linear-gradient(135deg,#639922,#3B6D11)",
  },
  {
    key: "special",
    title: "스페셜",
    icon: "auto_awesome",
    tag: "조건부 달성",
    tagBg: "#EEEDFE",
    tagColor: "#3C3489",
    earnedBg: "linear-gradient(135deg,#534AB7,#3C3489)",
  },
];

function badgeUiCategory(def: BadgeDefinition): UiCategory {
  if (
    def.category === "distance" ||
    def.category === "distance_total" ||
    def.category === "goal"
  ) {
    return "distance";
  }
  if (def.category === "distance_daily" || def.condition_type === "distance_daily") {
    return "daily";
  }
  if (def.category === "attendance" || def.category === "streak") {
    return "attend";
  }
  return "special";
}

function badgeShortLabel(def: BadgeDefinition): string {
  if (def.level) {
    return def.level;
  }
  const km = def.condition_value >= 1000
    ? `${def.condition_value / 1000}km`
    : `${def.condition_value}m`;
  return km.length > 6 ? def.label.slice(0, 4) : km;
}

type MyBadgeCollectionProps = {
  catalog: BadgeDefinition[];
  badges: MyBadgesResponse | null;
};

export function MyBadgeCollection({ catalog, badges }: MyBadgeCollectionProps) {
  const earnedById = useMemo(() => {
    const map = new Map<string, { count: number; earnedAt: string }>();
    for (const item of badges?.earned ?? []) {
      map.set(item.badge_id, {
        count: item.earned_count,
        earnedAt: item.earned_at,
      });
    }
    return map;
  }, [badges]);

  const grouped = useMemo(() => {
    const map = new Map<UiCategory, BadgeDefinition[]>();
    for (const section of CATEGORY_SECTIONS) {
      map.set(section.key, []);
    }
    for (const def of catalog) {
      const key = badgeUiCategory(def);
      map.get(key)?.push(def);
    }
    for (const key of CATEGORY_SECTIONS.map((s) => s.key)) {
      const list = map.get(key) ?? [];
      list.sort(
        (a: BadgeDefinition, b: BadgeDefinition) =>
          a.condition_value - b.condition_value,
      );
      map.set(key, list);
    }
    return map;
  }, [catalog]);

  const earnedCount = badges?.earned.length ?? 0;
  const totalCount = catalog.length;

  if (catalog.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--gray-100)",
        marginTop: 20,
        paddingTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--navy)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span className="ms" style={{ fontSize: 16, color: "var(--aqua)" }}>
            military_tech
          </span>
          뱃지 컬렉션
        </div>
        <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
          획득 <b style={{ color: "var(--navy)" }}>{earnedCount}</b> / 전체{" "}
          {totalCount}
        </div>
      </div>

      {CATEGORY_SECTIONS.map((section, index) => {
        const items = grouped.get(section.key) ?? [];
        if (items.length === 0) {
          return null;
        }
        return (
          <div
            key={section.key}
            className="bdg-category"
            style={
              index === CATEGORY_SECTIONS.length - 1
                ? { marginBottom: 0 }
                : undefined
            }
          >
            <div className="bdg-cat-label">
              <span className="ms" style={{ fontSize: 14, color: section.tagColor }}>
                {section.icon}
              </span>
              {section.title}
              <span
                className="bdg-cat-tag"
                style={{ background: section.tagBg, color: section.tagColor }}
              >
                {section.tag}
              </span>
            </div>
            <div className="bdg-row" id={`bdgRow${index}`}>
              {items.map((def) => {
                const earned = earnedById.get(def.badge_id);
                const isEarned = Boolean(earned);
                const isNew =
                  isEarned &&
                  Date.now() - new Date(earned!.earnedAt).getTime() <
                    7 * 24 * 60 * 60 * 1000;
                return (
                  <div
                    key={def.badge_id}
                    className={`bdg-item${isEarned ? " earned" : ""}`}
                  >
                    <div
                      className={`bdg-ico${isEarned ? "" : " bdg-ico-locked"}`}
                      style={
                        isEarned
                          ? { background: section.earnedBg }
                          : undefined
                      }
                    >
                      <span className="ms">{def.icon}</span>
                      <span className="bdg-lv">{badgeShortLabel(def)}</span>
                      {earned && earned.count > 1 ? (
                        <span className="bdg-pip">×{earned.count}</span>
                      ) : null}
                      {isNew && earned && earned.count <= 1 ? (
                        <span className="bdg-pip-new" />
                      ) : null}
                    </div>
                    <div className="bdg-name">
                      {def.label}
                      {earned && earned.count > 1 ? ` ×${earned.count}` : ""}
                    </div>
                    <div className="bdg-tooltip">
                      {def.label}
                      {isNew ? (
                        <>
                          {" "}
                          <span className="tip-new">NEW</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
