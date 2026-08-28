import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isTurnstileEnabled } from "@/lib/turnstile";
import { TurnstileWidget } from "@/features/lead-intake/TurnstileWidget";
import { LeadIntakeForm, type LeadIntakeValues } from "@/features/lead-intake/LeadIntakeForm";

/** Internal staff belong in the authenticated intake, not the public form. */
const INTERNAL_ROLES = ["sales_rep", "estimator", "admin"] as const;

export const Route = createFileRoute("/get-a-quote")({
  head: () => ({
    meta: [
      { title: "Get a quote — CaseXellence by Speridian" },
      {
        name: "description",
        content:
          "Tell us about your case management needs and a Speridian specialist will follow up with next steps.",
      },
      { property: "og:title", content: "Get a quote — CaseXellence by Speridian" },
      {
        property: "og:description",
        content: "Share your requirements and our team will get back to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetAQuotePage,
});

function GetAQuotePage() {
  const { session, role, anonymousSignIn } = useAuth();
  const navigate = useNavigate();
  const isInternal = role !== null && (INTERNAL_ROLES as readonly string[]).includes(role);
  const [sessionReady, setSessionReady] = useState(Boolean(session));
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [leadNumber, setLeadNumber] = useState<string | null>(null);

  // Internal staff never touch the anonymous path — send them to the
  // authenticated intake before any sign-in happens.
  useEffect(() => {
    if (isInternal) void navigate({ to: "/request-quote", replace: true });
  }, [isInternal, navigate]);

  useEffect(() => {
    if (isInternal) return;
    let active = true;
    if (session) {
      setSessionReady(true);
      return;
    }
    // With Turnstile configured we wait for a solved challenge before
    // creating the anonymous session.
    if (isTurnstileEnabled && !captchaToken) return;

    void anonymousSignIn(captchaToken ?? undefined).then((next) => {
      if (!active) return;
      if (!next) {
        setCaptchaToken(null);
        toast.error("We couldn't start your request. Please refresh and try again.");
        return;
      }
      setSessionReady(true);
    });
    return () => {
      active = false;
    };
    // anonymousSignIn is stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, captchaToken, isInternal]);

  const handleSubmit = async (values: LeadIntakeValues) => {
    const { data: current } = await supabase.auth.getSession();
    const userId = current.session?.user.id;
    if (!userId) {
      toast.error("Your session expired. Please refresh and try again.");
      return;
    }

    const id = crypto.randomUUID();
    // Only submitter-provided fields — internal workflow columns (status,
    // scoring, routing) are set by the database trigger.
    const { error } = await supabase.from("lead_intakes").insert({
      id,
      submitted_by_anon_id: userId,
      organization_name: values.organization_name,
      contact_name: values.contact_name,
      contact_email: values.contact_email,
      contact_phone: values.contact_phone || null,
      region: values.region || null,
      vertical: values.vertical || null,
      solution: values.solution || null,
      internal_user_range: values.internal_user_range || null,
      external_portal_required: values.external_portal_required,
      external_portal_monthly_logins_range:
        values.external_portal_monthly_logins_range || null,
      b2b_portal_required: values.b2b_portal_required,
      b2b_user_count_range: values.b2b_user_count_range || null,
      hosting_preference: values.hosting_preference || null,
      compliance_requirements: values.compliance_requirements,
      integration_required: values.integration_required,
      integration_count_range: values.integration_count_range || null,
      integration_difficulty: values.integration_difficulty || null,
      additional_notes: values.additional_notes || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    const { data } = await supabase
      .from("lead_intakes")
      .select("lead_number")
      .eq("id", id)
      .maybeSingle();

    setLeadNumber(data?.lead_number ?? id.slice(0, 8).toUpperCase());
  };

  if (leadNumber) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-brand" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Thanks — we've got your request
          </h1>
          <p className="text-sm text-muted-foreground">
            Your reference number is{" "}
            <strong className="font-mono" data-testid="lead-number">
              {leadNumber}
            </strong>
            . Please keep it handy.
          </p>
          <p className="text-sm text-muted-foreground">
            A Speridian specialist will review what you shared and reach out by email within two
            business days to talk through your requirements and next steps. No action is needed
            from you in the meantime.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Get a quote</h1>
        <p className="text-sm text-muted-foreground">
          A few quick questions so our team can prepare the right recommendation. Takes about two
          minutes.
        </p>
      </header>
      {sessionReady || (isTurnstileEnabled && !captchaToken) ? null : (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing your form…
        </p>
      )}
      <LeadIntakeForm
        onSubmit={handleSubmit}
        disabled={!sessionReady}
        firstStepSlot={
          sessionReady ? null : (
            <TurnstileWidget
              onToken={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />
          )
        }
      />
    </main>
  );
}
