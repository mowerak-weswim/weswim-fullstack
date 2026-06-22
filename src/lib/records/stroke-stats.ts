import type { SwimRecord } from "@/lib/api";

export type StrokeStatRow = {
  name: string;
  distance: number;
  sessions: number;
  pct: number;
  barColor: string;
  iconBg: string;
  iconColor: string;
};

const STROKE_STYLE: Record<
  string,
  { barColor: string; iconBg: string; iconColor: string }
> = {
  자유형: {
    barColor: "var(--aqua)",
    iconBg: "var(--aqua-light)",
    iconColor: "var(--aqua-dark)",
  },
  배영: {
    barColor: "var(--mint)",
    iconBg: "#E8F7F4",
    iconColor: "#0A8F7C",
  },
  평영: {
    barColor: "var(--sun)",
    iconBg: "var(--sun-light)",
    iconColor: "#9B6D0A",
  },
  접영: {
    barColor: "var(--coral)",
    iconBg: "var(--coral-light)",
    iconColor: "var(--coral-dark)",
  },
};

const DEFAULT_STYLE = {
  barColor: "var(--gray-300)",
  iconBg: "var(--gray-100)",
  iconColor: "var(--gray-500)",
};

function recordDistance(data: Record<string, unknown>): number {
  const raw = data.distance;
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

import {
  buildStrokeDistances,
  strokeDistancesFromRecord,
  strokesFromRecord,
} from "@/lib/records/stroke-record";

export function computeMonthlyStrokeStats(
  records: SwimRecord[],
): { rows: StrokeStatRow[]; totalDistance: number } {
  const byStroke = new Map<string, { distance: number; sessions: number }>();
  let totalDistance = 0;

  for (const record of records) {
    const dist = recordDistance(record.record_data);
    if (dist <= 0) {
      continue;
    }
    totalDistance += dist;

    const savedDistances = strokeDistancesFromRecord(record.record_data);
    const distanceByStroke =
      savedDistances ??
      buildStrokeDistances(dist, strokesFromRecord(record.record_data));

    const entries = Object.entries(distanceByStroke);
    if (entries.length === 0) {
      const key = "기타";
      const cur = byStroke.get(key) ?? { distance: 0, sessions: 0 };
      byStroke.set(key, {
        distance: cur.distance + dist,
        sessions: cur.sessions + 1,
      });
      continue;
    }

    for (const [stroke, strokeDist] of entries) {
      const cur = byStroke.get(stroke) ?? { distance: 0, sessions: 0 };
      byStroke.set(stroke, {
        distance: cur.distance + strokeDist,
        sessions: cur.sessions + 1,
      });
    }
  }

  const rows = Array.from(byStroke.entries())
    .map(([name, { distance, sessions }]) => {
      const style = STROKE_STYLE[name] ?? DEFAULT_STYLE;
      const pct =
        totalDistance > 0 ? Math.round((distance / totalDistance) * 100) : 0;
      return {
        name,
        distance,
        sessions,
        pct,
        ...style,
      };
    })
    .sort((a, b) => b.distance - a.distance);

  return { rows, totalDistance };
}
