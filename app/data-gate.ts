import type { AdminProject } from "./AdminDashboard";
import snapshot from "../data/public/salatiga-apbn-2026.json";

const BBOX = { south: -7.42, north: -7.26, west: 110.42, east: 110.57 };
const AS_OF = snapshot.retrievedAt.slice(0, 10);

type Span = { mulai: string | null; akhir: string | null; teks: string } | null;
type PackageRecord = (typeof snapshot.packages)[number];

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

function scheduleStatus(item: PackageRecord) {
  if (covers(item.kontrak, AS_OF)) return "Di dalam jadwal kontrak";
  if (covers(item.pemilihan, AS_OF)) return "Tahap pemilihan penyedia";
  if (item.kontrak?.mulai && AS_OF < item.kontrak.mulai) return "Menunggu jadwal kontrak";
  if (item.pemilihan?.mulai && AS_OF < item.pemilihan.mulai) return "Belum masuk jadwal pemilihan";
  if (item.kontrak?.akhir && AS_OF > item.kontrak.akhir) return "Jadwal kontrak sudah lewat";
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

function insideSalatiga(lat: number, lng: number) {
  return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;
}

function accept(item: PackageRecord) {
  const reasons: string[] = [];
  if (!/^\d+$/.test(item.kodeRup)) reasons.push("Kode RUP tidak valid");
  if (!item.sumberDana.some((source) => source.toUpperCase().includes("APBN"))) reasons.push("Sumber dana bukan APBN");
  if (!item.lokasi.toLowerCase().includes("salatiga")) reasons.push("Lokasi pengumuman bukan Salatiga");
  if (!Number.isInteger(item.pagu) || item.pagu <= 0) reasons.push("Pagu tidak valid");
  if (!item.klpd || !item.nama || !item.sumberUrl) reasons.push("Identitas paket tidak lengkap");
  if (item.sumberDanaRinci.length && item.sumberDanaRinci.every((line) => !line.sumber.toUpperCase().includes("APBN"))) reasons.push("Rincian sumber dana tidak memuat APBN");
  const geo = item.geocode;
  const precise = geo?.precision === "jalan" || geo?.precision === "objek" || geo?.precision === "alamat";
  const geoOk = Boolean(geo && precise && geo.label.toLowerCase().includes("salatiga") && insideSalatiga(geo.lat, geo.lng));
  return { accepted: reasons.length === 0, reasons, geoOk };
}

function toProject(item: PackageRecord, lat?: number, lng?: number, shifted = false): AdminProject {
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
    status: scheduleStatus(item),
    progress: 0,
    plan: 0,
    progressKnown: false,
    budget: formatRupiah(item.pagu),
    paguValue: item.pagu,
    contract: "Belum diumumkan",
    contractKnown: false,
    district: "Salatiga",
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
    retrievedAt: snapshot.retrievedAt,
  };
}

const seenPlaces = new Map<string, number>();
const decided = snapshot.packages.map((item) => ({ item, gate: accept(item) }));
const rejected = decided.filter((entry) => !entry.gate.accepted);

export const publicProjects: AdminProject[] = decided.filter((entry) => entry.gate.accepted).map(({ item, gate }) => {
  if (!gate.geoOk || !item.geocode) return toProject(item);
  const key = `${item.geocode.lat.toFixed(5)},${item.geocode.lng.toFixed(5)}`;
  const seen = seenPlaces.get(key) ?? 0;
  seenPlaces.set(key, seen + 1);
  return toProject(item, item.geocode.lat, item.geocode.lng + seen * 0.00022, seen > 0);
});

const retrievedLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(snapshot.retrievedAt));
const mappedCount = publicProjects.filter((project) => project.mappable).length;

export const gateSummary = {
  retrievedAt: snapshot.retrievedAt,
  retrievedLabel,
  fiscalYear: snapshot.fiscalYear,
  searchUrl: snapshot.source.search.replace("/search", "/index"),
  accepted: publicProjects.length,
  mapped: mappedCount,
  unmapped: publicProjects.length - mappedCount,
  rejected: rejected.length,
  cityConstruction: snapshot.counts.konstruksiPemerintahKota,
  cityApbn: snapshot.counts.konstruksiPemerintahKotaBertandaApbn,
  located: snapshot.counts.konstruksiBerlokasiSalatiga,
  pagu: publicProjects.reduce((sum, project) => sum + (project.paguValue || 0), 0),
  note: `${publicProjects.length} paket konstruksi APBN TA ${snapshot.fiscalYear} berlokasi di Salatiga. ${mappedCount} dipasang dari alamat di pengumuman SIRUP. ${snapshot.counts.konstruksiPemerintahKota} paket Pemkot tercatat APBD, jadi tidak masuk sebagai APBN. Diambil ${retrievedLabel}.`,
};
