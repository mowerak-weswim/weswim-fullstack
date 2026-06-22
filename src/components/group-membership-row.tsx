import Link from "next/link";

import { GroupKindBadge } from "@/components/group-kind-badge";
import type { GroupMembership } from "@/lib/api";
import {
  formatGroupMetaLine,
  formatGroupTitleLine,
  getGroupKind,
} from "@/lib/group-membership-display";

type GroupMembershipRowProps = {
  group: GroupMembership;
  variant: "settings" | "history" | "sidebar";
  href?: string;
  onLeave?: () => void;
  showWaitingHint?: boolean;
  active?: boolean;
};

function rowIcon(status: string): string {
  return getGroupKind(status) === "waiting" ? "hourglass_top" : "pool";
}

function rowKindClass(status: string): string {
  const kind = getGroupKind(status);
  if (kind === "waiting") {
    return "gm-row--waiting";
  }
  if (kind === "active") {
    return "gm-row--active";
  }
  return "gm-row--other";
}

export function GroupMembershipRow({
  group,
  variant,
  href,
  onLeave,
  showWaitingHint = false,
  active = false,
}: GroupMembershipRowProps) {
  const className = `gm-row gm-row--${variant} ${rowKindClass(group.status)}${active ? " on" : ""}`;
  const subLine =
    showWaitingHint && getGroupKind(group.status) === "waiting"
      ? `${formatGroupMetaLine(group)} · 멤버 2명 이상 시 활성화`
      : formatGroupMetaLine(group);

  const content = (
    <>
      <div className="gm-row__icon" aria-hidden="true">
        <span className="ms">{rowIcon(group.status)}</span>
      </div>
      <div className="gm-row__body">
        <div className="gm-row__title">{formatGroupTitleLine(group)}</div>
        <div className="gm-row__sub">{subLine}</div>
      </div>
      <GroupKindBadge status={group.status} className="gm-row__badge" />
      {onLeave ? (
        <button type="button" className="gm-row__leave" onClick={onLeave}>
          <span className="ms" aria-hidden="true">
            logout
          </span>
          나가기
        </button>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
