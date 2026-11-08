-- OAuth users and existing password users always have a valid customer profile.
-- Run after 01_schema.sql and 04_rls.sql in Supabase SQL Editor.
begin;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, branch_id)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(new.email, '@', 1), ''), 'Khách hàng'), 'customer', null)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Repair only missing/blank names. Never derive privileges from user-editable metadata.
insert into public.profiles (id, full_name, role, branch_id)
select u.id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), nullif(split_part(u.email, '@', 1), ''), 'Khách hàng'), 'customer', null
from auth.users u
on conflict (id) do update set full_name = excluded.full_name
  where nullif(btrim(profiles.full_name), '') is null;

-- Safe recovery for an authenticated user's missing profile. No id/role arguments.
create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_profile public.profiles;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.profiles (id, full_name, role, branch_id)
  select u.id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), nullif(split_part(u.email, '@', 1), ''), 'Khách hàng'), 'customer', null
  from auth.users u where u.id = v_user
  on conflict (id) do update set full_name = excluded.full_name
    where nullif(btrim(profiles.full_name), '') is null;
  select * into v_profile from public.profiles where id = v_user;
  if v_profile.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  return v_profile;
end;
$$;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
notify pgrst, 'reload schema';
commit;
