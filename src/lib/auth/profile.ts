import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type UsersInsert = Database["public"]["Tables"]["users"]["Insert"];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function upsertUserProfile(
  supabase: SupabaseClient<Database>,
  params: { userId: string; email: string; nickname: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  let lastError = "프로필 저장에 실패했습니다.";

  const payload: UsersInsert = {
    user_id: params.userId,
    email: params.email,
    nickname: params.nickname,
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const { error } = await supabase.from("users").upsert(payload, {
      onConflict: "user_id",
    });

    if (!error) {
      return { ok: true };
    }

    lastError = error.message;

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  return {
    ok: false,
    message: `${lastError} (${MAX_RETRIES}회 재시도 후 실패. 로그인 후 다시 시도해 주세요.)`,
  };
}
