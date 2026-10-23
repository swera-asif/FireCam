-- FireCam schema for Supabase (free tier). Run this in the SQL editor of a new project,
-- or with `supabase db push`. Every row is protected by row-level security: a user can only
-- see homes they are a member of, and only their own push subscriptions.

create extension if not exists pgcrypto;

create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My home',
  data jsonb not null default '{}'::jsonb,          -- preferences, rooms, family, lastTest, setupDone
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.home_members (
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'family' check (role in ('owner','family')),
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (home_id, user_id)
);

create table if not exists public.invites (
  code text primary key,
  home_id uuid not null references public.homes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id),
  used_at timestamptz
);

create table if not exists public.alerts (
  id text primary key,
  home_id uuid not null references public.homes(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','closed')),
  data jsonb not null,                               -- the alert object used by the app
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists alerts_home_created on public.alerts (home_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  home_id uuid not null references public.homes(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,                       -- PushSubscription.toJSON()
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_home on public.push_subscriptions (home_id);

-- ---------------------------------------------------------------------------------------------
-- Helpers (security definer so policies can consult membership without recursion)
create or replace function public.is_home_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.home_members m where m.home_id = h and m.user_id = auth.uid());
$$;

create or replace function public.create_home(home_name text default 'My home') returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.homes (owner_id, name) values (auth.uid(), coalesce(nullif(trim(home_name), ''), 'My home')) returning id into new_id;
  insert into public.home_members (home_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

create or replace function public.create_invite(h uuid) returns text
language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if not public.is_home_member(h) then raise exception 'not a member'; end if;
  -- 6 characters, no ambiguous letters; easy to read out over the phone
  new_code := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1Il', 'ABCDEFGH'), 1, 6));
  insert into public.invites (code, home_id, created_by) values (new_code, h, auth.uid());
  return new_code;
end $$;

create or replace function public.join_home(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(trim(invite_code)) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then raise exception 'This code is not valid any more.'; end if;
  insert into public.home_members (home_id, user_id, role) values (inv.home_id, auth.uid(), 'family')
    on conflict (home_id, user_id) do nothing;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.home_id;
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists homes_touch on public.homes;
create trigger homes_touch before update on public.homes for each row execute function public.touch_updated_at();
drop trigger if exists alerts_touch on public.alerts;
create trigger alerts_touch before update on public.alerts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row-level security
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.invites enable row level security;
alter table public.alerts enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists homes_select on public.homes;
create policy homes_select on public.homes for select using (public.is_home_member(id));
drop policy if exists homes_update on public.homes;
create policy homes_update on public.homes for update using (public.is_home_member(id)) with check (public.is_home_member(id));
drop policy if exists homes_delete on public.homes;
create policy homes_delete on public.homes for delete using (owner_id = auth.uid());

drop policy if exists members_select on public.home_members;
create policy members_select on public.home_members for select using (public.is_home_member(home_id));
drop policy if exists members_delete on public.home_members;
create policy members_delete on public.home_members for delete
  using (user_id = auth.uid() or exists (select 1 from public.homes h where h.id = home_id and h.owner_id = auth.uid()));
drop policy if exists members_update on public.home_members;
create policy members_update on public.home_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select using (public.is_home_member(home_id));

drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select using (public.is_home_member(home_id));
drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts for insert with check (public.is_home_member(home_id));
drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts for update using (public.is_home_member(home_id)) with check (public.is_home_member(home_id));

drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_home_member(home_id));

-- Realtime: family devices watch alerts and the home document.
do $$ begin
  alter publication supabase_realtime add table public.alerts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.homes;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.homes, public.home_members, public.invites, public.alerts, public.push_subscriptions to authenticated;
grant execute on function public.create_home(text), public.create_invite(uuid), public.join_home(text), public.is_home_member(uuid) to authenticated;
