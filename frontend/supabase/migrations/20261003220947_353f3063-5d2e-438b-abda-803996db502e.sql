create type public.app_role as enum ('admin', 'member', 'viewer');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, created_at timestamptz not null default now(), unique (user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "Read own or admin reads all roles" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- first user to sign up becomes admin, everyone else member
create or replace function public.handle_new_user_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, case when not exists (select 1 from public.user_roles where role='admin') then 'admin'::app_role else 'member'::app_role end);
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();
insert into public.user_roles(user_id, role) select id, case when row_number() over (order by created_at)=1 then 'admin'::app_role else 'member'::app_role end from auth.users on conflict do nothing;
create policy "Admins delete any comment" on public.rule_comments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.portfolio_groups (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), name text not null, address_ids text[] not null default '{}', created_at timestamptz not null default now());
grant select, insert, update, delete on public.portfolio_groups to authenticated;
grant all on public.portfolio_groups to service_role;
alter table public.portfolio_groups enable row level security;
create policy "Own groups" on public.portfolio_groups for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table public.recheck_schedules (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), address_id text not null, frequency text not null default 'daily', last_run_at timestamptz, last_summary jsonb, last_changed boolean not null default false, created_at timestamptz not null default now(), unique(user_id, address_id));
grant select, insert, update, delete on public.recheck_schedules to authenticated;
grant all on public.recheck_schedules to service_role;
alter table public.recheck_schedules enable row level security;
create policy "Own schedules" on public.recheck_schedules for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table public.api_keys (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), label text not null, prefix text not null, key_hash text not null unique, last_used_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now());
grant select, insert, update on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;
create policy "Own keys read" on public.api_keys for select to authenticated using (auth.uid()=user_id);
create policy "Members create keys" on public.api_keys for insert to authenticated with check (auth.uid()=user_id and not public.has_role(auth.uid(),'viewer'));
create policy "Own keys revoke" on public.api_keys for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table public.webhooks (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), url text not null, secret text not null, enabled boolean not null default true, last_status int, last_sent_at timestamptz, created_at timestamptz not null default now());
grant select, insert, update, delete on public.webhooks to authenticated;
grant all on public.webhooks to service_role;
alter table public.webhooks enable row level security;
create policy "Own webhooks" on public.webhooks for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);