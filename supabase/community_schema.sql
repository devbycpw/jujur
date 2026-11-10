-- ==============================================================================
-- APERTIO: SKEMA AUTENTIKASI, PROFIL, DAN INTERAKSI WARGA
-- Jalankan di SQL Editor Supabase.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABEL PROFILES (Dibuat terlebih dahulu sebelum fungsi yang mereferensikannya)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'warga' check (role in ('warga', 'admin')),
  avatar_url text default 'https://i.pravatar.cc/100?img=11',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz
);

alter table public.profiles enable row level security;

-- 3. HELPER FUNCTIONS
-- Mengecek apakah user yang sedang login memiliki role 'admin'
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer stable;

-- Trigger otomatis untuk memperbarui kolom updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger otomatis saat user register di Supabase Auth -> buat profil dengan role 'warga'
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'warga', -- Default role selalu warga, tidak bisa di-tamper dari frontend
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://i.pravatar.cc/100?img=11')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Policy Profiles
drop policy if exists "profil publik dapat dibaca semua orang" on public.profiles;
create policy "profil publik dapat dibaca semua orang"
  on public.profiles for select using (true);

drop policy if exists "pengguna dapat mengedit profil sendiri" on public.profiles;
create policy "pengguna dapat mengedit profil sendiri"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid()) -- Mencegah user mengubah rolenya sendiri!
  );

-- 4. TABEL DISCUSSIONS (Diskusi Warga per Proyek)
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  kode_rup text references public.rup_packages(kode_rup) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  photo_url text,
  is_report boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz
);

alter table public.discussions enable row level security;
create index if not exists idx_discussions_kode_rup on public.discussions(kode_rup);
create index if not exists idx_discussions_author on public.discussions(author_id);

drop policy if exists "diskusi dapat dibaca semua orang" on public.discussions;
create policy "diskusi dapat dibaca semua orang"
  on public.discussions for select using (true);

drop policy if exists "pengguna terdaftar dapat membuat diskusi" on public.discussions;
create policy "pengguna terdaftar dapat membuat diskusi"
  on public.discussions for insert
  with check (auth.role() = 'authenticated' and auth.uid() = author_id);

drop policy if exists "penulis atau admin dapat menghapus diskusi" on public.discussions;
create policy "penulis atau admin dapat menghapus diskusi"
  on public.discussions for delete
  using (auth.uid() = author_id or public.is_admin());

-- 5. TABEL DISCUSSION_REPLIES (Balasan Diskusi)
create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz
);

alter table public.discussion_replies enable row level security;
create index if not exists idx_replies_discussion on public.discussion_replies(discussion_id);

drop policy if exists "balasan dapat dibaca semua orang" on public.discussion_replies;
create policy "balasan dapat dibaca semua orang"
  on public.discussion_replies for select using (true);

drop policy if exists "pengguna terdaftar dapat membalas" on public.discussion_replies;
create policy "pengguna terdaftar dapat membalas"
  on public.discussion_replies for insert
  with check (auth.role() = 'authenticated' and auth.uid() = author_id);

-- 6. TABEL VOTES (Dukungan Suka / Tidak Suka per Diskusi)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('like', 'dislike')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique(discussion_id, user_id)
);

alter table public.votes enable row level security;
create index if not exists idx_votes_discussion on public.votes(discussion_id);

drop policy if exists "vote dapat dilihat semua orang" on public.votes;
create policy "vote dapat dilihat semua orang"
  on public.votes for select using (true);

drop policy if exists "pengguna terdaftar dapat memberi vote" on public.votes;
create policy "pengguna terdaftar dapat memberi vote"
  on public.votes for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "pengguna dapat mengubah vote sendiri" on public.votes;
create policy "pengguna dapat mengubah vote sendiri"
  on public.votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pengguna dapat menghapus vote sendiri" on public.votes;
create policy "pengguna dapat menghapus vote sendiri"
  on public.votes for delete
  using (auth.uid() = user_id);

-- 7. TABEL CITIZEN_REPORTS (Laporan Warga / Aspirasi)
create table if not exists public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  kode_rup text references public.rup_packages(kode_rup) on delete set null,
  author_name text not null,
  area text not null,
  content text not null,
  status text not null default 'Baru' check (status in ('Baru', 'Ditinjau', 'Ditindaklanjuti')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz
);

alter table public.citizen_reports enable row level security;

drop policy if exists "laporan dapat dilihat admin dan pembuatnya" on public.citizen_reports;
create policy "laporan dapat dilihat admin dan pembuatnya"
  on public.citizen_reports for select
  using (public.is_admin() or auth.uid() = author_id);

drop policy if exists "pengguna terdaftar dapat mengirim laporan" on public.citizen_reports;
create policy "pengguna terdaftar dapat mengirim laporan"
  on public.citizen_reports for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "admin dapat memperbarui status laporan" on public.citizen_reports;
create policy "admin dapat memperbarui status laporan"
  on public.citizen_reports for update
  using (public.is_admin())
  with check (public.is_admin());
