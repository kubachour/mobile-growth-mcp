import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

export interface AuthResult {
  valid: boolean;
  team_name?: string;
  is_admin?: boolean;
}

export async function validateApiKey(
  apiKey: string,
  supabase: SupabaseClient
): Promise<AuthResult> {
  if (!apiKey) return { valid: false };

  // SHA-256 hash the raw key
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: row, error } = await supabase
    .from("api_keys")
    .select("team_name, is_admin")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !row) return { valid: false };

  return { valid: true, team_name: row.team_name, is_admin: row.is_admin ?? false };
}
