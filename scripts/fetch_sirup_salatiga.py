#!/usr/bin/env python3
"""Ambil paket konstruksi terumumkan di SIRUP yang berlokasi di Kota Salatiga.

Sumbernya endpoint JSON yang dipakai halaman pencarian publik SIRUP.
Tidak memakai token API Gateway, tidak menyimpan NIP, dan tidak mengarang koordinat.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "public" / "salatiga-apbn-2026.json"
UA = "APERTIO-data-gate/1.0 (Salatiga civic transparency; public SIRUP read)"
SEARCH = "https://sirup.inaproc.id/sirup/caripaketctr/search"
DETAIL = "https://sirup.inaproc.id/sirup/rup/detailPaketPenyedia2020"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
# Selatan, utara, barat, timur. Dibuat sedikit longgar dari batas kota.
BBOX = (-7.42, -7.26, 110.42, 110.57)
MONTHS = {
    "januari": 1,
    "februari": 2,
    "maret": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "agustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "desember": 12,
}


class TableText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style"}:
            self.skip += 1
        if tag == "tr":
            self.parts.append("\n")
        elif tag == "td":
            self.parts.append("\t")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        if tag == "tr":
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def get_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8", "replace")


def search_page(start: int) -> dict:
    query = {
        "tahunAnggaran": "2026",
        "jenisPengadaan": "2",
        "metodePengadaan": "",
        "minPagu": "",
        "maxPagu": "",
        "bulan": "",
        "lokasi": "14803",
        "kldi": "",
        "pdn": "",
        "ukm": "",
        "draw": "1",
        "start": str(start),
        "length": "100",
        "search[value]": "",
        "order[0][column]": "5",
        "order[0][dir]": "desc",
    }
    return get_json(SEARCH + "?" + urllib.parse.urlencode(query))


def all_located() -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        payload = search_page(start)
        batch = payload.get("data") or []
        rows.extend(batch)
        total = payload.get("recordsFiltered") or 0
        if len(rows) >= total or len(batch) < 100:
            break
        start += 100
        time.sleep(0.6)
    return rows


def cells(html: str) -> list[list[str]]:
    parser = TableText()
    parser.feed(html)
    rows = []
    for line in "".join(parser.parts).splitlines():
        items = [re.sub(r"\s+", " ", cell).strip() for cell in line.split("\t")]
        items = [cell for cell in items if cell]
        if items:
            rows.append(items)
    return rows


def month_span(label: str, end: bool) -> str | None:
    parts = label.strip().lower().split()
    if len(parts) < 2 or parts[0] not in MONTHS:
        return None
    year = int(re.sub(r"\D", "", parts[1]) or "0")
    month = MONTHS[parts[0]]
    if year < 2000:
        return None
    if not end:
        return f"{year:04d}-{month:02d}-01"
    if month == 12:
        last = datetime(year, 12, 31)
    else:
        last = datetime(year, month + 1, 1) - timedelta(days=1)
    return last.strftime("%Y-%m-%d")


def pair_after(rows: list[list[str]], label: str) -> tuple[str, str] | None:
    for index, row in enumerate(rows):
        if not row or not row[0].lower().startswith(label.lower()):
            continue
        window = rows[index + 1 : index + 4]
        for follow in window:
            if len(follow) >= 2 and follow[0] != "Mulai" and follow[1] != "Akhir":
                return follow[0], follow[1]
        if index + 4 < len(rows):
            starts = rows[index + 3]
            finishes = rows[index + 4]
            if len(starts) == 1 and len(finishes) == 1:
                return starts[0], finishes[0]
    return None


def value_after(rows: list[list[str]], label: str) -> str:
    for index, row in enumerate(rows):
        if row == [label] and index + 1 < len(rows) and rows[index + 1] != [label]:
            return rows[index + 1][0]
    return ""


def parse_sumber(rows: list[list[str]]) -> list[dict]:
    start = None
    for index, row in enumerate(rows):
        if row == ["Pagu"] and index > 0 and rows[index - 1] == ["MAK"]:
            start = index + 1
            break
    if start is None:
        return []
    items = []
    index = start
    while index < len(rows) and rows[index] != ["Total Pagu"]:
        chunk = rows[index : index + 6]
        if len(chunk) < 6 or not chunk[0][0].rstrip(".").isdigit():
            break
        raw_pagu = re.sub(r"\D", "", chunk[5][0])
        items.append(
            {
                "sumber": chunk[1][0],
                "tahun": chunk[2][0],
                "klpd": chunk[3][0],
                "mak": chunk[4][0],
                "pagu": int(raw_pagu) if raw_pagu and int(raw_pagu) > 0 else None,
            }
        )
        index += 6
    return items


def parse_detail_lokasi(rows: list[list[str]]) -> str:
    for index, row in enumerate(rows):
        if row != ["Detail Lokasi"]:
            continue
        for cursor in range(index + 1, min(index + 8, len(rows) - 3)):
            if rows[cursor] == ["1."]:
                return rows[cursor + 3][0]
    return ""


def parse_detail(html: str) -> dict:
    rows = cells(html)
    sumber = parse_sumber(rows)
    pemilihan = pair_after(rows, "Jadwal Pemilihan Penyedia")
    kontrak = pair_after(rows, "Jadwal Pelaksanaan Kontrak")
    pemanfaatan = pair_after(rows, "Pemanfaatan Barang/Jasa")
    detail_lokasi = parse_detail_lokasi(rows)
    lookup = {
        "kodeRup": value_after(rows, "Kode RUP"),
        "nama": value_after(rows, "Nama Paket"),
        "klpd": value_after(rows, "Nama KLPD"),
        "satker": value_after(rows, "Satuan Kerja"),
        "tahun": value_after(rows, "Tahun Anggaran"),
        "volume": value_after(rows, "Volume Pekerjaan"),
        "uraian": value_after(rows, "Uraian Pekerjaan"),
        "spesifikasi": value_after(rows, "Spesifikasi Pekerjaan"),
        "metode": value_after(rows, "Metode Pemilihan"),
        "tanggalUmumkan": value_after(rows, "Tanggal Umumkan Paket"),
    }
    def span(pair: tuple[str, str] | None) -> dict | None:
        if not pair:
            return None
        return {"mulai": month_span(pair[0], False), "akhir": month_span(pair[1], True), "teks": f"{pair[0]} – {pair[1]}"}

    return {
        "kodeRup": lookup["kodeRup"],
        "nama": lookup["nama"],
        "klpd": lookup["klpd"],
        "satker": lookup["satker"],
        "tahun": lookup["tahun"],
        "volume": lookup["volume"],
        "uraian": lookup["uraian"],
        "spesifikasi": lookup["spesifikasi"],
        "metode": lookup["metode"],
        "tanggalUmumkan": lookup["tanggalUmumkan"],
        "detailLokasi": detail_lokasi,
        "sumberDanaRinci": sumber,
        "pemilihan": span(pemilihan),
        "kontrak": span(kontrak),
        "pemanfaatan": span(pemanfaatan),
    }


def address_query(detail: str, name: str) -> tuple[str, str] | None:
    text = (detail or "").strip()
    lowered = text.lower()
    if "lingkar salatiga km" in lowered:
        return "Kampus 3 UIN Salatiga, Jalan Lingkar Salatiga", "alamat"
    if "hasanudin 806" in lowered or "hasanuddin 806" in lowered:
        return "RS Paru dr. Ario Wirawan, Jalan Hasanuddin 806, Salatiga", "alamat"
    if "hasanudin" in lowered or "hasanuddin" in lowered:
        return "Jalan Hasanuddin, Salatiga", "alamat"
    if "muwardi" in lowered and "50" in lowered:
        return "RS dr. Asmir, Jalan Dokter Muwardi 50, Salatiga", "alamat"
    if "diponegoro" in lowered:
        return "Korem 073 Makutarama, Salatiga", "alamat"
    if "yos sudarso" in lowered:
        return "Jalan Yos Sudarso, Salatiga", "alamat"
    if "imam bonjol" in lowered:
        return "Jalan Imam Bonjol, Salatiga", "alamat"
    if "kementerian agama" in lowered:
        return "Kementerian Agama Kota Salatiga", "alamat"
    if "lingkar selatan" in lowered or "cebongan" in lowered:
        return "Jalan Lingkar Salatiga, Cebongan, Salatiga", "alamat"
    if lowered in {"mtsn salatiga"}:
        return "MTsN Salatiga, Jawa Tengah", "objek"
    if lowered == "polres salatiga":
        return "Polres Salatiga, Jawa Tengah", "objek"
    if "terminal tingkir" in lowered:
        return "Terminal Tingkir, Salatiga, Jawa Tengah", "objek"
    if re.search(r"\b(?:jl\.?|jalan)\b", lowered):
        street = re.split(r",", text)[0].strip()
        return f"{street}, Salatiga, Jawa Tengah", "alamat"
    return place_query(name)


def place_query(name: str) -> tuple[str, str] | None:
    lowered = name.lower()
    if "muwardi" in lowered:
        return "Jalan Dokter Muwardi, Salatiga, Jawa Tengah", "jalan"
    street = re.search(r"\bjl\.?\s+([a-z0-9 .']+)", name, re.I)
    if street and not re.search(r"\b(gedung|laboratorium|kantor|bangunan)\b", street.group(1), re.I):
        cleaned = re.split(r"[-–,(]", street.group(1))[0]
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
        return f"Jl. {cleaned.title()}, Salatiga, Jawa Tengah", "jalan"
    if "terminal tingkir" in lowered:
        return "Terminal Tingkir, Salatiga, Jawa Tengah", "objek"
    if "uin salatiga" in lowered:
        return None
    if "mtsn salatiga" in lowered or "mts negeri" in lowered:
        return "MTsN Salatiga, Jawa Tengah", "objek"
    if "polsek" in lowered:
        return None
    if "polres salatiga" in lowered:
        return "Polres Salatiga, Jawa Tengah", "objek"
    if "kejaksaan negeri salatiga" in lowered:
        return "Kejaksaan Negeri Salatiga, Jawa Tengah", "objek"
    return None


def geocode(query: str) -> dict | None:
    params = {
        "format": "jsonv2",
        "limit": "5",
        "countrycodes": "id",
        "q": query,
    }
    req = urllib.request.Request(
        NOMINATIM + "?" + urllib.parse.urlencode(params),
        headers={"User-Agent": UA, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=40) as res:
        hits = json.load(res)
    south, north, west, east = BBOX
    for hit in hits:
        lat = float(hit["lat"])
        lng = float(hit["lon"])
        label = hit.get("display_name", "")
        if south <= lat <= north and west <= lng <= east and "salatiga" in label.lower():
            return {"lat": round(lat, 6), "lng": round(lng, 6), "label": label, "query": query}
    return None


def main() -> None:
    located = all_located()
    city = [row for row in located if row.get("idKldi") == "D148"]
    apbn_rows = [row for row in located if "APBN" in (row.get("sumberDana") or "").upper()]
    packages = []
    geocode_cache: dict[str, dict | None] = {}
    for row in apbn_rows:
        kode = str(row["id"])
        detail = parse_detail(get_text(f"{DETAIL}?idPaket={kode}"))
        time.sleep(0.45)
        guess = address_query(detail.get("detailLokasi") or "", row.get("paket") or "")
        geo = None
        precision = "tidak-dipetakan"
        if guess:
            query, precision = guess
            if query not in geocode_cache:
                geocode_cache[query] = geocode(query)
                time.sleep(1.1)
            found = geocode_cache[query]
            if found:
                geo = {**found, "precision": precision}
            else:
                precision = "tidak-dipetakan"
        sumber = sorted({part.strip() for part in (row.get("sumberDana") or "").split(",") if part.strip()})
        packages.append(
            {
                "kodeRup": kode,
                "nama": row.get("paket") or detail.get("nama"),
                "klpd": row.get("kldi") or detail.get("klpd"),
                "kodeKlpd": row.get("idKldi"),
                "satker": row.get("satuanKerja") or detail.get("satker"),
                "pagu": int(row.get("pagu") or 0),
                "sumberDana": sumber,
                "jenis": row.get("jenisPengadaan"),
                "metode": row.get("metode") or detail.get("metode"),
                "lokasi": row.get("lokasi"),
                "detailLokasi": detail.get("detailLokasi") or "Salatiga (Kota)",
                "uraian": detail.get("uraian") or row.get("paket"),
                "spesifikasi": detail.get("spesifikasi") or "",
                "volume": detail.get("volume") or "",
                "pemilihan": detail.get("pemilihan"),
                "kontrak": detail.get("kontrak"),
                "pemanfaatan": detail.get("pemanfaatan"),
                "tanggalUmumkan": detail.get("tanggalUmumkan") or "",
                "sumberDanaRinci": detail.get("sumberDanaRinci") or [],
                "sumberUrl": f"{DETAIL}?idPaket={kode}",
                "geocode": geo,
            }
        )
        print(f"{kode} {precision:16} {row.get('kldi','')[:28]:28} {row.get('paket','')[:70]}", flush=True)

    payload = {
        "retrievedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "fiscalYear": 2026,
        "locationId": "14803",
        "locationName": "Salatiga (Kota)",
        "source": {
            "name": "SIRUP LKPP",
            "search": SEARCH,
            "detail": DETAIL,
            "access": "JSON publik yang dipakai halaman Cari Paket. API Gateway INAPROC memerlukan token instansi dan tidak dipakai.",
        },
        "counts": {
            "konstruksiBerlokasiSalatiga": len(located),
            "konstruksiPemerintahKota": len(city),
            "konstruksiPemerintahKotaBertandaApbn": sum(1 for row in city if "APBN" in (row.get("sumberDana") or "").upper()),
            "konstruksiApbnDiWilayahSalatiga": len(packages),
        },
        "packages": packages,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {OUT} packages={len(packages)} mapped={sum(1 for item in packages if item['geocode'])}")


if __name__ == "__main__":
    main()
