import { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Eye,
  Files,
  MoreHorizontal,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useAssignableOwners, ownerOptionLabel } from "@/hooks/useAssignableOwners";
import { canClaimLead, canConvertLead, canPerformLeadAction } from "./permissions";
import { useLeadActions } from "./useLeadActions";
import { useConvertLeadToQuote } from "./useConvertLeadToQuote";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import type { Lead } from "./lead-mapper";

/**
 * Per-row action menu for the lead queue.
 *
 * Visibility is UX gating on top of `internal_updates_lead` — see
 * `permissions.ts` for why assign and duplicate are narrower than the policy.
 */
export function LeadRowActions({
  lead,
  otherLeads,
}: {
  lead: Lead;
  /** Candidate originals for "mark duplicate", excluding this lead. */
  otherLeads: Lead[];
}) {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const { claim, assign, setStatus, markDuplicate } = useLeadActions();
  const convert = useConvertLeadToQuote();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [repId, setRepId] = useState("");
  const [originalId, setOriginalId] = useState("");
  const owners = useAssignableOwners(assignOpen);

  const showClaim = canClaimLead(role, lead);
  const showAssign = canPerformLeadAction(role, "assign");
  const showQualify = canPerformLeadAction(role, "qualify");
  const showDisqualify = canPerformLeadAction(role, "disqualify");
  const showDuplicate = canPerformLeadAction(role, "duplicate");
  const showConvert = canConvertLead(role, lead, user?.id ?? null);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(lead.id);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy lead ID");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Lead actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <Eye className="mr-2 size-4" /> View details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {showClaim ? (
            <DropdownMenuItem
              disabled={claim.isPending}
              onClick={() => claim.mutate(lead.id)}
            >
              <UserPlus className="mr-2 size-4" /> Claim lead
            </DropdownMenuItem>
          ) : null}
          {showAssign ? (
            <DropdownMenuItem onClick={() => setAssignOpen(true)}>
              <UserPlus className="mr-2 size-4" /> Assign to rep
            </DropdownMenuItem>
          ) : null}
          {showConvert ? (
            <DropdownMenuItem
              disabled={convert.isPending}
              onClick={() =>
                convert.mutate(lead, {
                  onSuccess: (quoteId) =>
                    void navigate({ to: "/quotes/$id", params: { id: quoteId } }),
                })
              }
            >
              <ArrowRightLeft className="mr-2 size-4" /> Convert to Ballpark
            </DropdownMenuItem>
          ) : null}
          {showClaim || showAssign || showConvert ? <DropdownMenuSeparator /> : null}
          {showQualify ? (
            <DropdownMenuItem
              disabled={setStatus.isPending || lead.status === "qualified"}
              onClick={() => setStatus.mutate({ leadId: lead.id, status: "qualified" })}
            >
              <CheckCircle2 className="mr-2 size-4" /> Qualify
            </DropdownMenuItem>
          ) : null}
          {showDisqualify ? (
            <DropdownMenuItem
              disabled={setStatus.isPending || lead.status === "disqualified"}
              onClick={() => setStatus.mutate({ leadId: lead.id, status: "disqualified" })}
            >
              <XCircle className="mr-2 size-4" /> Disqualify
            </DropdownMenuItem>
          ) : null}
          {showDuplicate ? (
            <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
              <Files className="mr-2 size-4" /> Mark duplicate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void copyId()}>
            <Copy className="mr-2 size-4" /> Copy lead ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LeadDetailsDialog lead={lead} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign lead to a rep</DialogTitle>
            <DialogDescription>
              Sets the assigned rep only. Who originally claimed the lead is left
              untouched.
            </DialogDescription>
          </DialogHeader>
          <Select value={repId} onValueChange={setRepId}>
            <SelectTrigger aria-label="Assign to">
              <SelectValue placeholder="Select a person" />
            </SelectTrigger>
            <SelectContent>
              {(owners.data ?? []).map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {ownerOptionLabel(owner)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!repId || assign.isPending}
              onClick={() =>
                assign.mutate(
                  { leadId: lead.id, repId },
                  { onSuccess: () => setAssignOpen(false) },
                )
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as duplicate</DialogTitle>
            <DialogDescription>
              Select the lead this one duplicates. Both the status and the link are
              recorded.
            </DialogDescription>
          </DialogHeader>
          <Select value={originalId} onValueChange={setOriginalId}>
            <SelectTrigger aria-label="Duplicate of">
              <SelectValue placeholder="Select the original lead" />
            </SelectTrigger>
            <SelectContent>
              {otherLeads.map((other) => (
                <SelectItem key={other.id} value={other.id}>
                  {other.leadNumber ? `${other.leadNumber} · ` : ""}
                  {other.organizationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!originalId || markDuplicate.isPending}
              onClick={() =>
                markDuplicate.mutate(
                  { leadId: lead.id, duplicateOfLeadId: originalId },
                  { onSuccess: () => setDuplicateOpen(false) },
                )
              }
            >
              Mark duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
