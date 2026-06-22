"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GroupKindBadge } from "@/components/group-kind-badge";
import { SiteGnb } from "@/components/layout/site-gnb";
import {
  deleteMyAccount,
  getMyGroups,
  getMyProfile,
  leaveGroup,
  updateMyProfile,
  type GroupMembership,
  type NotificationPrefs,
  type UserProfile,
} from "@/lib/api";
import {
  formatGroupMetaLine,
  formatGroupTitleLine,
  isRegisteredGroup,
  isWaitingGroup,
} from "@/lib/group-membership-display";
import { levelLabel } from "@/lib/format/level-label";
import { avatarInitial } from "@/lib/format/relative-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-group-membership.css";
import "@/styles/weswim-my-settings.css";

const BIO_STORAGE_KEY = "weswim_profile_bio";
const AVATAR_STORAGE_KEY = "weswim_profile_avatar_data_url";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const LEVEL_OPTIONS = [
  { value: "beginner_1", label: "입문" },
  { value: "beginner_2", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "상급" },
] as const;

const DEFAULT_PREFS: NotificationPrefs = {
  group_chat: true,
  comment: true,
  like: true,
  system: true,
};

export function MySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [level, setLevel] = useState("beginner_1");
  const [userType, setUserType] = useState<"member" | "instructor">("member");
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<GroupMembership | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/my/settings");
        return;
      }
      const token = session.access_token;
      const [me, myGroups] = await Promise.all([
        getMyProfile(token),
        getMyGroups(token),
      ]);
      setProfile(me);
      setGroups(myGroups);
      setNickname(me.nickname);
      setBio(
        me.bio ??
          (typeof window !== "undefined"
            ? (window.localStorage.getItem(BIO_STORAGE_KEY) ?? "")
            : ""),
      );
      setLevel(me.level ?? "beginner_1");
      setUserType(me.user_type === "instructor" ? "instructor" : "member");
      setPrefs({ ...DEFAULT_PREFS, ...(me.notification_prefs ?? {}) });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "설정을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    setAvatarDataUrl(saved || null);
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/my/settings");
        return;
      }
      const trimmedBio = bio.trim();
      window.localStorage.setItem(BIO_STORAGE_KEY, trimmedBio);
      const updated = await updateMyProfile(
        {
          nickname: nickname.trim(),
          level,
          user_type: userType,
          bio: trimmedBio,
          notification_prefs: prefs,
        },
        session.access_token,
      );
      setProfile(updated);
      setMessage("설정이 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function togglePref(key: keyof NotificationPrefs) {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError("JPG, PNG, WEBP, GIF 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("아바타 이미지는 3MB 이하만 업로드할 수 있어요.");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("이미지 변환에 실패했습니다."));
          }
        };
        reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
        reader.readAsDataURL(file);
      });

      setRawImageSrc(dataUrl);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropModalOpen(true);
      setError(null);
      setMessage(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.",
      );
    }
  }

  function handleRemoveAvatar() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY);
      window.dispatchEvent(new Event("weswim-avatar-updated"));
    }
    setAvatarDataUrl(null);
    setMessage("아바타 이미지를 제거했어요.");
    setError(null);
  }

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleExecuteCrop = () => {
    if (!rawImageSrc) return;

    const img = document.createElement("img");
    img.src = rawImageSrc;
    img.onload = () => {
      // First canvas (300x300) to render the exact container viewport
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, 300, 300);

      // Translate context to center of container
      ctx.translate(150, 150);
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Calculate container cover aspect fit
      const aspect = img.naturalWidth / img.naturalHeight;
      let renderW = 300;
      let renderH = 300;
      if (aspect > 1) {
        renderW = 300 * aspect;
      } else {
        renderH = 300 / aspect;
      }

      ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);

      // Second canvas (160x160) to crop the central region of diameter 160px
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = 160;
      finalCanvas.height = 160;
      const finalCtx = finalCanvas.getContext("2d");
      if (!finalCtx) return;

      // Center crop of 160x160 inside the 300x300 container starts at (70, 70)
      finalCtx.drawImage(canvas, 70, 70, 160, 160, 0, 0, 160, 160);

      try {
        const croppedDataUrl = finalCanvas.toDataURL("image/jpeg", 0.9);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(AVATAR_STORAGE_KEY, croppedDataUrl);
          window.dispatchEvent(new Event("weswim-avatar-updated"));
        }
        setAvatarDataUrl(croppedDataUrl);
        setCropModalOpen(false);
        setRawImageSrc(null);
        setMessage("아바타 이미지를 자르고 크기를 조정해 적용했어요.");
        setError(null);
      } catch {
        setError("이미지 자르기 처리에 실패했습니다.");
      }
    };
    img.onerror = () => {
      setError("이미지를 불러오는데 실패했습니다.");
    };
  };

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user?.email) {
        router.replace("/login?next=/my/settings");
        return;
      }

      const provider =
        (session.user.app_metadata?.provider as string | undefined) ?? "email";
      if (provider === "email") {
        if (!withdrawPassword) {
          setError("탈퇴를 위해 비밀번호를 입력해 주세요.");
          return;
        }
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: withdrawPassword,
        });
        if (reauthError) {
          setError("비밀번호가 올바르지 않습니다.");
          return;
        }
      } else if (provider === "google" || provider === "kakao") {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.href },
        });
        if (oauthError) {
          setError("소셜 재인증에 실패했습니다. 다시 시도해 주세요.");
        } else {
          setMessage("소셜 재인증 후 다시 탈퇴 버튼을 눌러 주세요.");
          setWithdrawOpen(false);
        }
        return;
      }

      const {
        data: { session: refreshedSession },
      } = await supabase.auth.getSession();
      if (!refreshedSession?.access_token) {
        setError("재인증 세션 확인에 실패했습니다.");
        return;
      }

      await deleteMyAccount(refreshedSession.access_token);
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "회원 탈퇴 처리에 실패했습니다.",
      );
    } finally {
      setWithdrawing(false);
      setWithdrawPassword("");
    }
  }

  async function confirmLeave() {
    if (!leaveTarget) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/my/settings");
        return;
      }
      await leaveGroup(leaveTarget.group_id, session.access_token);
      setGroups((current) =>
        current.filter((g) => g.group_id !== leaveTarget.group_id),
      );
      setLeaveTarget(null);
      setMessage("반에서 나갔습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "반 나가기에 실패했습니다.",
      );
    } finally {
      setLeaving(false);
    }
  }

  const sortedGroups = [
    ...groups.filter((g) => isRegisteredGroup(g.status)),
    ...groups.filter((g) => isWaitingGroup(g.status)),
    ...groups.filter(
      (g) => !isRegisteredGroup(g.status) && !isWaitingGroup(g.status),
    ),
  ];

  return (
    <>
      <SiteGnb activeNav="my" />
      <div className="my-settings-screen">
        <div className="page">
          <div className="page-header">
            <Link href="/my" className="back-btn">
              <span className="ms" aria-hidden="true">
                arrow_back
              </span>
              나의 레인
            </Link>
            <h1 className="page-title">설정</h1>
          </div>

          {loading && (
            <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
              불러오는 중…
            </p>
          )}
          {error && (
            <p style={{ color: "var(--error)", marginBottom: 12 }}>{error}</p>
          )}
          {message && <p className="settings-notice">{message}</p>}

          {profile && !loading && (
            <>
              <form onSubmit={(e) => void handleSave(e)}>
                <div className="settings-card">
                  <div className="settings-section-title">
                    <span className="ms" aria-hidden="true">
                      person
                    </span>
                    프로필 수정
                  </div>
                  <div className="profile-form">
                    <div className="form-row">
                      <label className="form-label">아바타 이미지</label>
                      <div className="avatar-editor-row">
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => void handleAvatarFileChange(e)}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          className="avatar-trigger"
                          onClick={() => avatarInputRef.current?.click()}
                          aria-label="아바타 이미지 변경"
                        >
                          <div
                            className="avatar-preview"
                            aria-label="현재 아바타 미리보기"
                          >
                            {avatarDataUrl ? (
                              <Image
                                src={avatarDataUrl}
                                alt="아바타"
                                width={64}
                                height={64}
                                unoptimized
                              />
                            ) : (
                              <span>
                                {avatarInitial(nickname || profile.nickname)}
                              </span>
                            )}
                            <div className="av-edit" aria-hidden="true">
                              <span className="ms">photo_camera</span>
                            </div>
                          </div>
                        </button>
                        {avatarDataUrl ? (
                          <button
                            type="button"
                            className="btn btn-ghost avatar-remove-btn"
                            onClick={handleRemoveAvatar}
                          >
                            이미지 제거
                          </button>
                        ) : null}
                      </div>
                      <div
                        className="settings-hint"
                        style={{ padding: "8px 0 0" }}
                      >
                        아바타를 눌러 변경 · JPG, PNG, WEBP, GIF · 최대 3MB
                      </div>
                    </div>
                    <div className="form-row">
                      <label className="form-label" htmlFor="settingsNickname">
                        닉네임
                      </label>
                      <input
                        id="settingsNickname"
                        className="form-input"
                        value={nickname}
                        minLength={2}
                        maxLength={20}
                        onChange={(e) => setNickname(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label className="form-label" htmlFor="settingsBio">
                        자기소개
                      </label>
                      <textarea
                        id="settingsBio"
                        className="form-textarea"
                        rows={3}
                        maxLength={100}
                        placeholder="수영에 대한 한 마디를 남겨보세요"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </div>
                    <div className="form-row">
                      <label className="form-label" htmlFor="settingsEmail">
                        이메일
                      </label>
                      <input
                        id="settingsEmail"
                        className="form-input"
                        value={profile.email}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="form-save">
                      <button
                        type="submit"
                        className="btn btn-aqua"
                        disabled={saving}
                        style={{ padding: "9px 20px", fontSize: 13 }}
                      >
                        <span
                          className="ms"
                          aria-hidden="true"
                          style={{ fontSize: 15 }}
                        >
                          check
                        </span>
                        {saving ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-section-title">
                    <span className="ms" aria-hidden="true">
                      military_tech
                    </span>
                    레인 등급
                  </div>
                  <div className="chip-group" style={{ paddingTop: 12 }}>
                    {LEVEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`chip${level === opt.value ? " on" : ""}`}
                        onClick={() => setLevel(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="settings-hint">현재: {levelLabel(level)}</p>
                </div>

                <div className="settings-card">
                  <div className="settings-section-title">
                    <span className="ms" aria-hidden="true">
                      notifications
                    </span>
                    알림 설정
                  </div>
                  {(
                    [
                      [
                        "group_chat",
                        "소통방 알림",
                        "새 글, 공지 알림",
                        "forum",
                        "",
                      ],
                      [
                        "comment",
                        "댓글 알림",
                        "내 글에 댓글이 달리면 알림",
                        "mode_comment",
                        "",
                      ],
                      [
                        "like",
                        "좋아요 알림",
                        "내 글에 좋아요가 달리면 알림",
                        "favorite",
                        "",
                      ],
                      [
                        "system",
                        "시스템 알림",
                        "서비스 공지, 점검 안내",
                        "campaign",
                        " gray",
                      ],
                    ] as const
                  ).map(([key, label, sub, icon, iconExtra]) => (
                    <div key={key} className="settings-row">
                      <div className={`row-icon${iconExtra}`}>
                        <span className="ms" aria-hidden="true">
                          {icon}
                        </span>
                      </div>
                      <div className="row-info">
                        <div className="row-label">{label}</div>
                        <div className="row-sub">{sub}</div>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={prefs[key] !== false}
                          onChange={() => togglePref(key)}
                        />
                        <div className="toggle-track" />
                        <div className="toggle-thumb" />
                      </label>
                    </div>
                  ))}
                </div>
              </form>

              <div className="settings-card">
                <div className="settings-section-title">
                  <span className="ms" aria-hidden="true">
                    groups
                  </span>
                  소속 관리
                </div>
                <div style={{ height: 12 }} />
                {sortedGroups.map((g) => (
                  <div
                    key={g.group_id}
                    className={`group-card${isWaitingGroup(g.status) ? " waiting" : ""}`}
                  >
                    <div className="group-av">
                      <span className="ms" aria-hidden="true">
                        {isWaitingGroup(g.status) ? "hourglass_top" : "pool"}
                      </span>
                    </div>
                    <div className="group-info">
                      <div className="group-name">
                        {formatGroupTitleLine(g)}
                        <GroupKindBadge status={g.status} />
                      </div>
                      <div className="group-sub">
                        {isWaitingGroup(g.status)
                          ? `${formatGroupMetaLine(g)} · 멤버 2명 이상 시 활성화`
                          : formatGroupMetaLine(g)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="leave-btn"
                      onClick={() => setLeaveTarget(g)}
                    >
                      <span className="ms" aria-hidden="true">
                        logout
                      </span>
                      나가기
                    </button>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="settings-hint" style={{ paddingTop: 0 }}>
                    소속된 반이 없습니다.
                  </p>
                )}
                <button
                  type="button"
                  className="add-group-btn"
                  onClick={() => router.push("/group/find")}
                >
                  <span className="ms" aria-hidden="true">
                    add
                  </span>
                  반 추가하기 (최대 10개)
                </button>
              </div>

              <div className="settings-card">
                <div className="settings-section-title">
                  <span className="ms" aria-hidden="true">
                    workspace_premium
                  </span>
                  회원 유형
                </div>
                <div className="settings-row">
                  <div className="row-icon">
                    <span className="ms" aria-hidden="true">
                      person
                    </span>
                  </div>
                  <div className="row-info">
                    <div className="row-label">일반 회원</div>
                    <div className="row-sub">
                      {userType === "member"
                        ? "현재 선택됨"
                        : "일반 회원으로 전환 가능"}
                    </div>
                  </div>
                  {userType === "member" ? (
                    <div className="row-value">
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: "var(--aqua-light)",
                          color: "var(--aqua-dark)",
                        }}
                      >
                        <span
                          className="ms"
                          aria-hidden="true"
                          style={{ fontSize: 12 }}
                        >
                          check
                        </span>
                        선택됨
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-aqua"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setUserType("member")}
                    >
                      선택
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="settings-row clickable"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                  }}
                  onClick={() => {
                    if (userType !== "instructor") {
                      setUserType("instructor");
                    }
                  }}
                >
                  <div className="row-icon coral">
                    <span className="ms" aria-hidden="true">
                      workspace_premium
                    </span>
                  </div>
                  <div className="row-info">
                    <div className="row-label">강사 회원으로 전환</div>
                    <div className="row-sub">
                      강사실 게시판 접근 권한이 부여됩니다
                    </div>
                  </div>
                  <div className="row-arrow">
                    <span className="ms" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </button>
              </div>

              <div className="settings-card">
                <div className="settings-section-title">
                  <span className="ms" aria-hidden="true">
                    manage_accounts
                  </span>
                  계정
                </div>
                <button
                  type="button"
                  className="danger-row"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                  }}
                  onClick={() => void handleLogout()}
                >
                  <div className="row-icon gray">
                    <span className="ms" aria-hidden="true">
                      logout
                    </span>
                  </div>
                  <div className="row-info">
                    <div
                      className="danger-label"
                      style={{ color: "var(--gray-700)" }}
                    >
                      로그아웃
                    </div>
                    <div className="danger-sub">
                      다음에 다시 로그인할 수 있어요
                    </div>
                  </div>
                  <div className="row-arrow">
                    <span className="ms" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className="danger-row"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                  }}
                  onClick={() => setWithdrawOpen(true)}
                >
                  <div className="row-icon error">
                    <span className="ms" aria-hidden="true">
                      delete_forever
                    </span>
                  </div>
                  <div className="row-info">
                    <div className="danger-label">회원 탈퇴</div>
                    <div className="danger-sub">
                      탈퇴 후 기록은 복구되지 않아요
                    </div>
                  </div>
                  <div className="row-arrow">
                    <span className="ms" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        <div
          className={`modal-bg${leaveTarget ? " open" : ""}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLeaveTarget(null);
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="leaveModalTitle"
          >
            <div className="modal-title" id="leaveModalTitle">
              반을 나갈까요?
            </div>
            <div className="modal-desc">
              {leaveTarget
                ? `${leaveTarget.venue_name ?? "수영장"} · ${levelLabel(leaveTarget.level)}에서 나가게 됩니다. 소통방 접근이 해제되지만 수영 기록은 그대로 유지됩니다.`
                : ""}
            </div>
            <div className="modal-btns">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ justifyContent: "center" }}
                onClick={() => setLeaveTarget(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: "var(--error)",
                  color: "#fff",
                  justifyContent: "center",
                }}
                disabled={leaving}
                onClick={() => void confirmLeave()}
              >
                {leaving ? "처리 중…" : "나가기"}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`modal-bg${withdrawOpen ? " open" : ""}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setWithdrawOpen(false);
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="withdrawModalTitle"
          >
            <div className="modal-title" id="withdrawModalTitle">
              정말 탈퇴하시겠어요?
            </div>
            <div className="modal-desc">탈퇴하면 모든 정보가 삭제됩니다.</div>
            <div className="modal-warn">
              <span className="ms" aria-hidden="true">
                warning
              </span>
              수영 기록, 게시글, 뱃지 등 모든 데이터가 영구 삭제되며 복구할 수
              없습니다.
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                className="form-input"
                type="password"
                placeholder="비밀번호 재입력 (소셜 계정은 비워두고 진행)"
                value={withdrawPassword}
                onChange={(e) => setWithdrawPassword(e.target.value)}
              />
            </div>
            <div className="modal-btns">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ justifyContent: "center" }}
                onClick={() => {
                  setWithdrawOpen(false);
                  setWithdrawPassword("");
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ justifyContent: "center" }}
                disabled={withdrawing}
                onClick={() => void handleWithdraw()}
              >
                <span className="ms" aria-hidden="true">
                  delete_forever
                </span>
                {withdrawing ? "처리 중…" : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>

        {cropModalOpen && rawImageSrc ? (
          <div className="modal-bg open" role="presentation">
            <div className="modal" style={{ width: "340px", padding: "20px" }}>
              <div
                className="modal-title"
                style={{ fontSize: "16px", marginBottom: "12px" }}
              >
                프로필 이미지 조정
              </div>
              <div
                className="modal-desc"
                style={{
                  fontSize: "12px",
                  marginBottom: "16px",
                  lineHeight: "1.5",
                }}
              >
                원하는 영역으로 드래그하고 아래 조절바로 크기를 선택하세요.
              </div>

              <div
                className="cropper-container"
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                style={{
                  width: "300px",
                  height: "300px",
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "12px",
                  background: "#121212",
                  cursor: isDragging ? "grabbing" : "grab",
                  userSelect: "none",
                  touchAction: "none",
                }}
              >
                <img
                  src={rawImageSrc}
                  alt="조정할 이미지"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: "center",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    pointerEvents: "none",
                    objectFit: "contain",
                  }}
                />

                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                >
                  <defs>
                    <mask id="circle-crop-mask">
                      <rect width="300" height="300" fill="white" />
                      <circle cx="150" cy="150" r="80" fill="black" />
                    </mask>
                  </defs>
                  <rect
                    width="300"
                    height="300"
                    fill="rgba(0,0,0,0.55)"
                    mask="url(#circle-crop-mask)"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="80"
                    fill="none"
                    stroke="var(--aqua)"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  className="ms"
                  style={{ fontSize: "16px", color: "var(--gray-500)" }}
                >
                  zoom_out
                </span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: "var(--aqua)",
                    cursor: "pointer",
                  }}
                />
                <span
                  className="ms"
                  style={{ fontSize: "16px", color: "var(--gray-500)" }}
                >
                  zoom_in
                </span>
              </div>

              <div className="modal-btns" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ justifyContent: "center" }}
                  onClick={() => {
                    setCropModalOpen(false);
                    setRawImageSrc(null);
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-aqua"
                  style={{ justifyContent: "center" }}
                  onClick={handleExecuteCrop}
                >
                  자르기 완료
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
