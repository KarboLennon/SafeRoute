-- ============================================================
-- SafeRoute / JagaMalam — Skema Supabase
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  university text not null default 'Universitas Pamulang',
  email text,
  phone text,
  avatar_url text,
  level smallint not null default 1,
  safe_trip_days int not null default 0,
  report_count int not null default 0,
  verified boolean not null default false,
  preferences jsonb not null default '{"autoSos":true,"batteryAlert":true,"darkMode":false}',
<<<<<<< HEAD
  created_at timestamptz not null default now()
);

=======
  safety_pin_hash text,
  created_at timestamptz not null default now()
);

-- Patch tabel lama — kolom safety_pin_hash baru ditambah.
alter table public.profiles
  add column if not exists safety_pin_hash text;

>>>>>>> origin/main
-- Buat profil otomatis saat user baru daftar (ambil metadata dari signUp).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- EMERGENCY CONTACTS ----------
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text not null default 'Lainnya',
  active boolean not null default true,
<<<<<<< HEAD
  created_at timestamptz not null default now()
);
=======
  -- Buat dead-man's switch via Telegram bot. Kontak isi /start di bot JagaMalam
  -- lalu kirim ke user; user paste chat_id ke kontak ini. Nullable — kalau gak
  -- diset, kontak ini ga dapet auto-SOS via Telegram.
  telegram_chat_id text,
  created_at timestamptz not null default now()
);
-- Kolom telegram_chat_id ditambah belakangan — patch tabel lama yang udah ada.
alter table public.emergency_contacts
  add column if not exists telegram_chat_id text;
>>>>>>> origin/main

-- ---------- REPORTS (warga + berita) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('pencurian','tawuran','demonstrasi','bahaya_jalan')),
  level smallint not null check (level between 1 and 5),
  latitude double precision not null,
  longitude double precision not null,
  location_name text not null default '',
  description text not null default '',
  occurred_at timestamptz not null default now(),
  reporter_id uuid references public.profiles(id) on delete set null, -- null untuk berita
  reporter_name text not null default 'Warga',
  confirmations int not null default 0,
  comments int not null default 0,
  likes int not null default 0,
  trusted boolean not null default false,
  source text not null default 'community' check (source in ('community','news')),
  source_url text,
  location_confidence text,
  created_at timestamptz not null default now()
);
create index if not exists reports_occurred_at_idx on public.reports (occurred_at desc);
create index if not exists reports_trusted_idx on public.reports (trusted);
-- Unik per source_url — biar pipeline scraping bisa UPSERT (re-run aman, ga duplikat).
-- PostgreSQL treat NULL sebagai distinct, jadi community reports (source_url NULL)
-- ga konflik. PostgREST `on_conflict=source_url` butuh full unique index, bukan partial.
create unique index if not exists reports_source_url_uniq
  on public.reports (source_url);

-- ---------- KONFIRMASI KOMUNITAS ----------
create table if not exists public.report_confirmations (
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id) -- 1 user 1 konfirmasi per laporan
);

-- Saat ada konfirmasi → tambah hitungan; jadi trusted bila ≥ 3 atau ada bukti berita.
create or replace function public.bump_confirmations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reports
    set confirmations = confirmations + 1,
        trusted = (confirmations + 1 >= 3) or source = 'news' or source_url is not null
  where id = new.report_id;
  return new;
end; $$;

drop trigger if exists on_confirmation on public.report_confirmations;
create trigger on_confirmation
  after insert on public.report_confirmations
  for each row execute function public.bump_confirmations();

<<<<<<< HEAD
=======
-- ---------- TRIPS (pre-trip share + dead-man's switch) ----------
-- Tiap kali user mulai perjalanan, baris baru dimasukkan ke sini. NavigasiAktif
-- update kolom last_* tiap ~20 detik (heartbeat). Edge function `dead-man-check`
-- (cron tiap menit) bakal kirim Telegram ke kontak darurat kalau heartbeat hilang
-- > 2 menit & status masih 'active'.
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Token publik buat URL track, random ~32 char hex — hampir mustahil ditebak.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  origin_label text not null,
  origin_lat double precision not null,
  origin_lon double precision not null,
  dest_label text not null,
  dest_lat double precision not null,
  dest_lon double precision not null,

  status text not null default 'active'
    check (status in ('active','arrived','sos','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,

  -- Heartbeat terbaru (di-update dari NavigasiAktifScreen)
  last_lat double precision,
  last_lon double precision,
  last_battery smallint,
  last_heartbeat_at timestamptz,

  -- Kapan dead-man's switch sudah men-trigger auto-SOS (cegah spam).
  sos_sent_at timestamptz,

  created_at timestamptz not null default now()
);
create index if not exists trips_user_status_idx on public.trips (user_id, status);
create index if not exists trips_heartbeat_idx
  on public.trips (last_heartbeat_at)
  where status = 'active';

>>>>>>> origin/main
-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text not null default '',
  section text not null default 'HARI INI',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.reports enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.notifications enable row level security;
<<<<<<< HEAD
=======
alter table public.trips enable row level security;
>>>>>>> origin/main

-- (drop-if-exists di tiap policy supaya file ini aman di-run ulang.)

-- PROFILES: lihat semua, buat & edit milik sendiri.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- EMERGENCY CONTACTS: penuh untuk milik sendiri.
drop policy if exists "contacts own" on public.emergency_contacts;
create policy "contacts own" on public.emergency_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- REPORTS: semua bisa baca; user login bisa buat; pelapor bisa edit miliknya.
drop policy if exists "reports read" on public.reports;
create policy "reports read" on public.reports for select using (true);
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert
  with check (auth.uid() is not null);
drop policy if exists "reports update own" on public.reports;
create policy "reports update own" on public.reports for update
  using (auth.uid() = reporter_id);

-- KONFIRMASI: user login boleh konfirmasi (1x via PK), lihat semua.
drop policy if exists "confirm read" on public.report_confirmations;
create policy "confirm read" on public.report_confirmations for select using (true);
drop policy if exists "confirm insert" on public.report_confirmations;
create policy "confirm insert" on public.report_confirmations for insert
  with check (auth.uid() = user_id);

-- NOTIFICATIONS: hanya milik sendiri.
drop policy if exists "notif own" on public.notifications;
create policy "notif own" on public.notifications
  for select using (auth.uid() = user_id);
<<<<<<< HEAD
=======

-- TRIPS: owner CRUD penuh; tracking publik via RPC `get_trip_by_token`.
drop policy if exists "trips own" on public.trips;
create policy "trips own" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- RPC PUBLIK — track perjalanan via token (tanpa login)
-- ============================================================
-- Halaman /track/<token> di web pakai RPC ini lewat anon key. Hanya posisi
-- terakhir + label asal/tujuan yang dibalik, gak ada PII selain nama pengirim.
create or replace function public.get_trip_by_token(p_token text)
returns table(
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  origin_label text, origin_lat double precision, origin_lon double precision,
  dest_label text, dest_lat double precision, dest_lon double precision,
  last_lat double precision, last_lon double precision,
  last_battery smallint,
  last_heartbeat_at timestamptz,
  user_name text
)
language sql security definer set search_path = public
as $$
  select t.status, t.started_at, t.ended_at,
    t.origin_label, t.origin_lat, t.origin_lon,
    t.dest_label, t.dest_lat, t.dest_lon,
    t.last_lat, t.last_lon, t.last_battery, t.last_heartbeat_at,
    p.full_name as user_name
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.token = p_token
  limit 1;
$$;
grant execute on function public.get_trip_by_token(text) to anon, authenticated;

-- ============================================================
-- DEAD-MAN'S SWITCH — pg_cron (jalankan terpisah, butuh extension)
-- ============================================================
-- Aktifkan di Database → Extensions: pg_cron + pg_net.
-- Lalu jadwalkan edge function `dead-man-check` tiap menit:
--
--   select cron.schedule(
--     'dead-man-check', '* * * * *',
--     $$ select net.http_post(
--       url := 'https://<PROJECT>.supabase.co/functions/v1/dead-man-check',
--       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
--     ); $$
--   );
>>>>>>> origin/main
