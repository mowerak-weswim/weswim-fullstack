import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const POST_IMAGES_BUCKET = "post-images";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") {
    return "jpg";
  }
  if (file.type === "image/png") {
    return "png";
  }
  if (file.type === "image/webp") {
    return "webp";
  }
  if (file.type === "image/gif") {
    return "gif";
  }
  return "jpg";
}

async function ensureStorageSession(session: Session): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    throw new Error(error.message || "인증 세션을 설정하지 못했습니다.");
  }
}

export async function uploadPostImages(
  files: File[],
  session: Session,
): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }
  if (files.length > MAX_FILES) {
    throw new Error(`이미지는 최대 ${MAX_FILES}장까지 첨부할 수 있습니다.`);
  }
  if (!session.user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  await ensureStorageSession(session);

  const supabase = getSupabaseBrowserClient();
  const userId = session.user.id;
  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error("JPG, PNG, WEBP, GIF 형식만 업로드할 수 있습니다.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`);
    }

    const path = `${userId}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error } = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(error.message || "이미지 업로드에 실패했습니다.");
    }

    const { data } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}
