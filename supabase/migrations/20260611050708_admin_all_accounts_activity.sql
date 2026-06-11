create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "admins_read_org_results" on public.exam_results;
drop policy if exists "admins_read_all_results" on public.exam_results;
create policy "admins_read_all_results" on public.exam_results
  for select
  to authenticated
  using ((select private.is_admin()));

drop function if exists public.is_admin();
