import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function projectUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function serverClient(key: string): SupabaseClient {
  return createClient(projectUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl() || !key) return null;
  return serverClient(key);
}

export function supabaseRead(): SupabaseClient | null {
  const admin = supabaseAdmin();
  if (admin) return admin;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!projectUrl() || !key) return null;
  return serverClient(key);
}
