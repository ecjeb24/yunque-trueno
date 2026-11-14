-- Yunque Gym: shared authentication and data schema.
-- Run this once in the SQL editor of the dedicated Yunque Supabase project.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gym_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  profile_photo text not null default '',
  role text not null default 'gymbro' check (role in ('gymbro','staff')),
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gym_profiles add column if not exists profile_photo text not null default '';

create table if not exists public.gym_config (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{"initialized":false,"activities":["HIIT","Yoga","Semi personalizado","Personalizado","Libre"],"branches":["Sede Centro","Sede Norte"],"sessions":[["07:00","HIIT","Sede Centro · Sala 2","Camila Ríos","12/16","red"],["08:30","Yoga","Sede Norte · Terraza","Nicolás Vidal","7/12","purple"],["18:00","Semi personalizado","Sede Centro · Box 1","Tomás Méndez","4/6","blue"],["19:30","HIIT","Sede Centro · Sala 2","Camila Ríos","15/16","red"]],"blockedSlots":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.gym_config(id,data) values (1,'{"initialized":false,"activities":["HIIT","Yoga","Semi personalizado","Personalizado","Libre"],"branches":["Sede Centro","Sede Norte"],"sessions":[["07:00","HIIT","Sede Centro · Sala 2","Camila Ríos","12/16","red"],["08:30","Yoga","Sede Norte · Terraza","Nicolás Vidal","7/12","purple"],["18:00","Semi personalizado","Sede Centro · Box 1","Tomás Méndez","4/6","blue"],["19:30","HIIT","Sede Centro · Sala 2","Camila Ríos","15/16","red"]],"blockedSlots":{}}'::jsonb) on conflict do nothing;

create table if not exists public.gym_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  session_data jsonb not null,
  attendance boolean,
  created_at timestamptz not null default now()
);
create index if not exists gym_reservations_user_date_idx on public.gym_reservations(user_id, class_date desc);

create table if not exists public.gym_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gym_credit_ledger_user_date_idx on public.gym_credit_ledger(user_id, created_at desc);

create table if not exists public.gym_staff_pin (
  id integer primary key default 1 check (id = 1),
  pin_hash text not null
);
insert into public.gym_staff_pin(id, pin_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create table if not exists public.gym_staff_pin_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  failures integer not null default 0
);

create or replace function public.handle_new_gym_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gym_profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), coalesce(new.email,''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_yunque on auth.users;
create trigger on_auth_user_created_yunque
  after insert on auth.users for each row execute procedure public.handle_new_gym_user();

create or replace function public.handle_updated_gym_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.gym_profiles
  set email = coalesce(new.email,''),
      full_name = coalesce(new.raw_user_meta_data ->> 'full_name',full_name),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_updated_yunque on auth.users;
create trigger on_auth_user_updated_yunque
  after update of email, raw_user_meta_data on auth.users for each row execute procedure public.handle_updated_gym_user();

create or replace function public.authorize_gym_staff(p_pin text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.gym_staff_pin_attempts%rowtype;
  v_hash text;
begin
  if v_user is null then return false; end if;
  select * into v_attempt from public.gym_staff_pin_attempts where user_id = v_user for update;
  if found and v_attempt.window_started_at > now() - interval '1 hour' and v_attempt.failures >= 5 then
    return false;
  end if;
  select pin_hash into v_hash from public.gym_staff_pin where id = 1;
  if v_hash is not null and extensions.crypt(coalesce(p_pin,''), v_hash) = v_hash then
    update public.gym_profiles set role = 'staff', updated_at = now() where id = v_user;
    delete from public.gym_staff_pin_attempts where user_id = v_user;
    return true;
  end if;
  insert into public.gym_staff_pin_attempts(user_id, window_started_at, failures)
  values (v_user, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case when public.gym_staff_pin_attempts.window_started_at <= now() - interval '1 hour' then now() else public.gym_staff_pin_attempts.window_started_at end,
    failures = case when public.gym_staff_pin_attempts.window_started_at <= now() - interval '1 hour' then 1 else public.gym_staff_pin_attempts.failures + 1 end;
  return false;
end;
$$;

create or replace function public.book_gym_class(p_session jsonb, p_class_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_branch text := split_part(coalesce(p_session->>2,''), ' · ', 1);
  v_schedule jsonb;
begin
  if v_user is null then raise exception 'Iniciá sesión para reservar.'; end if;
  select data into v_schedule from public.gym_config where id = 1;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(v_schedule->'branches','[]'::jsonb)) b where lower(b) = lower(v_branch)) then
    raise exception 'La sucursal de este turno ya no existe.';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(v_schedule->'sessions','[]'::jsonb)) s where s->>0 = p_session->>0 and s->>1 = p_session->>1 and lower(split_part(s->>2,' · ',1)) = lower(v_branch) and s->>3 = p_session->>3) is false then
    raise exception 'Este horario ya no está disponible.';
  end if;
  update public.gym_profiles set credits = credits - 1, updated_at = now() where id = v_user and credits > 0;
  if not found then raise exception 'No tenés créditos disponibles.'; end if;
  insert into public.gym_reservations(user_id, class_date, session_data) values (v_user, p_class_date, p_session) returning id into v_id;
  insert into public.gym_credit_ledger(user_id, amount, description, created_by) values (v_user, -1, coalesce(p_session->>1,'Clase'), v_user);
  return v_id;
end;
$$;

create or replace function public.grant_gym_credits(p_user_id uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_balance integer;
begin
  if not exists (select 1 from public.gym_profiles where id = auth.uid() and role = 'staff') then raise exception 'Acceso denegado.'; end if;
  if p_amount < 1 or p_amount > 1000 then raise exception 'Cantidad inválida.'; end if;
  update public.gym_profiles set credits = credits + p_amount, updated_at = now() where id = p_user_id returning credits into v_balance;
  if not found then raise exception 'Cuenta no encontrada.'; end if;
  insert into public.gym_credit_ledger(user_id, amount, description, created_by) values (p_user_id, p_amount, 'Carga de créditos', auth.uid());
  return v_balance;
end;
$$;

create or replace function public.save_gym_config(p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_gym_staff() then raise exception 'Acceso denegado.'; end if;
  update public.gym_config set data = p_data || jsonb_build_object('initialized',true), updated_at = now() where id = 1;
  delete from public.gym_reservations r
  where not exists (
    select 1 from jsonb_array_elements_text(coalesce(p_data->'branches','[]'::jsonb)) b
    where lower(b) = lower(split_part(coalesce(r.session_data->>2,''),' · ',1))
  ) or not exists (
    select 1 from jsonb_array_elements_text(coalesce(p_data->'activities','[]'::jsonb)) a
    where a = coalesce(r.session_data->>1,'')
  );
end;
$$;

alter table public.gym_profiles enable row level security;
alter table public.gym_config enable row level security;
alter table public.gym_reservations enable row level security;
alter table public.gym_credit_ledger enable row level security;
alter table public.gym_staff_pin enable row level security;
alter table public.gym_staff_pin_attempts enable row level security;
grant usage on schema public to authenticated;
grant select, update on public.gym_profiles to authenticated;
grant select, insert, update, delete on public.gym_config to authenticated;
grant select, update, delete on public.gym_reservations to authenticated;
grant select on public.gym_credit_ledger to authenticated;

create or replace function public.is_gym_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.gym_profiles where id = auth.uid() and role = 'staff');
$$;
revoke all on function public.is_gym_staff() from public;
grant execute on function public.is_gym_staff() to authenticated;

drop policy if exists gym_profiles_read_self_or_staff on public.gym_profiles;
create policy gym_profiles_read_self_or_staff on public.gym_profiles for select to authenticated
using (id = auth.uid() or public.is_gym_staff());
drop policy if exists gym_profiles_update_self on public.gym_profiles;
create policy gym_profiles_update_self on public.gym_profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.gym_profiles from authenticated;
grant update(full_name, updated_at) on public.gym_profiles to authenticated;
grant update(profile_photo) on public.gym_profiles to authenticated;

drop policy if exists gym_config_read_authenticated on public.gym_config;
create policy gym_config_read_authenticated on public.gym_config for select to authenticated using (true);
drop policy if exists gym_config_staff_write on public.gym_config;
create policy gym_config_staff_write on public.gym_config for all to authenticated
using (public.is_gym_staff())
with check (public.is_gym_staff());

drop policy if exists gym_reservations_read_owner_or_staff on public.gym_reservations;
create policy gym_reservations_read_owner_or_staff on public.gym_reservations for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff());
drop policy if exists gym_reservations_update_owner_or_staff on public.gym_reservations;
create policy gym_reservations_update_owner_or_staff on public.gym_reservations for update to authenticated
using (user_id = auth.uid() or public.is_gym_staff())
with check (user_id = auth.uid() or public.is_gym_staff());
revoke update on public.gym_reservations from authenticated;
grant update(attendance) on public.gym_reservations to authenticated;
drop policy if exists gym_reservations_delete_staff on public.gym_reservations;
create policy gym_reservations_delete_staff on public.gym_reservations for delete to authenticated
using (public.is_gym_staff());

drop policy if exists gym_credit_ledger_read_owner_or_staff on public.gym_credit_ledger;
create policy gym_credit_ledger_read_owner_or_staff on public.gym_credit_ledger for select to authenticated
using (user_id = auth.uid() or public.is_gym_staff());

revoke all on public.gym_staff_pin, public.gym_staff_pin_attempts from anon, authenticated;
revoke all on function public.authorize_gym_staff(text) from public;
grant execute on function public.authorize_gym_staff(text) to authenticated;
revoke all on function public.book_gym_class(jsonb,date) from public;
grant execute on function public.book_gym_class(jsonb,date) to authenticated;
revoke all on function public.grant_gym_credits(uuid,integer) from public;
grant execute on function public.grant_gym_credits(uuid,integer) to authenticated;
revoke all on function public.save_gym_config(jsonb) from public;
grant execute on function public.save_gym_config(jsonb) to authenticated;

