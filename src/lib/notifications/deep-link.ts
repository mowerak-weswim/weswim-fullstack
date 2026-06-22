import type { NotificationItem } from "@/lib/api";

export function notificationDeepLink(item: NotificationItem): string | null {
  if (!item.ref_id) {
    return null;
  }

  switch (item.type) {
    case "comment":
    case "reaction":
      return `/community/${item.ref_id}`;
    case "record_share":
      return `/record/${item.ref_id}`;
    case "group_activated":
      return "/group";
    case "venue_activated":
      return "/group/find";
    case "schedule_created":
    case "schedule_vote":
    case "schedule_deadline":
    case "schedule_confirmed":
    case "schedule_reminder":
      return `/group/schedule/${item.ref_id}`;
    case "badge_earned":
    case "badge_master":
    case "badge_streak":
    case "badge_goal_suggest":
      return "/my/badges";
    default:
      return null;
  }
}
