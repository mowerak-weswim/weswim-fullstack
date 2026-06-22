import type { GroupMembership } from "@/lib/api";
import { daysKoFromValues, levelPubLabel } from "@/lib/group-find/constants";

export type GroupSchedule = { days?: string[]; time?: string };

export type GroupKind = "active" | "waiting" | "inactive" | "other";

export function getGroupKind(status: string): GroupKind {
  if (status === "active") {
    return "active";
  }
  if (status === "waiting") {
    return "waiting";
  }
  if (status === "inactive") {
    return "inactive";
  }
  return "other";
}

/** 활동 중 레인방 */
export function isRegisteredGroup(status: string): boolean {
  return status === "active";
}

/** 오리발 대기방 */
export function isWaitingGroup(status: string): boolean {
  return status === "waiting";
}

export function groupKindLabel(status: string): string {
  const kind = getGroupKind(status);
  if (kind === "active") {
    return "등록방";
  }
  if (kind === "waiting") {
    return "대기방";
  }
  if (kind === "inactive") {
    return "비활성";
  }
  return status;
}

export function formatGroupSchedule(
  schedule?: GroupSchedule | null,
): string {
  if (!schedule) {
    return "";
  }
  const days = daysKoFromValues(schedule.days ?? []);
  const time = schedule.time ?? "";
  return [days, time].filter(Boolean).join(" · ");
}

export function formatGroupLevelLine(level: string): string {
  return `${levelPubLabel(level)}반`;
}

export function formatGroupTitleLine(g: Pick<GroupMembership, "venue_name" | "level">): string {
  const venue = g.venue_name ?? "수영장";
  return `${venue} · ${formatGroupLevelLine(g.level)}`;
}

export function formatGroupMetaLine(
  g: Pick<GroupMembership, "level" | "schedule">,
): string {
  const scheduleText = formatGroupSchedule(g.schedule);
  const levelText = formatGroupLevelLine(g.level);
  return [levelText, scheduleText].filter(Boolean).join(" · ");
}

export function formatGroupDetailSub(
  g: Pick<GroupMembership, "venue_name" | "level" | "schedule" | "status" | "role">,
): string {
  const parts = [
    formatGroupMetaLine(g),
    groupKindLabel(g.status),
    g.role !== "member" ? g.role : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
