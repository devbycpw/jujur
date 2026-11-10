import type { SupabaseClient } from "@supabase/supabase-js";
import locations from "../data/jateng-locations.json";
import snapshot from "../data/public/salatiga-apbn-2026.json";

const SEARCH = "https://sirup.inaproc.id/sirup/caripaketctr/search";
const DETAIL = "https://sirup.inaproc.id/sirup/rup/detailPaketPenyedia2020";
const UA = "APERTIO-data-gate/1.0 (Jawa Tengah civic transparency; public SIRUP sync)";
const LIST_BUDGET_MS = 160_000;
const DETAIL_BUDGET_MS = 250_000;
const GEOCODE_BUDGET_MS = 285_000;

type SirupRow = {
  id: number;
  paket: string;
  pagu: number;
  satuanKerja?: string;
  kldi?: string;
  idKldi?: string;
  sumberDana?: string;
  jenisPengadaan?: string;
  metode?: string;
  lokasi?: string;
};

type SyncCursor = { location_index: number; page_start: number };

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

export function rupYear() {
  const configured = Number(process.env.RUP_YEAR);
  if (Number.isInteger(configured) && configured > 2000) return configured;
  return new Date().getFullYear();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPage(year: number, lokasi: string, start: number) {
  const query = new URLSearchParams({
    tahunAnggaran: String(year),
    jenisPengadaan: "2",
    metodePengadaan: "",
    minPagu: "",
    maxPagu: "",
    bulan: "",
    lokasi,
    kldi: "",
    pdn: "",
    ukm: "",
    draw: "1",
    start: String(start),
    length: "100",
    "search[value]": "",
    "order[0][column]": "5",
    "order[0][dir]": "desc",
  });
  const response = await fetch(`${SEARCH}?${query}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`SIRUP ${response.status} pada lokasi ${lokasi}`);
  return response.json() as Promise<{ data?: SirupRow[]; recordsFiltered?: number }>;
}

function isApbn(value: string | undefined) {
  return (value || "").toUpperCase().includes("APBN");
}

function wilayahFrom(lokasi: string, fallback: string) {
  const parts = lokasi.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(", ") : fallback;
}

async function storeNewRows(db: SupabaseClient, year: number, placeName: string, rows: SirupRow[], known: Set<string>, stats: { seen: number; stored: number; skippedBukanApbn: number; skippedExisting: number }) {
  stats.seen += rows.length;
  const apbn = rows.filter((row) => isApbn(row.sumberDana) && Number(row.pagu) > 0);
  stats.skippedBukanApbn += rows.length - apbn.length;
  const fresh = apbn.filter((row) => !known.has(String(row.id)));
  stats.skippedExisting += apbn.length - fresh.length;
  if (!fresh.length) return;
  const records = fresh.map((row) => ({
    kode_rup: String(row.id),
    tahun: year,
    nama: row.paket,
    klpd: row.kldi || "",
    kode_klpd: row.idKldi || "",
    satker: row.satuanKerja || "",
    pagu: Number(row.pagu) || 0,
    sumber_dana: (row.sumberDana || "").split(",").map((part) => part.trim()).filter(Boolean),
    jenis: row.jenisPengadaan || "Pekerjaan Konstruksi",
    metode: row.metode || "",
    lokasi: row.lokasi || `Jawa Tengah, ${placeName}`,
    wilayah: wilayahFrom(row.lokasi || "", placeName),
    sumber_url: `${DETAIL}?idPaket=${row.id}`,
    fetched_at: new Date().toISOString(),
  }));
  const { error } = await db.from("rup_packages").upsert(records, { onConflict: "kode_rup", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  for (const row of fresh) known.add(String(row.id));
  stats.stored += records.length;
}

async function loadCursor(db: SupabaseClient): Promise<SyncCursor> {
  const { data } = await db.from("sync_state").select("location_index,page_start").eq("id", "rup").maybeSingle();
  return { location_index: data?.location_index ?? 0, page_start: data?.page_start ?? 0 };
}

async function saveCursor(db: SupabaseClient, cursor: SyncCursor) {
  await db.from("sync_state").upsert({ id: "rup", ...cursor, updated_at: new Date().toISOString() });
}

async function knownCodes(db: SupabaseClient, year: number) {
  const known = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await db.from("rup_packages").select("kode_rup").eq("tahun", year).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data || []) known.add(row.kode_rup as string);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return known;
}

export async function seedSnapshotIfEmpty(db: SupabaseClient) {
  const { count, error } = await db.from("rup_packages").select("kode_rup", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if (count) return 0;
  const records = snapshot.packages.map((item) => ({
    kode_rup: item.kodeRup,
    tahun: snapshot.fiscalYear,
    nama: item.nama,
    klpd: item.klpd,
    kode_klpd: item.kodeKlpd,
    satker: item.satker,
    pagu: item.pagu,
    sumber_dana: item.sumberDana,
    jenis: item.jenis,
    metode: item.metode,
    lokasi: item.lokasi,
    wilayah: wilayahFrom(item.lokasi, "Salatiga (Kota)"),
    detail_lokasi: item.detailLokasi,
    uraian: item.uraian,
    volume: item.volume,
    tanggal_umumkan: item.tanggalUmumkan,
    pemilihan_mulai: item.pemilihan?.mulai || null,
    pemilihan_akhir: item.pemilihan?.akhir || null,
    kontrak_mulai: item.kontrak?.mulai || null,
    kontrak_akhir: item.kontrak?.akhir || null,
    sumber_url: item.sumberUrl,
    lat: item.geocode?.lat ?? null,
    lng: item.geocode?.lng ?? null,
    geocode_label: item.geocode?.label ?? null,
    geocode_precision: item.geocode?.precision ?? null,
    geocode_note: item.geocode?.note ?? null,
    detail_status: "lengkap",
    geo_attempts: item.geocode ? 1 : 0,
    fetched_at: snapshot.retrievedAt,
  }));
  const { error: insertError } = await db.from("rup_packages").upsert(records, { onConflict: "kode_rup", ignoreDuplicates: true });
  if (insertError) throw new Error(insertError.message);
  return records.length;
}

export async function syncRup(db: SupabaseClient) {
  const year = rupYear();
  const started = Date.now();
  const stats = { seen: 0, stored: 0, skippedBukanApbn: 0, skippedExisting: 0, detailed: 0, geocoded: 0, pages: 0, wrapped: false };
  await seedSnapshotIfEmpty(db);
  const known = await knownCodes(db, year);
  const { data: savedCursors } = await db.from("location_cursors").select("lokasi_id,records_filtered,page_start");
  const cursors = new Map<string, { records_filtered: number; page_start: number }>();
  for (const row of savedCursors || []) cursors.set(row.lokasi_id as string, { records_filtered: row.records_filtered as number, page_start: row.page_start as number });
  const { data: runRow, error: runError } = await db.from("sync_runs").insert({}).select("id").single();
  if (runError) throw new Error(runError.message);
  const runId = runRow.id as number;

  try {
    for (const place of locations) {
      if (Date.now() - started >= LIST_BUDGET_MS) break;
      const saved = cursors.get(place.id) || { records_filtered: 0, page_start: 0 };
      let start = saved.page_start || 0;
      let total = saved.records_filtered;
      if (start === 0) {
        const head = await searchPage(year, place.id, 0);
        total = head.recordsFiltered || 0;
        stats.pages += 1;
        if (total === saved.records_filtered && saved.records_filtered > 0) continue;
        await storeNewRows(db, year, place.nama, head.data || [], known, stats);
        const firstCount = head.data?.length || 0;
        if (!firstCount || firstCount >= total) {
          await db.from("location_cursors").upsert({ lokasi_id: place.id, nama: place.nama, records_filtered: total, page_start: 0, updated_at: new Date().toISOString() });
          continue;
        }
        start = firstCount;
      }
      while (Date.now() - started < LIST_BUDGET_MS) {
        const payload = await searchPage(year, place.id, start);
        const rows = payload.data || [];
        total = payload.recordsFiltered || total;
        stats.pages += 1;
        await storeNewRows(db, year, place.nama, rows, known, stats);
        const next = start + rows.length;
        if (!rows.length || next >= total) {
          await db.from("location_cursors").upsert({ lokasi_id: place.id, nama: place.nama, records_filtered: total, page_start: 0, updated_at: new Date().toISOString() });
          break;
        }
        start = next;
        await db.from("location_cursors").upsert({ lokasi_id: place.id, nama: place.nama, records_filtered: 0, page_start: start, updated_at: new Date().toISOString() });
        await sleep(200);
      }
    }
    stats.wrapped = Date.now() - started < LIST_BUDGET_MS;

    while (Date.now() - started < DETAIL_BUDGET_MS) {
    const { data: pending } = await db.from("rup_packages").select("kode_rup,nama").eq("tahun", year).eq("detail_status", "menunggu").limit(20);
    if (!pending?.length) break;
    for (const item of pending) {
      if (Date.now() - started > DETAIL_BUDGET_MS) break;
      try {
        const detail = await readDetail(String(item.kode_rup));
        const update: Record<string, unknown> = {
          detail_lokasi: detail.detailLokasi,
          uraian: detail.uraian,
          volume: detail.volume,
          tanggal_umumkan: detail.tanggalUmumkan,
          pemilihan_mulai: detail.pemilihan?.mulai || null,
          pemilihan_akhir: detail.pemilihan?.akhir || null,
          kontrak_mulai: detail.kontrak?.mulai || null,
          kontrak_akhir: detail.kontrak?.akhir || null,
          detail_status: "lengkap",
          fetched_at: new Date().toISOString(),
        };
        if (detail.metode) update.metode = detail.metode;
        await db.from("rup_packages").update(update).eq("kode_rup", item.kode_rup);
        stats.detailed += 1;
      } catch {
        await db.from("rup_packages").update({ geo_attempts: 2, detail_status: "lengkap" }).eq("kode_rup", item.kode_rup);
      }
      await sleep(400);
    }
    }

    const { data: needsPoint } = await db.from("rup_packages").select("kode_rup,detail_lokasi,nama,geo_attempts").eq("tahun", year).eq("detail_status", "lengkap").is("lat", null).lt("geo_attempts", 2).limit(15);
    for (const item of needsPoint || []) {
      if (Date.now() - started > GEOCODE_BUDGET_MS) break;
      const query = geocodeQuery(item.detail_lokasi || "", item.nama || "");
      if (!query) {
        await db.from("rup_packages").update({ geo_attempts: 2, geocode_note: "Pengumuman belum menulis jalan atau fasilitas yang bisa dicari." }).eq("kode_rup", item.kode_rup);
        continue;
      }
      const point = await geocode(query);
      await sleep(1100);
      if (!point) {
        await db.from("rup_packages").update({ geo_attempts: (item.geo_attempts || 0) + 1 }).eq("kode_rup", item.kode_rup);
        continue;
      }
      await db.from("rup_packages").update({
        lat: point.lat,
        lng: point.lng,
        geocode_label: point.label,
        geocode_precision: "alamat",
        geocode_note: "Titik mengikuti alamat pada pengumuman SIRUP. Nomor rumah yang tidak ada di OpenStreetMap tetap berada di ruas jalannya.",
        geo_attempts: (item.geo_attempts || 0) + 1,
      }).eq("kode_rup", item.kode_rup);
      stats.geocoded += 1;
    }

    await db.from("sync_runs").update({
      finished_at: new Date().toISOString(),
      seen: stats.seen,
      stored: stats.stored,
      skipped_bukan_apbn: stats.skippedBukanApbn,
      detailed: stats.detailed,
      geocoded: stats.geocoded,
    }).eq("id", runId);
    return { ok: true, year, ...stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi gagal";
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), error: message, seen: stats.seen, stored: stats.stored, skipped_bukan_apbn: stats.skippedBukanApbn }).eq("id", runId);
    throw error;
  }
}

function linesOf(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<td[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function valueAfter(lines: string[], label: string) {
  const index = lines.indexOf(label);
  return index >= 0 && lines[index + 1] && lines[index + 1] !== label ? lines[index + 1] : "";
}

function monthDate(label: string, end: boolean) {
  const [monthName, yearText] = label.trim().toLowerCase().split(/\s+/);
  const month = MONTHS[monthName];
  const year = Number(yearText);
  if (!month || !year) return null;
  if (!end) return `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function spanAfter(lines: string[], label: string) {
  const index = lines.findIndex((line) => line.toLowerCase().startsWith(label.toLowerCase()));
  if (index < 0 || index + 4 >= lines.length) return null;
  const mulai = monthDate(lines[index + 3], false);
  const akhir = monthDate(lines[index + 4], true);
  if (!mulai || !akhir) return null;
  return { mulai, akhir };
}

function detailLokasi(lines: string[]) {
  const index = lines.indexOf("Detail Lokasi");
  if (index < 0) return "";
  const offset = lines.slice(index + 1, index + 8).indexOf("1.");
  if (offset < 0) return "";
  return lines[index + 1 + offset + 3] || "";
}

async function readDetail(kode: string) {
  const response = await fetch(`${DETAIL}?idPaket=${kode}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Detail ${kode} ${response.status}`);
  const lines = linesOf(await response.text());
  return {
    detailLokasi: detailLokasi(lines),
    uraian: valueAfter(lines, "Uraian Pekerjaan"),
    volume: valueAfter(lines, "Volume Pekerjaan"),
    metode: valueAfter(lines, "Metode Pemilihan"),
    tanggalUmumkan: valueAfter(lines, "Tanggal Umumkan Paket"),
    pemilihan: spanAfter(lines, "Jadwal Pemilihan Penyedia"),
    kontrak: spanAfter(lines, "Jadwal Pelaksanaan Kontrak"),
  };
}

function geocodeQuery(detail: string, nama: string) {
  const text = detail.trim();
  const low = text.toLowerCase();
  if (/jl\.?|jalan |no\.?\s*\d|km\.?\s*\d/i.test(text)) return `${text}, Jawa Tengah`;
  if (low && !/^kota\b/.test(low) && text.length > 8 && !low.includes("jawa tengah")) return `${text}, Jawa Tengah`;
  const street = nama.match(/\bjl\.?\s+[a-z0-9 .']+/i);
  if (street) return `${street[0]}, Jawa Tengah`;
  return "";
}

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "jsonv2", limit: "3", countrycodes: "id", q: query })}`;
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  const hits = await response.json() as { lat: string; lon: string; display_name?: string }[];
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    const label = hit.display_name || "";
    const low = label.toLowerCase();
    const inside = lat <= -6.4 && lat >= -8.08 && lng >= 108.4 && lng <= 111.75;
    if (inside && low.includes("jawa tengah") && !low.includes("yogyakarta")) return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), label };
  }
  return null;
}
