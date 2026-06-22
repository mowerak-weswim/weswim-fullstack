const LEVEL_LABELS: Record<string, string> = {
  beginner_1: "입문 1단",
  beginner_2: "입문 2단",
  intermediate: "중급",
  advanced: "상급",
};

export function levelLabel(level: string | null | undefined): string {
  if (!level) {
    return "—";
  }
  return LEVEL_LABELS[level] ?? level;
}
