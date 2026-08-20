CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select case
    when _user_id is distinct from auth.uid()
         and coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role'
      then false
    else exists (
      select 1 from public.user_roles
      where user_id = _user_id and role = _role
    )
  end
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;