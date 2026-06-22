import type { SquareCategory } from "./categories";

export type PubCategoryFilter =
  | "all"
  | "info"
  | "tip"
  | "pool"
  | "free"
  | "coach";

const PUB_TO_API: Record<PubCategoryFilter, SquareCategory | undefined> = {
  all: undefined,
  info: "info",
  tip: "tips",
  pool: "venue",
  free: "free",
  coach: "instructor",
};

export function pubCategoryToApi(
  pub: PubCategoryFilter,
): SquareCategory | undefined {
  return PUB_TO_API[pub];
}

export const FEED_CATEGORY_TABS: Array<{
  id: PubCategoryFilter;
  label: string;
  icon?: string;
  newDot?: boolean;
}> = [
  { id: "all", label: "전체", icon: "apps" },
  { id: "info", label: "정보방" },
  { id: "tip", label: "초보 팁", newDot: true },
  { id: "pool", label: "우리 수영장" },
  { id: "free", label: "자유" },
  { id: "coach", label: "강사실" },
];

/** home.html `.mob-tabs` — 데스크톱 `.feed-tabs`와 아이콘 상이 */
export const MOB_FEED_CATEGORY_TABS: Array<{
  id: PubCategoryFilter;
  label: string;
  icon: string;
}> = [
  { id: "all", label: "전체", icon: "grid_view" },
  { id: "info", label: "정보방", icon: "info" },
  { id: "tip", label: "초보 팁", icon: "lightbulb" },
  { id: "pool", label: "우리 수영장", icon: "pool" },
  { id: "free", label: "자유", icon: "chat_bubble" },
  { id: "coach", label: "강사실", icon: "workspace_premium" },
];

export const SIDEBAR_CATEGORIES: Array<{
  id: PubCategoryFilter;
  label: string;
  icon: string;
}> = [
  { id: "all", label: "전체", icon: "apps" },
  { id: "info", label: "정보방", icon: "tips_and_updates" },
  { id: "tip", label: "초보 팁", icon: "water_drop" },
  { id: "pool", label: "우리 수영장", icon: "apartment" },
  { id: "free", label: "자유게시판", icon: "chat" },
  { id: "coach", label: "강사실", icon: "workspace_premium" },
];
