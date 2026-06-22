import Link from "next/link";

import { GroupKindBadge } from "@/components/group-kind-badge";
import type { GroupMembership } from "@/lib/api";
import {
  formatGroupSchedule,
  formatGroupTitleLine,
  isWaitingGroup,
} from "@/lib/group-membership-display";

type GroupLaneCompactLinkProps = {
  group: GroupMembership;
  href: string;
  active?: boolean;
};

export function GroupLaneCompactLink({
  group,
  href,
  active = false,
}: GroupLaneCompactLinkProps) {
  const waiting = isWaitingGroup(group.status);

  return (
    <Link
      href={href}
      className={`lane-compact-card${waiting ? " waiting" : ""}${active ? " on" : ""}`}
    >
      <div className="lane-compact-card__head">
        <span className="lane-compact-card__title">{formatGroupTitleLine(group)}</span>
        <GroupKindBadge status={group.status} />
      </div>
      <div className="lane-compact-card__sub">
        {formatGroupSchedule(group.schedule)}
        {waiting ? " · 2명+ 활성화" : ""}
      </div>
    </Link>
  );
}
