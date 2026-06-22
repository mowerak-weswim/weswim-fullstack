import type { Database } from "@/types/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !key) {
      throw new Error(
        "Supabase env is missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    browserClient = createClient<Database>(url, key);
  }
  return browserClient;
}

export type UsersRow = Database["public"]["Tables"]["users"]["Row"];
export type UsersInsert = Database["public"]["Tables"]["users"]["Insert"];
