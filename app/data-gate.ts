import type { AdminProject } from "./AdminDashboard";
import snapshot from "../data/public/salatiga-apbn-2026.json";

const BBOX = { south: -8.08, north: -6.4, west: 108.4, east: 111.75 };

export type Span = { mulai: string | null; akhir: string | null; teks: string } | null;
export type GateInput = {
  kodeRup: string;
  nama: string;
  klpd: string;
  satker: string;
  pagu: number;
  sumberDana: string[];
  lokasi: string;
  detailLokasi: string;
  uraian: string;
  volume: string;
  metode: string;
  tanggalUmumkan: string;
  pemilihan: Span;
  kontrak: Span;
  sumberUrl: string;
  geocode: { lat: number; lng: number; label: string; precision: string; note?: string } | null;
  sumberDanaRinci?: { sumber: string }[];
  retrievedAt?: string;
};

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function formatCompact(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return formatRupiah(value);
}

function covers(span: Span, day: string) {
  return Boolean(span?.mulai && span.akhir && day >= span.mulai && day <= span.akhir);
}

function scheduleStatus(item: GateInput, asOf: string) {
  if (covers(item.kontrak, asOf)) return "Di dalam jadwal kontrak";
  if (covers(item.pemilihan, asOf)) return "Tahap pemilihan penyedia";
  if (item.kontrak?.mulai && asOf < item.kontrak.mulai) return "Menunggu jadwal kontrak";
  if (item.pemilihan?.mulai && asOf < item.pemilihan.mulai) return "Belum masuk jadwal pemilihan";
  if (item.kontrak?.akhir && asOf > item.kontrak.akhir) return "Jadwal kontrak sudah lewat";
  return "Jadwal tidak lengkap";
}

function classify(name: string) {
  const text = name.toLowerCase();
  if (/\bjalan\b|\bjl\.?|preservasi|landasan/.test(text)) return { category: "Jalan", type: "Jalan", color: "orange" };
  if (/gedung|bangunan|wall climbing|serambi|paving|pos jaga|halaman/.test(text)) return { category: "Gedung", type: "Gedung", color: "green" };
  return { category: "Konstruksi", type: "Lainnya", color: "yellow" };
}

function shortName(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= 52) return clean;
  const cut = clean.slice(0, 49).replace(/\s+\S*$/, "");
  return `${cut || clean.slice(0, 49)}…`;
}

function insideJateng(lat: number, lng: number) {
  return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;
}

function labelInJateng(label: string) {
  const text = label.toLowerCase();
  return !text.includes("jawa barat") && !text.includes("jawa timur") && !text.includes("yogyakarta");
}

function accept(item: GateInput) {
  const reasons: string[] = [];
  const tempat = item.lokasi.toLowerCase();
  if (!/^\d+$/.test(item.kodeRup)) reasons.push("Kode RUP tidak valid");
  if (!item.sumberDana.some((source) => source.toUpperCase().includes("APBN"))) reasons.push("Sumber dana bukan APBN");
  if (!tempat.includes("jawa tengah") && !tempat.includes("salatiga")) reasons.push("Lokasi pengumuman di luar Jawa Tengah");
  if (!Number.isInteger(item.pagu) || item.pagu <= 0) reasons.push("Pagu tidak valid");
  if (!item.klpd || !item.nama || !item.sumberUrl) reasons.push("Identitas paket tidak lengkap");
  if (item.sumberDanaRinci?.length && item.sumberDanaRinci.every((line) => !line.sumber.toUpperCase().includes("APBN"))) reasons.push("Rincian sumber dana tidak memuat APBN");
  const geo = item.geocode;
  const precise = geo?.precision === "jalan" || geo?.precision === "objek" || geo?.precision === "alamat";
  const geoOk = Boolean(geo && precise && labelInJateng(geo.label) && insideJateng(geo.lat, geo.lng));
  return { accepted: reasons.length === 0, reasons, geoOk };
}

function toProject(item: GateInput, asOf: string, lat?: number, lng?: number, shifted = false): AdminProject {
  const kind = classify(item.nama);
  const geo = item.geocode;
  const mappable = lat !== undefined && lng !== undefined;
  const placeNote = !mappable
    ? "Alamat pada pengumuman belum cukup untuk dipasang di peta."
    : geo?.note || "Titik mengikuti alamat yang tertulis di pengumuman SIRUP.";
  const shiftNote = shifted ? " Pin digeser sedikit karena ada paket lain pada fasilitas yang sama." : "";
  return {
    id: item.kodeRup,
    title: item.nama,
    short: shortName(item.nama),
    category: kind.category,
    type: kind.type,
    status: scheduleStatus(item, asOf),
    progress: 0,
    plan: 0,
    progressKnown: false,
    budget: formatRupiah(item.pagu),
    paguValue: item.pagu,
    contract: "Belum diumumkan",
    contractKnown: false,
    district: item.lokasi.replace(/^Jawa Tengah,\s*/i, "") || "Jawa Tengah",
    date: item.kontrak?.teks || "Jadwal kontrak tidak tercantum",
    location: mappable && geo ? `Alamat pengumuman: ${item.detailLokasi}. Cocok dengan ${geo.label}. ${placeNote}${shiftNote}` : `${item.detailLokasi}. ${placeNote}`,
    agency: item.klpd,
    description: [item.uraian, item.volume ? `Volume: ${item.volume}.` : "", item.metode ? `Metode pemilihan: ${item.metode}.` : "", item.satker ? `Satuan kerja: ${item.satker}.` : "", item.tanggalUmumkan ? `Diumumkan ${item.tanggalUmumkan}.` : "", "Ini pengumuman rencana umum pengadaan, bukan laporan progres lapangan."].filter(Boolean).join(" "),
    risk: "Realisasi fisik dan nilai kontrak tidak ada di SIRUP. Status mengikuti jadwal pemilihan dan kontrak yang diumumkan, per tanggal pengambilan data.",
    pin: "main",
    color: kind.color,
    comments: 0,
    lat,
    lng,
    evidence: "rup",
    mappable,
    sourceUrl: item.sumberUrl,
    sourceLabel: "SIRUP LKPP",
    retrievedAt: item.retrievedAt || snapshot.retrievedAt,
  };
}

export function projectsFrom(records: GateInput[], asOf: string) {
  const seenPlaces = new Map<string, number>();
  return records.flatMap((item) => {
    const gate = accept(item);
    if (!gate.accepted) return [];
    if (!gate.geoOk || !item.geocode) return [toProject(item, asOf)];
    const key = `${item.geocode.lat.toFixed(5)},${item.geocode.lng.toFixed(5)}`;
    const seen = seenPlaces.get(key) ?? 0;
    seenPlaces.set(key, seen + 1);
    return [toProject(item, asOf, item.geocode.lat, item.geocode.lng + seen * 0.00022, seen > 0)];
  });
}

const snapshotAsOf = snapshot.retrievedAt.slice(0, 10);
export const publicProjects = projectsFrom(snapshot.packages as GateInput[], snapshotAsOf);

export type GateSummary = {
  retrievedAt: string;
  retrievedLabel: string;
  fiscalYear: number;
  searchUrl: string;
  accepted: number;
  mapped: number;
  unmapped: number;
  skippedBukanApbn: number;
  pagu: number;
  note: string;
  source: "snapshot" | "supabase";
};

function summaryFrom(projects: AdminProject[], retrievedAt: string, fiscalYear: number, skippedBukanApbn: number, source: GateSummary["source"], note: string): GateSummary {
  const mapped = projects.filter((project) => project.mappable).length;
  return {
    retrievedAt,
    retrievedLabel: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(retrievedAt)),
    fiscalYear,
    searchUrl: "https://sirup.inaproc.id/sirup/caripaketctr/index",
    accepted: projects.length,
    mapped,
    unmapped: projects.length - mapped,
    skippedBukanApbn,
    pagu: projects.reduce((sum, project) => sum + (project.paguValue || 0), 0),
    note,
    source,
  };
}

export function buildLiveSummary(projects: AdminProject[], extra: { retrievedAt: string; fiscalYear: number; skippedBukanApbn: number }): GateSummary {
  const when = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(extra.retrievedAt));
  const mapped = projects.filter((project) => project.mappable).length;
  return summaryFrom(
    projects,
    extra.retrievedAt,
    extra.fiscalYear,
    extra.skippedBukanApbn,
    "supabase",
    `${projects.length} paket konstruksi APBN TA ${extra.fiscalYear} di Jawa Tengah. ${mapped} sudah punya titik dari alamat pengumuman. ${projects.length - mapped} belum bisa dipetakan dan tetap tampil di daftar. ${extra.skippedBukanApbn} paket konstruksi pada unduhan terakhir bukan APBN, jadi tidak disimpan. Diperbarui ${when}.`,
  );
}

export const gateSummary = summaryFrom(
  publicProjects,
  snapshot.retrievedAt,
  snapshot.fiscalYear,
  0,
  "snapshot",
  `${publicProjects.length} paket APBN Salatiga dari berkas lokal. Hubungkan Supabase agar data Jawa Tengah diperbarui otomatis tanpa mengubah kode. Realisasi fisik tidak diisi karena SIRUP tidak mengumumkannya.`,
);
