-- CaseX Pricing Calculator — security hardening
-- Run this in the SQL editor of the CaseX Supabase project.
-- Every statement is additive and safe to run on live data.

-- =========================================================================
-- 1. Block role self-escalation (audit finding C-1)
-- -------------------------------------------------------------------------
-- `profiles.role` decides who can see pricing. The update policy on
-- `profiles` lets a user update their own row, which means a user could
-- PATCH themselves to `estimator` or `admin` straight from the browser.
-- This trigger makes the column immutable for everyone except a service-role
-- (server-side / admin) connection.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Role changes must be performed by an administrator'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_immutable ON public.profiles;
CREATE TRIGGER profiles_role_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Also make sure new signups can never insert a privileged role.
CREATE OR REPLACE FUNCTION public.force_external_role_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role'
     AND NEW.role IS DISTINCT FROM 'external'
  THEN
    NEW.role := 'external';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_default_external ON public.profiles;
CREATE TRIGGER profiles_role_default_external
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.force_external_role_on_insert();

-- =========================================================================
-- 2. Keep pricing columns away from external users (audit finding C-2)
-- -------------------------------------------------------------------------
-- The app now requests an explicit safe column list for external users, but
-- column-level privileges enforce it even if a user calls the API directly.
-- Requires that `anon`/`authenticated` do not already hold a table-wide
-- SELECT grant on quotes.
-- =========================================================================

-- Inspect the current grants first:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'quotes';
--
-- Then, if you want DB-level enforcement, replace the blanket grant with a
-- column list (uncomment after confirming the column names):
--
-- REVOKE SELECT ON public.quotes FROM authenticated;
-- GRANT SELECT (
--   id, owner_id, requested_by, reviewed_by, approved_by, name,
--   customer_name, customer_email, customer_type, compliance, vertical,
--   solution, repeatable_activation, module_tier, contract_years,
--   target_go_live_date, case_worker_count, include_b2c, b2c_mau,
--   include_b2b_portal, b2b_user_count, hosting_model, environment_count,
--   has_integrations, integration_count, integration_difficulty,
--   support_tier, tier, state, submitted_at, approved_at, sent_at,
--   created_at, updated_at, margin_percent, margin_justification,
--   rep_confidence
-- ) ON public.quotes TO authenticated;
--
-- NOTE: column grants are role-wide, not per-user, so this only helps if you
-- split external users onto a separate Postgres role. The practical
-- enforcement for a single `authenticated` role is an RLS-friendly view or
-- the app-side projection that ships in `src/lib/quote-columns.ts`.

-- =========================================================================
-- 3. Verify pricing catalog exposure
-- -------------------------------------------------------------------------
-- Confirm which roles can read rate cards; external users should not be able
-- to read `unit_price` in bulk.
-- =========================================================================
-- SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid)
-- FROM pg_policy WHERE polrelid = 'public.pricing_catalog'::regclass;
