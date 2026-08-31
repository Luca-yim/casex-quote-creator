import { useEffect } from "react";
import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableOwners } from "@/hooks/useAssignableOwners";
import {
  DEFAULT_LEAD_FILTERS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  leadFiltersAreDefault,
  type LeadFilters as Filters,
  type LeadStatus,
} from "./types";

const ALL = "__all__";

/** Filter bar for the lead queue. Mirrors `PipelineFiltersBar`'s UX. */
export function LeadQueueFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const [searchDraft, setSearchDraft] = useState(value.search);
  // Reuses the same source as the quotes rep-assignment picker.
  const owners = useAssignableOwners();

  useEffect(() => {
    setSearchDraft(value.search);
  }, [value.search]);

  useEffect(() => {
    if (searchDraft === value.search) return;
    const timer = setTimeout(() => onChange({ ...value, search: searchDraft }), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, value, onChange]);

  const toggleStatus = (status: LeadStatus, checked: boolean) => {
    const next = checked
      ? [...value.statuses, status]
      : value.statuses.filter((s) => s !== status);
    onChange({ ...value, statuses: next });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search organization, contact name, or email"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          aria-label="Search leads"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Statuses ({value.statuses.length})</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Lead status</DropdownMenuLabel>
          {LEAD_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={value.statuses.includes(status)}
              onCheckedChange={(checked) => toggleStatus(status, Boolean(checked))}
              onSelect={(e) => e.preventDefault()}
            >
              {LEAD_STATUS_LABELS[status]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={value.assignee ?? ALL}
        onValueChange={(v) => onChange({ ...value, assignee: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-[190px]" aria-label="Assignee">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All assignees</SelectItem>
          <SelectItem value="mine">Assigned to me</SelectItem>
          <SelectItem value="unassigned">Unclaimed</SelectItem>
          {(owners.data ?? []).map((owner) => (
            <SelectItem key={owner.id} value={owner.id}>
              {owner.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        disabled={leadFiltersAreDefault(value)}
        onClick={() => onChange({ ...DEFAULT_LEAD_FILTERS })}
      >
        <RotateCcw className="mr-2 size-4" /> Reset
      </Button>
    </div>
  );
}
