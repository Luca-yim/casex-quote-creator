import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LEAD_STATUS_LABELS } from "./types";
import type { Lead } from "./lead-mapper";
import { useVerticalLabels } from "@/hooks/useVerticalLabels";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import {
  COMPLIANCE_OPTIONS,
  HOSTING_PREFERENCES,
  INTEGRATION_DIFFICULTY,
} from "@/features/lead-intake/lead-intake-options";

/** Maps a stored code to its friendly label, falling back to the raw value. */
function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null,
): string {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function dateFmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <Separator className="my-2" />
      <dl>{children}</dl>
    </section>
  );
}

/** Read-only view of every field captured on a public lead intake. */
export function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { options: verticalOptions } = useVerticalLabels();
  const { data: verticalSolutions } = useVerticalSolutions();

  const verticalLabel = labelFor(verticalOptions, lead.vertical);
  const solutionLabel = lead.solution
    ? ((verticalSolutions ?? []).find(
        (row) => row.vertical_l1 === lead.vertical && row.solution_l2 === lead.solution,
      )?.display_label ?? lead.solution)
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.organizationName || "Lead details"}
            <Badge variant="secondary">
              {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {lead.leadNumber ? `Lead ${lead.leadNumber}` : "Submitted lead"} — read only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Group title="Contact">
            <Row label="Organization" value={fmt(lead.organizationName)} />
            <Row label="Contact name" value={fmt(lead.contactName)} />
            <Row label="Email" value={fmt(lead.contactEmail)} />
            <Row label="Phone" value={fmt(lead.contactPhone)} />
          </Group>

          <Group title="Region & solution">
            <Row label="Region" value={fmt(lead.region)} />
            <Row label="Vertical" value={fmt(lead.vertical)} />
            <Row label="Vertical detail" value={fmt(lead.verticalOtherDetail)} />
            <Row label="Solution" value={fmt(lead.solution)} />
          </Group>

          <Group title="Scope">
            <Row label="Internal users" value={fmt(lead.internalUserCount)} />
            <Row label="External portal" value={fmt(lead.externalPortalRequired)} />
            <Row
              label="Monthly portal logins"
              value={fmt(lead.externalPortalMonthlyLogins)}
            />
            <Row label="B2B portal" value={fmt(lead.b2bPortalRequired)} />
            <Row label="B2B users" value={fmt(lead.b2bUserCount)} />
          </Group>

          <Group title="Compliance & hosting">
            <Row
              label="Compliance"
              value={
                lead.complianceRequirements.length
                  ? lead.complianceRequirements.join(", ")
                  : "—"
              }
            />
            <Row label="Hosting preference" value={fmt(lead.hostingPreference)} />
          </Group>

          <Group title="Integrations">
            <Row label="Integrations needed" value={fmt(lead.integrationRequired)} />
            <Row label="Integration count" value={fmt(lead.integrationCount)} />
            <Row label="Difficulty" value={fmt(lead.integrationDifficulty)} />
          </Group>

          <Group title="Notes">
            <Row label="Additional notes" value={fmt(lead.additionalNotes)} />
          </Group>

          <Group title="Internal">
            <Row label="Status" value={LEAD_STATUS_LABELS[lead.status] ?? lead.status} />
            <Row label="Lead score" value={fmt(lead.leadScore)} />
            <Row label="Score label" value={fmt(lead.leadScoreLabel)} />
            <Row label="Confidence" value={lead.confidencePct === null ? "—" : `${lead.confidencePct}%`} />
            <Row label="Assigned rep" value={fmt(lead.assignedRepId)} />
            <Row label="Claimed by" value={fmt(lead.claimedBy)} />
            <Row label="Claimed at" value={dateFmt(lead.claimedAt)} />
            <Row label="Duplicate of" value={fmt(lead.duplicateOfLeadId)} />
            <Row label="Converted quote" value={fmt(lead.convertedQuoteId)} />
            <Row label="Submitted" value={dateFmt(lead.submittedAt)} />
            <Row label="Created" value={dateFmt(lead.createdAt)} />
            <Row label="Updated" value={dateFmt(lead.updatedAt)} />
            <Row label="Lead ID" value={lead.id} />
          </Group>
        </div>
      </DialogContent>
    </Dialog>
  );
}
