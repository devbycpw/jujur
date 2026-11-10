import { buildLiveSummary, gateSummary, projectsFrom, publicProjects, type GateInput } from "@/app/data-gate";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rupYear } from "@/lib/rup-sync";

type PackageRow = {
  kode_rup: string;
  nama: string;
  klpd: string;
  satker: string;
  pagu: number;
  sumber_dana: string[] | null;
  metode: string;
  lokasi: string;
  detail_lokasi: string;
  uraian: string;
  volume: string;
  tanggal_umumkan: string;
  pemilihan_mulai: string | null;
  pemilihan_akhir: string | null;
  kontrak_mulai: string | null;
  kontrak_akhir: string | null;
  sumber_url: string;
  lat: number | null;
  lng: number | null;
  geocode_label: string | null;
  geocode_precision: string | null;
  geocode_note: string | null;
  fetched_at: string;
};

function span(mulai: string | null, akhir: string | null) {
  if (!mulai || !akhir) return null;
  return { mulai, akhir, teks: `${mulai} – ${akhir}` };
}

function toInput(row: PackageRow): GateInput {
  return {
    kodeRup: row.kode_rup,
    nama: row.nama,
    klpd: row.klpd,
    satker: row.satker,
    pagu: Number(row.pagu) || 0,
    sumberDana: row.sumber_dana || [],
    lokasi: row.lokasi,
    detailLokasi: row.detail_lokasi || row.lokasi,
    uraian: row.uraian || row.nama,
    volume: row.volume || "",
    metode: row.metode || "",
    tanggalUmumkan: row.tanggal_umumkan || "",
    pemilihan: span(row.pemilihan_mulai, row.pemilihan_akhir),
    kontrak: span(row.kontrak_mulai, row.kontrak_akhir),
    sumberUrl: row.sumber_url,
    geocode: row.lat != null && row.lng != null ? {
      lat: row.lat,
      lng: row.lng,
      label: row.geocode_label || row.detail_lokasi || row.lokasi,
      precision: row.geocode_precision || "alamat",
      note: row.geocode_note || undefined,
    } : null,
    retrievedAt: row.fetched_at,
  };
}

export async function readPackages() {
  const db = supabaseAdmin();
  if (!db) return { source: "snapshot" as const, summary: gateSummary, projects: publicProjects, warning: "SUPABASE_URL atau SUPABASE_SECRET_KEY belum terbaca." };
  const { data, error } = await db.from("rup_packages").select("*").eq("tahun", rupYear()).order("pagu", { ascending: false }).limit(5000);
  if (error) return { source: "snapshot" as const, summary: gateSummary, projects: publicProjects, warning: error.message };
  if (!data?.length) return { source: "snapshot" as const, summary: gateSummary, projects: publicProjects, warning: "Supabase tersambung, tetapi tabel paket masih kosong. Tekan Perbarui data setelah tabel dibuat." };
  const projects = projectsFrom((data as PackageRow[]).map(toInput), new Date().toISOString().slice(0, 10));
  const { data: runs } = await db.from("sync_runs").select("finished_at,skipped_bukan_apbn").order("id", { ascending: false }).limit(1);
  const latest = runs?.[0];
  const summary = buildLiveSummary(projects, {
    retrievedAt: latest?.finished_at || new Date().toISOString(),
    fiscalYear: rupYear(),
    skippedBukanApbn: latest?.skipped_bukan_apbn || 0,
  });
  return { source: "supabase" as const, summary, projects };
}
