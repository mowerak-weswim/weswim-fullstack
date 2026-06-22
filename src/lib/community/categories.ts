export type SquareCategory = "info" | "tips" | "venue" | "free" | "instructor";

const CATEGORY_META: Record<
  SquareCategory,
  { label: string; pillClass: string }
> = {
  info: { label: "정보방", pillClass: "info" },
  tips: { label: "초보 팁", pillClass: "tip" },
  venue: { label: "우리 수영장", pillClass: "pool" },
  free: { label: "자유", pillClass: "free" },
  instructor: { label: "강사실", pillClass: "coach" },
};

export function getCategoryMeta(category: string) {
  const key = category as SquareCategory;
  return (
    CATEGORY_META[key] ?? {
      label: category,
      pillClass: "free",
    }
  );
}
