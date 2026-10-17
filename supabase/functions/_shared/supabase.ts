import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function secretKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    if (typeof obj.default === "string" && obj.default) return obj.default;
    return Object.values(obj).find((v) => typeof v === "string" && v) ?? "";
  } catch (_) {
    return "";
  }
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = secretKey();
  if (!url || !key) throw new Error("Supabase URL ili secret key nisu dostupni u funkciji.");
  return createClient(url, key, { auth: { persistSession: false } });
}
