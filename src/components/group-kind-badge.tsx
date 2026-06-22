import {
  getGroupKind,
  groupKindLabel,
  type GroupKind,
} from "@/lib/group-membership-display";

const KIND_CLASS: Record<GroupKind, string> = {
  active: "kind-active",
  waiting: "kind-waiting",
  inactive: "kind-inactive",
  other: "kind-other",
};

type GroupKindBadgeProps = {
  status: string;
  className?: string;
};

export function GroupKindBadge({ status, className = "" }: GroupKindBadgeProps) {
  const kind = getGroupKind(status);
  return (
    <span className={`group-kind-badge ${KIND_CLASS[kind]}${className ? ` ${className}` : ""}`}>
      {groupKindLabel(status)}
    </span>
  );
}
