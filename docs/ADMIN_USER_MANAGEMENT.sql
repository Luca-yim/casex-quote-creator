-- CaseX — Admin user management
-- Run once in the SQL editor. Idempotent.

-- 1) Deactivation flag used by the app-wide lockout banner.
alter table public.profiles
  add column if not exists deactivated_at timestamptz;

-- 2) Admins can read every profile (existing policy already allows estimators/admins,
--    kept here for completeness/idempotency).
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- 3) Admins can update other users' profiles (role + deactivated_at).
drop policy if exists "Admins can update other profiles" on public.profiles;
create policy "Admins can update other profiles"
on public.profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 4) Nobody — not even an admin — may change their OWN role or deactivate themselves.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role';
    end if;
    if new.deactivated_at is distinct from old.deactivated_at then
      raise exception 'You cannot change your own account status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_change on public.profiles;
create trigger profiles_prevent_self_role_change
before update on public.profiles
for each row execute function public.prevent_self_role_change();

-- 5) Grants (no-op if already present).
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
