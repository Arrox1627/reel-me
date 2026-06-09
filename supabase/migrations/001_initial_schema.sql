-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  reminder_time   text not null default '08:00',  -- HH:MM
  timezone        text not null default 'UTC',
  default_pose    text not null default 'front' check (default_pose in ('front','side','back')),
  notifications_enabled boolean not null default true,
  local_only_mode boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PHOTOS
-- ============================================================
create table if not exists public.photos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  pose         text not null default 'front' check (pose in ('front','side','back')),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  unique(user_id, date, pose)
);

create index if not exists photos_user_date_idx on public.photos(user_id, date);
create index if not exists photos_user_pose_idx on public.photos(user_id, pose);

alter table public.photos enable row level security;

create policy "Users can view own photos"
  on public.photos for select
  using (auth.uid() = user_id);

create policy "Users can insert own photos"
  on public.photos for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own photos"
  on public.photos for delete
  using (auth.uid() = user_id);

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================
create table if not exists public.push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subscription text not null,
  created_at   timestamptz not null default now(),
  unique(user_id)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all (for sending notifications)
create policy "Service role can read all subscriptions"
  on public.push_subscriptions for select
  to service_role
  using (true);

-- ============================================================
-- STORAGE BUCKET: photos (private)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  5242880,  -- 5MB per file
  array['image/jpeg','image/png','image/webp']
) on conflict (id) do nothing;

-- RLS on storage: users can only access their own folder
create policy "Users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
