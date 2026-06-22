export const MAIN_STROKES = ["자유형", "배영", "평영", "접영"] as const;
export const MIXED_STROKE = "혼합";

export type MainStroke = (typeof MAIN_STROKES)[number];

/** 자유형·배영·평영·접영은 복수 선택, 혼합 선택 시 나머지 초기화 */
export function toggleStrokeSelection(prev: string[], name: string): string[] {
  if (name === MIXED_STROKE) {
    return prev.includes(MIXED_STROKE) ? [] : [MIXED_STROKE];
  }

  const withoutMixed = prev.filter((s) => s !== MIXED_STROKE);
  if (withoutMixed.includes(name)) {
    return withoutMixed.filter((s) => s !== name);
  }
  return [...withoutMixed, name];
}

/** 거리 분할 대상 영법 (혼합·4영법 선택 → 4분할) */
export function resolveStrokeDistanceParts(strokes: string[]): string[] {
  if (strokes.includes(MIXED_STROKE)) {
    return [...MAIN_STROKES];
  }
  return strokes.filter((s): s is MainStroke =>
    (MAIN_STROKES as readonly string[]).includes(s),
  );
}

export function splitDistanceEvenly(
  total: number,
  parts: string[],
): Record<string, number> {
  if (parts.length === 0 || total <= 0) {
    return {};
  }
  const base = Math.floor(total / parts.length);
  let remainder = total - base * parts.length;
  const result: Record<string, number> = {};
  for (const name of parts) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    result[name] = base + extra;
  }
  return result;
}

export function buildStrokeDistances(
  distance: number,
  strokes: string[],
): Record<string, number> {
  return splitDistanceEvenly(distance, resolveStrokeDistanceParts(strokes));
}

export function strokesFromRecord(data: Record<string, unknown>): string[] {
  return Array.isArray(data.strokes) ? (data.strokes as string[]) : [];
}

export function strokeDistancesFromRecord(
  data: Record<string, unknown>,
): Record<string, number> | null {
  const raw = data.stroke_distances;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
