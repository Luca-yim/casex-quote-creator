-- Section 1 (Quote Metadata) — ROLLBACK MIGRATION
-- Restores the exact captured public.quotes_scoped() definition, then removes
-- the three constraints and four columns. Dependency-safe order: the function
-- stops referencing the columns before the columns are dropped. No CASCADE.
-- Transactional. Does not touch RLS policies, Phase 1A objects, pricing
-- behaviour, contingency masking, Proposal workflow, PDFs, Excel or realtime.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Restore the captured original function (verbatim capture output)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.quotes_scoped();

CREATE FUNCTION public.quotes_scoped()
 RETURNS TABLE(id uuid, owner_id uuid, requested_by uuid, reviewed_by uuid, approved_by uuid, last_reviewed_by uuid, name text, customer_name text, customer_type text, customer_email text, compliance text[], vertical text, solution text, vertical_other_detail text, repeatable_activation text, module_tier text, contract_years integer, expected_award_date date, case_worker_count integer, include_b2c boolean, b2c_mau integer, include_b2b_portal boolean, b2b_user_count integer, hosting_model text, environment_count integer, has_integrations boolean, integration_count integer, integration_difficulty text, support_tier text, rep_confidence text, tier text, state text, submitted_at timestamp with time zone, approved_at timestamp with time zone, sent_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, margin_percent integer, margin_justification text, contingency_pct numeric, converted_from_lead_id uuid, converted_from_lead_notes text, migration_required boolean, migration_volume_range text, migration_cleanup_required boolean, external_idp_required boolean, worker_idp_required boolean, idp_documented boolean, portal_form_count_range text, lead_id uuid, needs_attention boolean, integrations jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    q.id, q.owner_id, q.requested_by, q.reviewed_by, q.approved_by, q.last_reviewed_by,
    q.name, q.customer_name, q.customer_type, q.customer_email,
    q.compliance, q.vertical, q.solution, q.vertical_other_detail,
    q.repeatable_activation, q.module_tier, q.contract_years,
    q.expected_award_date, q.case_worker_count,
    q.include_b2c, q.b2c_mau, q.include_b2b_portal, q.b2b_user_count,
    q.hosting_model, q.environment_count,
    q.has_integrations, q.integration_count, q.integration_difficulty,
    q.support_tier, q.rep_confidence,
    q.tier, q.state,
    q.submitted_at, q.approved_at, q.sent_at, q.created_at, q.updated_at,
    case
      when public.current_user_role() in ('estimator','admin') then q.margin_percent
      when auth.uid() = q.owner_id and q.state in ('approved','sent_to_customer','accepted','declined')
        then q.margin_percent
      else null
    end,
    case
      when public.current_user_role() in ('estimator','admin') then q.margin_justification
      else null
    end,
    q.contingency_pct,
    q.converted_from_lead_id, q.converted_from_lead_notes,
    q.migration_required, q.migration_volume_range, q.migration_cleanup_required,
    q.external_idp_required, q.worker_idp_required, q.idp_documented,
    q.portal_form_count_range,
    q.lead_id,
    q.needs_attention,
    q.integrations
  from public.quotes q
  where
    (q.state = 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'sales_rep' and q.state <> 'draft' and q.owner_id = auth.uid())
    or (public.current_user_role() = 'external' and q.state <> 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'admin' and q.state <> 'draft')
    or (public.current_user_role() = 'estimator' and q.state <> 'draft'
        and (q.state <> 'under_review' or q.reviewed_by = auth.uid()))
$function$;

ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quotes_scoped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO postgres;

-- ---------------------------------------------------------------------------
-- 2. Drop constraints, then columns (no CASCADE)
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_opportunity_stage_check;
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_deal_priority_check;
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_deal_template_check;

ALTER TABLE public.quotes DROP COLUMN IF EXISTS opportunity_stage;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS deal_priority;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS deal_template;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS quote_validity_date;

COMMIT;

NOTIFY pgrst, 'reload schema';
