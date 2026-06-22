const GROUP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 반 코드 입력 또는 초대 URL에서 group_id 추출 */
export function parseGroupIdFromInviteInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (GROUP_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const queryIndex = trimmed.indexOf("?");
  if (queryIndex !== -1) {
    const fromQuery = new URLSearchParams(trimmed.slice(queryIndex + 1)).get(
      "groupId",
    );
    if (fromQuery && GROUP_ID_RE.test(fromQuery)) {
      return fromQuery;
    }
  }

  try {
    const fromUrl = new URL(trimmed).searchParams.get("groupId");
    if (fromUrl && GROUP_ID_RE.test(fromUrl)) {
      return fromUrl;
    }
  } catch {
    /* not an absolute URL */
  }
  return null;
}

export function buildGroupInviteUrl(origin: string, groupId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/group?groupId=${encodeURIComponent(groupId)}&invite=1`;
}

function copyTextFallback(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
}

export async function copyInviteLink(inviteUrl: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      return true;
    } catch {
      /* fall through */
    }
  }
  return copyTextFallback(inviteUrl);
}

/** 모달 내 「앱으로 공유」 — Web Share API만 사용 */
export async function shareInviteNative(
  inviteUrl: string,
): Promise<"shared" | "cancelled" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return "unsupported";
  }
  const shareData: ShareData = {
    title: "WeSwim",
    text: "WeSwim 레인방 초대",
    url: inviteUrl,
  };
  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare(shareData)
  ) {
    return "unsupported";
  }
  try {
    await navigator.share(shareData);
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
}
