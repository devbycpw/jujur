-- Jalankan sekali di SQL Editor Supabase.
-- Service role dipakai oleh cron Vercel. Kunci itu tidak boleh masuk ke browser.

create table if not exists public.rup_packages (
  kode_rup text primary key,
  tahun integer not null,
  nama text not null,
  klpd text not null default '',
  kode_klpd text not null default '',
  satker text not null default '',
  pagu bigint not null default 0,
  sumber_dana text[] not null default '{}',
  jenis text not null default '',
  metode text not null default '',
  lokasi text not null default '',
  wilayah text not null default '',
  detail_lokasi text not null default '',
  uraian text not null default '',
  volume text not null default '',
  tanggal_umumkan text not null default '',
  pemilihan_mulai date,
  pemilihan_akhir date,
  kontrak_mulai date,
  kontrak_akhir date,
  sumber_url text not null,
  lat double precision,
  lng double precision,
  geocode_label text,
  geocode_precision text,
  geocode_note text,
  detail_status text not null default 'menunggu',
  geo_attempts integer not null default 0,
  fetched_at timestamptz not null default now()
);

create index if not exists rup_packages_tahun_idx on public.rup_packages (tahun);
create index if not exists rup_packages_detail_idx on public.rup_packages (detail_status);

create table if not exists public.location_cursors (
  lokasi_id text primary key,
  nama text not null default '',
  records_filtered integer not null default 0,
  page_start integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_state (
  id text primary key,
  location_index integer not null default 0,
  page_start integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  seen integer not null default 0,
  stored integer not null default 0,
  skipped_bukan_apbn integer not null default 0,
  detailed integer not null default 0,
  geocoded integer not null default 0,
  error text
);

alter table public.rup_packages enable row level security;
alter table public.sync_state enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "baca paket" on public.rup_packages;
create policy "baca paket" on public.rup_packages for select using (true);

drop policy if exists "baca ringkasan sinkronisasi" on public.sync_runs;
create policy "baca ringkasan sinkronisasi" on public.sync_runs for select using (true);
