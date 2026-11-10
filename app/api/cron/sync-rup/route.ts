import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncRup } from "@/lib/rup-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) {
    return Response.json({ error: "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY belum diisi." }, { status: 503 });
  }
  try {
    const result = await syncRup(db);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi gagal";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
