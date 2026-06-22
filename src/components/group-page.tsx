"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  consumeGroupJoinToast,
  GroupActionToast,
  saveGroupJoinToast,
  type GroupActionToastPayload,
} from "@/components/group-action-toast";
import { GroupJoinConfirmModal } from "@/components/group-join-confirm-modal";
import { GroupInviteModal } from "@/components/group-invite-modal";
import { GroupLaneCompactLink } from "@/components/group-lane-compact-link";
import { GroupKindBadge } from "@/components/group-kind-badge";
import { SiteGnb } from "@/components/layout/site-gnb";
import {
  createGroupPost,
  getGroup,
  getGroupMembers,
  getGroupPosts,
  getGroupSchedules,
  getMyGroups,
  joinGroup,
  submitScheduleRsvp,
  type FeedPost,
  type GroupDetail,
  type GroupMember,
  type GroupMembership,
  type GroupSchedule,
  type GroupTab,
} from "@/lib/api";
import {
  formatGroupSchedule,
  formatGroupTitleLine,
  isRegisteredGroup,
  isWaitingGroup as isWaitingStatus,
} from "@/lib/group-membership-display";
import {
  avatarInitial,
  avatarVariant,
  formatRelativeTime,
} from "@/lib/format/relative-time";
import {
  buildGroupInviteUrl,
  parseGroupIdFromInviteInput,
} from "@/lib/group-invite";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-group-membership.css";
import "@/styles/weswim-group.css";
import "@/styles/weswim-group-none.css";

const CHANNELS: Array<{
  id: GroupTab;
  label: string;
  mobLabel: string;
  icon: string;
  headClass: string;
  sub: string;
}> = [
  {
    id: "chat",
    label: "오늘의 잡담",
    mobLabel: "잡담",
    icon: "forum",
    headClass: "",
    sub: "수업 후기, 일상 소통 · 기록 공유 봇 메시지 포함",
  },
  {
    id: "notice",
    label: "공지 · 벙개",
    mobLabel: "공지·벙개",
    icon: "campaign",
    headClass: "notice",
    sub: "회식·번개·일정 안내. 운영 공지도 여기서.",
  },
  {
    id: "etiquette",
    label: "수영 에티켓",
    mobLabel: "에티켓",
    icon: "water_drop",
    headClass: "etiquette",
    sub: "레인 매너·건의 사항 · 익명 작성 가능",
  },
];

const MOB_TABS: GroupTab[] = ["notice", "chat", "etiquette"];

function formatWhen(iso: string | null) {
  if (!iso) {
    return "";
  }
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(post: FeedPost): string {
  if (post.category === "record_share") {
    return "킥파니";
  }
  if (post.tags?.includes("anonymous")) {
    return "익명의 멤버";
  }
  return post.author?.nickname ?? "회원";
}

function isPostVisibleInTab(
  postCategory: string,
  activeTab: GroupTab,
): boolean {
  if (activeTab === "notice") {
    return postCategory === "notice";
  }
  if (activeTab === "etiquette") {
    return postCategory === "etiquette";
  }
  return postCategory === "chat" || postCategory === "record_share";
}

const LAST_READ_STORAGE_PREFIX = "weswim:group:last-read";

function getLastReadStorageKey(groupId: string, tabId: GroupTab): string {
  return `${LAST_READ_STORAGE_PREFIX}:${groupId}:${tabId}`;
}

function readLastRead(groupId: string, tabId: GroupTab): Date | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(
    getLastReadStorageKey(groupId, tabId),
  );
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function markTabRead(groupId: string, tabId: GroupTab): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getLastReadStorageKey(groupId, tabId),
    new Date().toISOString(),
  );
}

function countUnreadSince(
  createdAts: Array<string | null | undefined>,
  lastRead: Date | null,
): number {
  if (!lastRead) {
    return createdAts.filter(Boolean).length;
  }
  const pivot = lastRead.getTime();
  let count = 0;
  for (const at of createdAts) {
    if (!at) {
      continue;
    }
    const t = new Date(at).getTime();
    if (!Number.isNaN(t) && t > pivot) {
      count += 1;
    }
  }
  return count;
}

function formatUnread(count: number): string {
  return count > 99 ? "99+" : String(count);
}

type LaneNotificationMode = "all" | "mention" | "notice_only" | "mute";

const LANE_NOTIFICATION_STORAGE_PREFIX = "weswim:group:notification-mode";
const LANE_NOTIFICATION_OPTIONS: Array<{
  mode: LaneNotificationMode;
  label: string;
  desc: string;
}> = [
  { mode: "all", label: "전체 알림", desc: "모든 새 글/일정 알림" },
  { mode: "mention", label: "멘션만", desc: "나를 멘션한 경우만" },
  {
    mode: "notice_only",
    label: "공지·벙개만",
    desc: "공지와 일정 관련 알림만",
  },
  { mode: "mute", label: "끔", desc: "이 반 알림 끄기" },
];

function getLaneNotificationStorageKey(groupId: string): string {
  return `${LANE_NOTIFICATION_STORAGE_PREFIX}:${groupId}`;
}

function readLaneNotificationMode(groupId: string): LaneNotificationMode {
  if (typeof window === "undefined") {
    return "all";
  }
  const raw = window.localStorage.getItem(
    getLaneNotificationStorageKey(groupId),
  );
  if (
    raw === "all" ||
    raw === "mention" ||
    raw === "notice_only" ||
    raw === "mute"
  ) {
    return raw;
  }
  return "all";
}

function writeLaneNotificationMode(
  groupId: string,
  mode: LaneNotificationMode,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getLaneNotificationStorageKey(groupId), mode);
}

export function GroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as GroupTab) || "chat";
  const requestedGroupId = searchParams.get("groupId");
  const inviteFromLink = searchParams.get("invite") === "1";

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GroupTab>(initialTab);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [compose, setCompose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState("회");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeMessage, setJoinCodeMessage] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalUrl, setInviteModalUrl] = useState("");
  const [joinConfirmGroupId, setJoinConfirmGroupId] = useState<string | null>(
    null,
  );
  const [joinConfirmPreview, setJoinConfirmPreview] =
    useState<GroupDetail | null>(null);
  const [joinConfirmPreviewLoading, setJoinConfirmPreviewLoading] =
    useState(false);
  const [joinConfirmJoining, setJoinConfirmJoining] = useState(false);
  const [joinConfirmError, setJoinConfirmError] = useState<string | null>(null);
  const [groupToast, setGroupToast] = useState<GroupActionToastPayload | null>(
    null,
  );
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [channelUnread, setChannelUnread] = useState<Record<GroupTab, number>>({
    notice: 0,
    chat: 0,
    etiquette: 0,
  });
  const [laneSettingsOpen, setLaneSettingsOpen] = useState(false);
  const [laneNotificationMode, setLaneNotificationMode] =
    useState<LaneNotificationMode>("all");
  const inviteFlowHandled = useRef(false);
  const submitPostInFlightRef = useRef(false);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);
  const laneSettingsRef = useRef<HTMLDivElement | null>(null);

  const groupId = group?.group_id;
  const isWaitingGroup = group?.status === "waiting";

  const nextSchedule = useMemo(() => {
    const open = schedules.filter((s) => s.status !== "done");
    return open[0] ?? null;
  }, [schedules]);

  const sortedMemberships = useMemo(
    () => [
      ...memberships.filter((g) => isRegisteredGroup(g.status)),
      ...memberships.filter((g) => isWaitingStatus(g.status)),
      ...memberships.filter(
        (g) => !isRegisteredGroup(g.status) && !isWaitingStatus(g.status),
      ),
    ],
    [memberships],
  );

  const loadFeed = useCallback(
    async (gid: string, accessToken: string, activeTab: GroupTab) => {
      const [postList, scheduleList] = await Promise.all([
        getGroupPosts(gid, accessToken, activeTab),
        getGroupSchedules(gid, accessToken),
      ]);

      const otherTabs = CHANNELS.map((c) => c.id).filter(
        (id) => id !== activeTab,
      );
      const otherTabPosts = await Promise.all(
        otherTabs.map(async (tabId) => ({
          tabId,
          items: await getGroupPosts(gid, accessToken, tabId),
        })),
      );

      const postsByTab: Record<GroupTab, FeedPost[]> = {
        notice: [],
        chat: [],
        etiquette: [],
      };
      postsByTab[activeTab] = postList;
      for (const row of otherTabPosts) {
        postsByTab[row.tabId] = row.items;
      }

      markTabRead(gid, activeTab);

      const nextUnread: Record<GroupTab, number> = {
        notice: countUnreadSince(
          [
            ...postsByTab.notice.map((p) => p.created_at),
            ...scheduleList.map((s) => s.created_at),
          ],
          readLastRead(gid, "notice"),
        ),
        chat: countUnreadSince(
          postsByTab.chat.map((p) => p.created_at),
          readLastRead(gid, "chat"),
        ),
        etiquette: countUnreadSince(
          postsByTab.etiquette.map((p) => p.created_at),
          readLastRead(gid, "etiquette"),
        ),
      };
      nextUnread[activeTab] = 0;

      setPosts(postList);
      setSchedules(scheduleList);
      setChannelUnread(nextUnread);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const next =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/group";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setToken(session.access_token);
      setCurrentUserId(session.user.id);
      const meta = session.user.user_metadata as { nickname?: string };
      setUserNickname(
        meta.nickname ?? session.user.email?.split("@")[0] ?? "회",
      );

      const myGroups = await getMyGroups(session.access_token);

      setMemberships(myGroups);

      if (myGroups.length === 0) {
        setGroup(null);
        return;
      }

      const primary =
        myGroups.find((g) => g.group_id === requestedGroupId) ?? myGroups[0];
      const [detail, memberList] = await Promise.all([
        getGroup(primary.group_id),
        getGroupMembers(primary.group_id, session.access_token),
      ]);
      setGroup(detail);
      setMembers(memberList);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "반 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestedGroupId, inviteFromLink, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !token) {
      return;
    }

    if (searchParams.get("joined") === "1") {
      const payload = consumeGroupJoinToast();
      if (payload) {
        setGroupToast(payload);
        window.setTimeout(() => setGroupToast(null), 5000);
      }
      const gid = searchParams.get("groupId");
      router.replace(gid ? `/group?groupId=${gid}` : "/group", {
        scroll: false,
      });
      return;
    }

    if (!inviteFromLink || !requestedGroupId || inviteFlowHandled.current) {
      return;
    }
    inviteFlowHandled.current = true;

    const existing = memberships.find((g) => g.group_id === requestedGroupId);
    if (existing) {
      router.replace(`/group?groupId=${requestedGroupId}`, { scroll: false });
      setGroupToast({
        type: "ok",
        title: "이미 이 반에 소속되어 있어요.",
        sub: formatGroupTitleLine(existing),
      });
      window.setTimeout(() => setGroupToast(null), 5000);
      return;
    }

    setJoinConfirmGroupId(requestedGroupId);
  }, [
    loading,
    token,
    inviteFromLink,
    requestedGroupId,
    memberships,
    searchParams,
    router,
  ]);

  useEffect(() => {
    if (!joinConfirmGroupId) {
      setJoinConfirmPreview(null);
      setJoinConfirmPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setJoinConfirmPreviewLoading(true);
    setJoinConfirmError(null);
    void getGroup(joinConfirmGroupId)
      .then((detail) => {
        if (!cancelled) {
          setJoinConfirmPreview(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJoinConfirmPreview(null);
          setJoinConfirmError("레인방 정보를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setJoinConfirmPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [joinConfirmGroupId]);

  useEffect(() => {
    if (!groupId || !token) {
      return;
    }
    void loadFeed(groupId, token, tab);
  }, [groupId, token, tab, loadFeed]);

  useEffect(() => {
    if (!groupId) {
      return;
    }
    setLaneNotificationMode(readLaneNotificationMode(groupId));
    setLaneSettingsOpen(false);
  }, [groupId]);

  useEffect(() => {
    setMembersPanelOpen(false);
    setHeaderMenuOpen(false);
    setLaneSettingsOpen(false);
  }, [tab]);

  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (headerActionsRef.current?.contains(target)) {
        return;
      }
      if (laneSettingsRef.current?.contains(target)) {
        return;
      }
      setMembersPanelOpen(false);
      setHeaderMenuOpen(false);
      setLaneSettingsOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
    };
  }, []);

  async function switchTab(next: GroupTab) {
    setTab(next);
    if (!groupId || !token) {
      return;
    }
    try {
      await loadFeed(groupId, token, next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "피드를 불러오지 못했습니다.",
      );
    }
  }

  async function handleSubmitPost(event: React.FormEvent) {
    event.preventDefault();
    if (submitPostInFlightRef.current || submitting) {
      return;
    }
    if (!groupId || !token || !compose.trim()) {
      return;
    }

    const submitTab = tab;
    if (submitTab === "notice") {
      return;
    }

    const trimmed = compose.trim();
    const category = submitTab === "etiquette" ? "etiquette" : "chat";

    submitPostInFlightRef.current = true;
    setSubmitting(true);
    try {
      const created = await createGroupPost(
        groupId,
        {
          category,
          content: trimmed,
          is_anonymous: submitTab === "etiquette",
        },
        token,
      );

      setCompose("");
      setPosts((prev) => {
        if (tab !== submitTab) {
          return prev;
        }
        if (!isPostVisibleInTab(created.category, submitTab)) {
          return prev;
        }
        return [created, ...prev];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "글 등록에 실패했습니다.");
    } finally {
      submitPostInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  function handleInviteShare() {
    if (!groupId || typeof window === "undefined") {
      return;
    }
    setInviteModalUrl(buildGroupInviteUrl(window.location.origin, groupId));
    setInviteModalOpen(true);
  }

  async function handleRefreshFeed() {
    if (!groupId || !token) {
      return;
    }
    try {
      await loadFeed(groupId, token, tab);
      setHeaderMenuOpen(false);
      setGroupToast({ type: "ok", title: "피드를 새로고침했어요." });
      window.setTimeout(() => setGroupToast(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "피드를 불러오지 못했습니다.",
      );
    }
  }

  async function handleCopyCurrentTabLink() {
    if (typeof window === "undefined") {
      return;
    }
    const url = `${window.location.origin}/group?groupId=${groupId ?? ""}&tab=${tab}`;
    await navigator.clipboard?.writeText(url);
    setHeaderMenuOpen(false);
    setGroupToast({ type: "ok", title: "현재 탭 링크를 복사했어요." });
    window.setTimeout(() => setGroupToast(null), 3000);
  }

  async function handleCopyInviteLink() {
    if (!groupId || typeof window === "undefined") {
      return;
    }
    const url = buildGroupInviteUrl(window.location.origin, groupId);
    await navigator.clipboard?.writeText(url);
    setHeaderMenuOpen(false);
    setGroupToast({ type: "ok", title: "초대 링크를 복사했어요." });
    window.setTimeout(() => setGroupToast(null), 3000);
  }

  function handleSelectLaneNotificationMode(mode: LaneNotificationMode) {
    if (!groupId) {
      return;
    }
    setLaneNotificationMode(mode);
    writeLaneNotificationMode(groupId, mode);
    setLaneSettingsOpen(false);
    const selected = LANE_NOTIFICATION_OPTIONS.find((o) => o.mode === mode);
    setGroupToast({
      type: "ok",
      title: `알림 설정을 '${selected?.label ?? "전체 알림"}'으로 변경했어요.`,
    });
    window.setTimeout(() => setGroupToast(null), 2500);
  }

  async function handleCopyLaneInviteLink() {
    if (!groupId || typeof window === "undefined") {
      return;
    }
    const url = buildGroupInviteUrl(window.location.origin, groupId);
    await navigator.clipboard?.writeText(url);
    setLaneSettingsOpen(false);
    setGroupToast({ type: "ok", title: "초대 링크를 복사했어요." });
    window.setTimeout(() => setGroupToast(null), 3000);
  }

  function handleJoinByCode() {
    const parsed = parseGroupIdFromInviteInput(joinCode);
    if (!parsed) {
      setJoinCodeMessage("올바른 반 코드 또는 초대 링크를 입력해 주세요.");
      return;
    }
    if (!token) {
      router.replace(
        `/login?next=${encodeURIComponent(`/group?groupId=${parsed}&invite=1`)}`,
      );
      return;
    }
    setJoinCodeMessage(null);
    const existing = memberships.find((g) => g.group_id === parsed);
    if (existing) {
      router.push(`/group?groupId=${parsed}`);
      setGroupToast({
        type: "ok",
        title: "이미 이 반에 소속되어 있어요.",
        sub: formatGroupTitleLine(existing),
      });
      window.setTimeout(() => setGroupToast(null), 5000);
      return;
    }
    setJoinConfirmGroupId(parsed);
  }

  function handleCancelJoinConfirm() {
    setJoinConfirmGroupId(null);
    setJoinConfirmError(null);
    if (inviteFromLink && requestedGroupId) {
      router.replace(`/group?groupId=${requestedGroupId}`, { scroll: false });
    }
  }

  async function handleConfirmJoin() {
    if (!joinConfirmGroupId || !token) {
      return;
    }
    const targetId = joinConfirmGroupId;
    setJoinConfirmJoining(true);
    setJoinConfirmError(null);
    try {
      const result = await joinGroup(targetId, token);
      const sub = joinConfirmPreview
        ? formatGroupTitleLine(joinConfirmPreview)
        : undefined;
      saveGroupJoinToast({
        type: "ok",
        title: result.message,
        sub,
      });
      setJoinConfirmGroupId(null);
      router.replace(`/group?groupId=${targetId}&joined=1`, { scroll: false });
      await load();
    } catch (err) {
      setJoinConfirmError(
        err instanceof Error ? err.message : "레인방 입장에 실패했습니다.",
      );
    } finally {
      setJoinConfirmJoining(false);
    }
  }

  const joinConfirmOpen = joinConfirmGroupId !== null;

  function renderGroupOverlays() {
    return (
      <>
        <GroupInviteModal
          open={inviteModalOpen}
          inviteUrl={inviteModalUrl}
          onClose={() => setInviteModalOpen(false)}
        />
        <GroupJoinConfirmModal
          open={joinConfirmOpen}
          preview={joinConfirmPreview}
          loading={joinConfirmPreviewLoading}
          joining={joinConfirmJoining}
          error={joinConfirmError}
          onConfirm={() => void handleConfirmJoin()}
          onCancel={handleCancelJoinConfirm}
        />
        <GroupActionToast toast={groupToast} />
      </>
    );
  }

  function togglePostLike(postId: string) {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }

  async function handleRsvp(
    schedule: GroupSchedule,
    response: "attending" | "maybe" | "declined",
  ) {
    if (!groupId || !token) {
      return;
    }
    try {
      const updated = await submitScheduleRsvp(
        groupId,
        schedule.schedule_id,
        response,
        token,
      );
      setSchedules((prev) =>
        prev.map((s) => (s.schedule_id === updated.schedule_id ? updated : s)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "RSVP 처리에 실패했습니다.",
      );
    }
  }

  if (!loading && memberships.length === 0) {
    return (
      <>
        <SiteGnb activeNav="group" />
        <div className="group-none-screen">
          <div className="page">
            <div>
              <div className="empty-card">
                <div className="empty-illust">
                  <span className="ms" aria-hidden="true">
                    pool
                  </span>
                </div>
                <div className="empty-title">아직 소속 반이 없어요</div>
                <div className="empty-desc">
                  WeSwim은 <b>강습반 소통방(레인방)</b>을 중심으로 운영돼요.
                  <br />
                  반을 찾아 입장하면 같은 반 수영 친구들과
                  <br />
                  기록을 공유하고 함께 성장할 수 있어요!
                </div>
                <div className="cta-row">
                  <Link href="/group/find" className="cta-btn">
                    <span className="ms" aria-hidden="true">
                      search
                    </span>
                    반 찾기
                  </Link>
                  <Link href="/" className="sub-btn">
                    <span className="ms" aria-hidden="true">
                      home
                    </span>
                    홈 둘러보기
                  </Link>
                </div>
                <div className="waiting-box">
                  <div className="waiting-ico">
                    <span className="ms" aria-hidden="true">
                      front_hand
                    </span>
                  </div>
                  <div>
                    <div className="waiting-title">
                      우리 수영장 반이 없나요? — 오리발 대기방
                    </div>
                    <div className="waiting-desc">
                      아직 반이 개설되지 않은 수영장도 괜찮아요.
                      <br />반 찾기에서 조건을 선택하면 <b>오리발 대기방</b>이
                      만들어지고,
                      <br />
                      같은 조건의 멤버가 2명 이상 모이면 자동으로 활성화됩니다!
                    </div>
                  </div>
                </div>
                <div className="steps">
                  <div className="step-item">
                    <div className="step-num">1</div>
                    <div className="step-label">반 찾기</div>
                    <div className="step-sub">
                      지역 · 수영장 · 시간대 · 레인등급 선택
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-num">2</div>
                    <div className="step-label">레인방 입장</div>
                    <div className="step-sub">
                      같은 반 멤버와 소통방 자동 개설
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-num">3</div>
                    <div className="step-label">기록 공유</div>
                    <div className="step-sub">
                      수영 기록을 레인방에 자동 공유
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <aside className="sidebar">
              <div className="sidebar-widget">
                <div className="widget-title">
                  <span className="ms" aria-hidden="true">
                    link
                  </span>
                  반 코드로 입장
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--gray-500)",
                    lineHeight: 1.6,
                    marginBottom: 14,
                  }}
                >
                  같은 반 친구에게 초대 코드를 받았다면 바로 입장할 수 있어요.
                </p>
                <div className="code-row">
                  <input
                    type="text"
                    className="code-input"
                    placeholder="반 코드 또는 초대 링크"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    aria-label="반 코드"
                  />
                  <button
                    type="button"
                    className="code-btn"
                    onClick={handleJoinByCode}
                  >
                    입장
                  </button>
                </div>
                {joinCodeMessage ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--gray-500)",
                      marginTop: 8,
                    }}
                  >
                    {joinCodeMessage}
                  </p>
                ) : null}
              </div>
              <div className="sidebar-widget">
                <div className="widget-title">
                  <span className="ms" aria-hidden="true">
                    local_fire_department
                  </span>
                  지금 뜨는 글
                </div>
                <Link href="/" className="hot-post">
                  <div className="hot-post-title">
                    자유형 호흡 때 물 마시는 분들 — 이거 해보세요
                  </div>
                  <div className="hot-post-meta">
                    <span className="ms" aria-hidden="true">
                      favorite
                    </span>
                    47
                    <span className="ms" aria-hidden="true">
                      mode_comment
                    </span>
                    23
                  </div>
                </Link>
                <Link href="/" className="hot-post">
                  <div className="hot-post-title">
                    마스터즈 대회 첫 출전 무엇을 준비해야 할까요?
                  </div>
                  <div className="hot-post-meta">
                    <span className="ms" aria-hidden="true">
                      favorite
                    </span>
                    22
                    <span className="ms" aria-hidden="true">
                      mode_comment
                    </span>
                    14
                  </div>
                </Link>
                <Link href="/" className="hot-post">
                  <div className="hot-post-title">
                    잠실 새벽 6~8시 성인 개인레슨 모집 (초급~중급)
                  </div>
                  <div className="hot-post-meta">
                    <span className="ms" aria-hidden="true">
                      favorite
                    </span>
                    18
                    <span className="ms" aria-hidden="true">
                      mode_comment
                    </span>
                    7
                  </div>
                </Link>
              </div>
              <Link href="/group/find" className="sidebar-cta">
                <span className="ms" aria-hidden="true">
                  search
                </span>
                반 찾기 시작하기
              </Link>
            </aside>
          </div>
        </div>
        {renderGroupOverlays()}
      </>
    );
  }

  const activeTabMeta = CHANNELS.find((t) => t.id === tab) ?? CHANNELS[0];
  const normalizedSearch = feedSearchQuery.trim().toLowerCase();

  const visiblePosts = !normalizedSearch
    ? posts
    : posts.filter((post) => {
        const haystacks = [
          post.title ?? "",
          post.content,
          displayName(post),
          ...(post.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystacks.includes(normalizedSearch);
      });

  const visibleSchedules = !normalizedSearch
    ? schedules
    : schedules.filter((schedule) => {
        const haystacks = [
          schedule.title ?? "",
          schedule.location ?? "",
          schedule.status,
          schedule.author_nickname ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystacks.includes(normalizedSearch);
      });

  return (
    <>
      <SiteGnb activeNav="group" />
      {loading && (
        <div className="ws-page">
          <p style={{ color: "var(--gray-500)" }}>불러오는 중…</p>
        </div>
      )}
      {error && (
        <div className="ws-page">
          <div className="alert-error">{error}</div>
        </div>
      )}

      {group && !loading && (
        <div
          className="group-screen"
          data-tab={tab}
          data-state={isWaitingGroup ? "waiting" : "active"}
        >
          <div className="page">
            <aside className="sb">
              <div className={`lane-card${isWaitingGroup ? " waiting" : ""}`}>
                <div className="lane-eb">
                  <GroupKindBadge status={group.status} />
                </div>
                <div className="lane-name">{formatGroupTitleLine(group)}</div>
                <div className="lane-info">
                  <b>{formatGroupSchedule(group.schedule)}</b>
                </div>
                <div className="lane-stats">
                  <span className="members">
                    <span className="ms" aria-hidden="true">
                      groups
                    </span>
                    <b>{group.member_count}명</b>
                    {group.status === "active" ? (
                      <>
                        {" "}
                        · <span className="lane-stat-active">활동중</span>
                      </>
                    ) : null}
                    {isWaitingGroup ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="lane-stat-waiting">
                          멤버 2명+ 활성화
                        </span>
                      </>
                    ) : null}
                  </span>
                  <div className="lane-settings-wrap" ref={laneSettingsRef}>
                    <button
                      type="button"
                      className={`lane-settings${laneSettingsOpen ? " on" : ""}`}
                      title="설정"
                      onClick={() => {
                        setLaneSettingsOpen((prev) => !prev);
                        setMembersPanelOpen(false);
                        setHeaderMenuOpen(false);
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        tune
                      </span>
                    </button>
                    {laneSettingsOpen ? (
                      <div className="lane-settings-popover">
                        <div className="lane-settings-title">알림 설정</div>
                        <div className="lane-settings-options">
                          {LANE_NOTIFICATION_OPTIONS.map((option) => (
                            <button
                              key={option.mode}
                              type="button"
                              className={`lane-setting-item${laneNotificationMode === option.mode ? " on" : ""}`}
                              onClick={() =>
                                handleSelectLaneNotificationMode(option.mode)
                              }
                            >
                              <span className="lane-setting-text">
                                <b>{option.label}</b>
                                <small>{option.desc}</small>
                              </span>
                              {laneNotificationMode === option.mode ? (
                                <span className="ms" aria-hidden="true">
                                  check
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                        <div className="lane-settings-divider" />
                        <button
                          type="button"
                          className="lane-setting-item"
                          onClick={() => void handleCopyLaneInviteLink()}
                        >
                          <span className="lane-setting-text">
                            <b>초대 링크 복사</b>
                            <small>현재 반 초대 URL 클립보드 복사</small>
                          </span>
                          <span className="ms" aria-hidden="true">
                            content_copy
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="sb-block">
                <div className="sb-block-title">채널 · 고정 3개</div>
                {MOB_TABS.map((tabId) => {
                  const ch = CHANNELS.find((c) => c.id === tabId)!;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      className={`ch${tab === ch.id ? " on" : ""}`}
                      onClick={() => void switchTab(ch.id)}
                    >
                      <span className="ch-ico">
                        <span className="ms" aria-hidden="true">
                          {ch.icon}
                        </span>
                      </span>
                      <div className="ch-info">
                        <div className="ch-name">
                          {ch.label}
                          {ch.id === "chat" ? (
                            <span className="ch-time">방금</span>
                          ) : ch.id === "notice" ? (
                            <span className="ch-time">2h</span>
                          ) : (
                            <span className="ch-time">3일</span>
                          )}
                        </div>
                        <div className="ch-preview">
                          {ch.id === "chat"
                            ? "오 대박 1500m!! 저는 다리 쥐났어요…"
                            : ch.id === "notice"
                              ? "5월 회식 — 5/30 (금) 수업 후"
                              : "앞사람 바짝 따라오지 마세요..."}
                        </div>
                      </div>
                      {channelUnread[ch.id] > 0 ? (
                        <span className="unread">
                          {formatUnread(channelUnread[ch.id])}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="sb-block">
                <div className="sb-block-title">내 반 · 대기방</div>
                <div className="lane-compact-list">
                  {sortedMemberships.map((m) => (
                    <GroupLaneCompactLink
                      key={m.group_id}
                      group={m}
                      href={`/group?groupId=${m.group_id}&tab=${tab}`}
                      active={m.group_id === group.group_id}
                    />
                  ))}
                </div>
                <div className="other-classes">
                  <Link href="/group/find">
                    <span className="ms" aria-hidden="true">
                      add
                    </span>
                    반 추가하기 (최대 10개)
                  </Link>
                </div>
              </div>
            </aside>

            <section className="feed">
              <div
                className={`ch-head${activeTabMeta.headClass ? ` ${activeTabMeta.headClass}` : ""}`}
              >
                <div className="ch-h-ico">
                  <span className="ms" aria-hidden="true">
                    {activeTabMeta.icon}
                  </span>
                </div>
                <div>
                  <h1>{activeTabMeta.label}</h1>
                  <p className="ch-h-sub">{activeTabMeta.sub}</p>
                </div>
                <div className="ch-h-actions" ref={headerActionsRef}>
                  <button
                    type="button"
                    className="ch-h-btn"
                    title="멤버"
                    onClick={() => {
                      setMembersPanelOpen((prev) => !prev);
                      setHeaderMenuOpen(false);
                      setLaneSettingsOpen(false);
                    }}
                  >
                    <span className="ms" aria-hidden="true">
                      groups
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ch-h-btn${searchOpen ? " on" : ""}`}
                    title="검색"
                    onClick={() => {
                      setSearchOpen((prev) => {
                        const next = !prev;
                        if (!next) {
                          setFeedSearchQuery("");
                        }
                        return next;
                      });
                      setMembersPanelOpen(false);
                      setHeaderMenuOpen(false);
                      setLaneSettingsOpen(false);
                    }}
                  >
                    <span className="ms" aria-hidden="true">
                      search
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ch-h-btn${headerMenuOpen ? " on" : ""}`}
                    title="더보기"
                    onClick={() => {
                      setHeaderMenuOpen((prev) => !prev);
                      setMembersPanelOpen(false);
                      setLaneSettingsOpen(false);
                    }}
                  >
                    <span className="ms" aria-hidden="true">
                      more_horiz
                    </span>
                  </button>

                  {membersPanelOpen ? (
                    <div className="ch-popover members-popover">
                      <div className="ch-popover-title">
                        멤버 {members.length}명
                      </div>
                      <div className="ch-popover-list">
                        {members.map((m) => (
                          <div key={m.user_id} className="ch-member-row">
                            <div
                              className={`av av-sm ${avatarVariant(m.user_id)}${currentUserId === m.user_id ? " me" : ""}`}
                            >
                              {avatarInitial(m.nickname)}
                            </div>
                            <div className="ch-member-name">
                              {m.nickname}
                              {currentUserId === m.user_id ? (
                                <span className="ph-me-tag">· 나</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {headerMenuOpen ? (
                    <div className="ch-popover menu-popover">
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => void handleRefreshFeed()}
                      >
                        <span className="ms" aria-hidden="true">
                          refresh
                        </span>
                        새로고침
                      </button>
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => void handleCopyCurrentTabLink()}
                      >
                        <span className="ms" aria-hidden="true">
                          link
                        </span>
                        현재 탭 링크 복사
                      </button>
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => void handleCopyInviteLink()}
                      >
                        <span className="ms" aria-hidden="true">
                          share
                        </span>
                        초대 링크 복사
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {searchOpen ? (
                <div className="feed-search-wrap">
                  <div className="feed-search-input">
                    <span className="ms" aria-hidden="true">
                      search
                    </span>
                    <input
                      value={feedSearchQuery}
                      onChange={(e) => setFeedSearchQuery(e.target.value)}
                      placeholder="제목, 내용, 작성자 검색"
                    />
                    {feedSearchQuery ? (
                      <button
                        type="button"
                        className="search-clear"
                        onClick={() => setFeedSearchQuery("")}
                        aria-label="검색어 지우기"
                      >
                        <span className="ms" aria-hidden="true">
                          close
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isWaitingGroup ? (
                <div className="waiting-banner">
                  <div className="wb-ico">
                    <span className="ms" aria-hidden="true">
                      groups_2
                    </span>
                  </div>
                  <div className="wb-info">
                    <div className="wb-t">현재 혼자예요!</div>
                    <div className="wb-s">
                      친구에게 공유하면 멤버 2명부터 자동으로 활성화돼요. 오리발
                      대기방 상태에선 잡담만 가능해요.
                    </div>
                  </div>
                  <button type="button" onClick={handleInviteShare}>
                    <span className="ms" aria-hidden="true">
                      share
                    </span>
                    친구 초대
                  </button>
                </div>
              ) : null}

              <div className="mob-tabs">
                {MOB_TABS.map((tabId) => {
                  const t = CHANNELS.find((c) => c.id === tabId)!;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`mob-tab${tab === t.id ? " on" : ""}`}
                      onClick={() => void switchTab(t.id)}
                    >
                      <span className="ms" aria-hidden="true">
                        {t.icon}
                      </span>
                      {t.mobLabel}
                    </button>
                  );
                })}
              </div>

              <div className="feed-body">
                {tab === "notice" &&
                  visibleSchedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule.schedule_id}
                      groupId={group.group_id}
                      schedule={schedule}
                      onRsvp={(r) => void handleRsvp(schedule, r)}
                    />
                  ))}

                {visiblePosts.length === 0 &&
                visibleSchedules.length === 0 &&
                tab === "notice" ? (
                  <div style={{ padding: 24 }}>
                    <p
                      style={{
                        color: "var(--gray-500)",
                        fontSize: 14,
                      }}
                    >
                      아직 공지·벙개가 없어요.
                    </p>
                    <Link
                      href={`/group/schedule/new?groupId=${group.group_id}`}
                      className="e-cta"
                    >
                      일정 만들기
                      <span className="ms" aria-hidden="true">
                        add
                      </span>
                    </Link>
                  </div>
                ) : null}

                {visiblePosts.map((post) => (
                  <article className="post" key={post.post_id}>
                    <div className="post-head">
                      <div
                        className={`av ${avatarVariant(post.user_id)}${
                          post.category === "record_share" ? " kickpani" : ""
                        }`}
                      >
                        {post.category === "record_share"
                          ? "킥"
                          : avatarInitial(displayName(post))}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {displayName(post)}
                          {currentUserId === post.user_id ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--aqua)",
                                marginLeft: 6,
                              }}
                            >
                              나
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gray-500)" }}>
                          {formatRelativeTime(post.created_at)}
                          {post.category === "record_share"
                            ? " · 킥파니가 전해드려요"
                            : ""}
                        </div>
                      </div>
                    </div>
                    {post.title ? (
                      <div className="nc-title" style={{ marginBottom: 6 }}>
                        {post.title}
                      </div>
                    ) : null}
                    <p className="post-body">{post.content}</p>
                    <div className="post-actions">
                      <button
                        type="button"
                        className={`pa-btn like-btn${likedPosts.has(post.post_id) ? " on" : ""}`}
                        onClick={() => togglePostLike(post.post_id)}
                      >
                        <span className="ms" aria-hidden="true">
                          favorite
                        </span>
                        {post.reaction_count}
                      </button>
                      <Link
                        href={`/community/${post.post_id}`}
                        className="pa-btn"
                      >
                        <span className="ms" aria-hidden="true">
                          mode_comment
                        </span>
                        {post.category === "notice" ? "상세 보기" : "답글"}
                      </Link>
                      <button
                        type="button"
                        className="pa-btn"
                        onClick={() => {
                          const url = `${window.location.origin}/community/${post.post_id}`;
                          void navigator.clipboard?.writeText(url);
                        }}
                      >
                        <span className="ms" aria-hidden="true">
                          share
                        </span>
                        공유
                      </button>
                    </div>
                  </article>
                ))}

                {visiblePosts.length === 0 && tab !== "notice" ? (
                  <p
                    style={{
                      padding: 24,
                      color: "var(--gray-500)",
                      fontSize: 14,
                    }}
                  >
                    {feedSearchQuery
                      ? "검색 결과가 없어요."
                      : "첫 글을 남겨보세요."}
                  </p>
                ) : null}
              </div>

              {tab === "notice" ? null : (
                <form
                  className="composer"
                  onSubmit={(e) => void handleSubmitPost(e)}
                >
                  <div className="comp-row">
                    <div className="av-me">{avatarInitial(userNickname)}</div>
                    <div className="comp-input">
                      <textarea
                        value={compose}
                        onChange={(e) => setCompose(e.target.value)}
                        placeholder={
                          tab === "etiquette"
                            ? "레인 매너에 대해 부탁/건의를 남겨주세요..."
                            : `${group.venue_name ?? "우리 반"}에 메시지를 남겨보세요...`
                        }
                        maxLength={5000}
                        rows={1}
                      />
                      <div className="comp-bottom">
                        {tab !== "etiquette" ? (
                          <>
                            <button type="button" className="comp-attach">
                              <span className="ms" aria-hidden="true">
                                image
                              </span>
                              사진
                            </button>
                            <button type="button" className="comp-attach">
                              <span className="ms" aria-hidden="true">
                                edit_note
                              </span>
                              기록 첨부
                            </button>
                            <button
                              type="button"
                              className="comp-attach"
                              aria-label="이모지"
                            >
                              <span className="ms" aria-hidden="true">
                                mood
                              </span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="comp-attach">
                              <span className="ms" aria-hidden="true">
                                image
                              </span>
                              사진
                            </button>
                            <label className="anon-toggle">
                              <input type="checkbox" defaultChecked readOnly />
                              <span
                                className="ms"
                                style={{
                                  fontSize: 14,
                                  color: "var(--gray-500)",
                                }}
                                aria-hidden="true"
                              >
                                visibility_off
                              </span>
                              익명으로
                            </label>
                          </>
                        )}
                        <button
                          type="submit"
                          className="comp-send"
                          disabled={submitting || !compose.trim()}
                        >
                          <span className="ms" aria-hidden="true">
                            send
                          </span>
                          {submitting
                            ? "등록 중…"
                            : tab === "etiquette"
                              ? "등록"
                              : "보내기"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </section>

            <aside className="sb-r">
              <div className="widget event-widget">
                <div className="w-title">
                  <span className="ms" aria-hidden="true">
                    event
                  </span>
                  다음 일정
                </div>
                {nextSchedule ? (
                  <>
                    <div
                      className={`ew-type ${nextSchedule.type === "vote" ? "vote" : "notice"}`}
                    >
                      <span className="ms" aria-hidden="true">
                        {nextSchedule.type === "vote"
                          ? "how_to_vote"
                          : "campaign"}
                      </span>
                      {nextSchedule.type === "vote"
                        ? "투표 진행 중"
                        : "일정 공지"}
                    </div>
                    <div className="nc-title">{nextSchedule.title}</div>
                    {nextSchedule.type === "vote" &&
                    nextSchedule.vote_options.length > 0 ? (
                      <div className="ew-vote-mini">
                        {nextSchedule.vote_options.slice(0, 2).map((opt) => {
                          const max = Math.max(
                            1,
                            ...nextSchedule.vote_options.map(
                              (o) => o.vote_count,
                            ),
                          );
                          return (
                            <div key={opt.option_id} className="evm-row">
                              <span className="evm-label">{opt.label}</span>
                              <div className="evm-bar">
                                <div
                                  className="evm-fill"
                                  style={{
                                    width: `${(opt.vote_count / max) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="evm-cnt">{opt.vote_count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="nc-meta">
                        {nextSchedule.status}
                        {nextSchedule.scheduled_at
                          ? ` · ${formatWhen(nextSchedule.scheduled_at)}`
                          : ""}
                      </p>
                    )}
                    <div className="event-cta-row">
                      <Link
                        href={`/group/schedule/${nextSchedule.schedule_id}?groupId=${group.group_id}`}
                        className="e-cta"
                      >
                        {nextSchedule.type === "vote"
                          ? "투표 참여하기"
                          : "상세 보기"}
                        <span className="ms" aria-hidden="true">
                          arrow_forward
                        </span>
                      </Link>
                      <Link
                        href={`/group/schedule/new?groupId=${group.group_id}`}
                        className="e-cta"
                      >
                        다음 일정 등록
                        <span className="ms" aria-hidden="true">
                          add
                        </span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="event-empty">
                    <span className="ms" aria-hidden="true">
                      event_busy
                    </span>
                    <div>예정된 일정이 없어요</div>
                    {groupId ? (
                      <Link
                        href={`/group/schedule/new?groupId=${groupId}`}
                        className="e-cta"
                      >
                        일정 만들기
                        <span className="ms" aria-hidden="true">
                          add
                        </span>
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="widget">
                <div className="w-title">
                  <span className="ms" aria-hidden="true">
                    groups
                  </span>
                  멤버
                  <span className="ct">{members.length}명</span>
                </div>
                <div className="members-list">
                  {members.slice(0, 8).map((m) => (
                    <div key={m.user_id} className="m-row">
                      <div
                        className={`av av-sm ${avatarVariant(m.user_id)}${currentUserId === m.user_id ? " me" : ""}`}
                      >
                        {avatarInitial(m.nickname)}
                      </div>
                      <div className="m-info">
                        <div className="m-name">
                          {m.nickname}
                          {currentUserId === m.user_id ? (
                            <span className="ph-me-tag">· 나</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
      {renderGroupOverlays()}
    </>
  );
}

function ScheduleCard({
  groupId,
  schedule,
  onRsvp,
}: {
  groupId: string;
  schedule: GroupSchedule;
  onRsvp: (r: "attending" | "maybe" | "declined") => void;
}) {
  const router = useRouter();
  const href = `/group/schedule/${schedule.schedule_id}?groupId=${groupId}`;
  const counts = schedule.rsvp_counts;
  const maxVotes = Math.max(
    1,
    ...schedule.vote_options.map((o) => o.vote_count),
  );

  return (
    <article
      className={`notice-card${schedule.type === "vote" ? " vote-card" : ""}`}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          router.push(href);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="nc-meta">
        {schedule.type === "vote" ? "일정 투표" : "벙개·RSVP"} ·{" "}
        {schedule.status}
      </div>
      <div className="nc-title">{schedule.title}</div>
      {schedule.location ? (
        <p style={{ fontSize: 13, color: "var(--gray-700)", marginTop: 4 }}>
          {schedule.location}
        </p>
      ) : null}

      {schedule.type === "vote" && schedule.vote_options.length > 0 ? (
        <div className="vote-mini-opts" onClick={(e) => e.stopPropagation()}>
          {schedule.vote_options.map((opt) => (
            <div key={opt.option_id} className="vmo-row">
              <div className="vmo-bar-wrap">
                <div
                  className="vmo-fill"
                  style={{ width: `${(opt.vote_count / maxVotes) * 100}%` }}
                />
                <span className="vmo-text">{opt.label}</span>
              </div>
              <span className="vmo-cnt">{opt.vote_count}</span>
            </div>
          ))}
          <div className="vote-btn-row">
            <button
              type="button"
              className="btn-vote-sm"
              onClick={() => router.push(href)}
            >
              <span className="ms" aria-hidden="true">
                how_to_vote
              </span>
              투표 참여
            </button>
            <button
              type="button"
              className="btn-confirm-sm"
              onClick={() => router.push(href)}
            >
              <span className="ms" aria-hidden="true">
                workspace_premium
              </span>
              확정하기
            </button>
          </div>
        </div>
      ) : null}

      {schedule.type === "rsvp" && counts && schedule.status === "open" ? (
        <div className="rsvp" onClick={(e) => e.stopPropagation()}>
          {(
            [
              ["attending", "참석", counts.attending],
              ["maybe", "미정", counts.maybe],
              ["declined", "불참", counts.declined],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={schedule.my_rsvp === key ? "on" : ""}
              onClick={() => onRsvp(key)}
            >
              {label} · {count}
            </button>
          ))}
        </div>
      ) : null}

      <div className="nc-meta">
        {schedule.author_nickname ?? "회원"} ·{" "}
        {formatRelativeTime(schedule.created_at)}
      </div>
    </article>
  );
}
