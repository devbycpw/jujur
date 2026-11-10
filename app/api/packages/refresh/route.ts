import { readPackages } from "@/lib/read-packages";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncRup } from "@/lib/rup-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const db = supabaseAdmin();
  if (!db) return Response.json({ error: "SUPABASE_SECRET_KEY belum diisi. Kunci publishable hanya boleh membaca." }, { status: 503 });
  try {
    const sync = await syncRup(db);
    const payload = await readPackages();
    return Response.json({ ...payload, added: sync.stored, checked: sync.seen, alreadyStored: sync.skippedExisting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui";
    const missingTable = message.includes("schema cache") || message.includes("rup_packages") || message.includes("location_cursors") || message.includes("sync_runs");
    return Response.json({
      error: missingTable ? "Tabel belum ada di Supabase. Jalankan isi supabase/schema.sql di SQL Editor, lalu tekan Perbarui data lagi." : message,
    }, { status: missingTable ? 409 : 500 });
  }
}
