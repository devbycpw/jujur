import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "./env";

function serverClient(key: string): SupabaseClient {
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseAdmin(): SupabaseClient | null {
  const key = supabaseSecretKey();
  if (!supabaseUrl() || !key) return null;
  return serverClient(key);
}

export function supabaseRead(): SupabaseClient | null {
  const admin = supabaseAdmin();
  if (admin) return admin;
  const key = supabasePublishableKey();
  if (!supabaseUrl() || !key) return null;
  return serverClient(key);
}
