import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import type { ProviderId } from "./types";

/** Decrypt the stored key for a provider, or null if none is stored.
 *  Keys are decrypted only inside server routes at call time — never sent to
 *  the client, never logged, never in error messages. */
export async function loadKey(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderId
): Promise<string | null> {
  const { data } = await supabase
    .from("api_keys")
    .select("key_ciphertext")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data?.key_ciphertext) return null;
  return decrypt(data.key_ciphertext);
}
