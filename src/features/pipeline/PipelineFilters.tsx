import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useEstimators } from "./useEstimators";
import {
  DEFAULT_FILTERS,
  PIPELINE_STATES,
  STATE_LABELS,
  filtersAreDefault,
  type PipelineFilters as Filters,
} from "./types";
import type { QuoteState } from "@/types/quote";

const ALL = "__all__";

type Preset = "7" | "30" | "90" | "365" | "all" | "custom";

function presetRange(preset: Preset): { from: string | null; to: string | null } {
  if (preset === "all" || preset === "custom") return { from: null, to: null };
  const days = Number(preset);
  const from = new Date(Date.now() - days * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: null };
}

/**
 * Filter bar for the pipeline. Stays interactive while data loads.
 * Saved filter presets are deliberately out of scope.
 */
export function PipelineFiltersBar({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const [searchDraft, setSearchDraft] = useState(value.search);
  const [preset, setPreset] = useState<Preset>(
    value.dateFrom || value.dateTo ? "custom" : "all",
  );

  const verticals = useVerticalSolutions();
  const reps = useSalesReps();
  const estimators = useEstimators();

  // Keep the input in sync when filters are reset or hydrated from the URL.
  useEffect(() => {
    setSearchDraft(value.search);
  }, [value.search]);

  // Debounce free-text search by 300ms.
  useEffect(() => {
    if (searchDraft === value.search) return;
    const timer = setTimeout(() => onChange({ ...value, search: searchDraft }), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, value, onChange]);

  const verticalOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of verticals.data ?? []) if (row.vertical_l1) set.add(row.vertical_l1);
    return [...set].sort();
  }, [verticals.data]);

  const solutionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of verticals.data ?? []) {
      if (!row.solution_l2) continue;
      if (value.vertical && row.vertical_l1 !== value.vertical) continue;
      set.add(row.solution_l2);
    }
    return [...set].sort();
  }, [verticals.data, value.vertical]);

  const toggleState = (state: QuoteState, checked: boolean) => {
    const next = checked
      ? [...value.states, state]
      : value.states.filter((s) => s !== state);
    onChange({ ...value, states: next });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search customer name, quote name, or email"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          aria-label="Search quotes"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            States ({value.states.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Quote state</DropdownMenuLabel>
          {PIPELINE_STATES.map((state) => (
            <DropdownMenuCheckboxItem
              key={state}
              checked={value.states.includes(state)}
              onCheckedChange={(checked) => toggleState(state, Boolean(checked))}
              onSelect={(e) => e.preventDefault()}
            >
              {STATE_LABELS[state]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value.includeArchived}
          onCheckedChange={(checked) =>
            onChange({ ...value, includeArchived: Boolean(checked) })
          }
          aria-label="Include archived"
        />
        Include archived
      </label>

      <Select
        value={value.vertical ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, vertical: v === ALL ? null : v, solution: null })
        }
      >
        <SelectTrigger className="w-[150px]" aria-label="Vertical">
          <SelectValue placeholder="Vertical" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All verticals</SelectItem>
          {verticalOptions.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.solution ?? ALL}
        onValueChange={(v) => onChange({ ...value, solution: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Solution">
          <SelectValue placeholder="Solution" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All solutions</SelectItem>
          {solutionOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.ownerId ?? ALL}
        onValueChange={(v) => onChange({ ...value, ownerId: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Sales rep">
          <SelectValue placeholder="Sales rep" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sales reps</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {(reps.data ?? []).map((rep) => (
            <SelectItem key={rep.id} value={rep.id}>
              {rep.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.estimatorId ?? ALL}
        onValueChange={(v) => onChange({ ...value, estimatorId: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Approved by">
          <SelectValue placeholder="Approved by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All estimators</SelectItem>
          {(estimators.data ?? []).map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={preset}
        onValueChange={(v) => {
          const next = v as Preset;
          setPreset(next);
          const range = presetRange(next);
          if (next !== "custom") onChange({ ...value, dateFrom: range.from, dateTo: range.to });
        }}
      >
        <SelectTrigger className="w-[150px]" aria-label="Approved date range">
          <SelectValue placeholder="Approved" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
          <SelectItem value="365">Last year</SelectItem>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="pipeline-from">
              From
            </Label>
            <Input
              id="pipeline-from"
              type="date"
              className="w-[150px]"
              value={value.dateFrom ?? ""}
              onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="pipeline-to">
              To
            </Label>
            <Input
              id="pipeline-to"
              type="date"
              className="w-[150px]"
              value={value.dateTo ?? ""}
              onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
            />
          </div>
        </div>
      ) : null}

      <Button
        variant="ghost"
        onClick={() => {
          setPreset("all");
          setSearchDraft("");
          onChange({ ...DEFAULT_FILTERS });
        }}
        disabled={filtersAreDefault(value)}
      >
        {filtersAreDefault(value) ? (
          <Check className="mr-1 size-4" />
        ) : (
          <RotateCcw className="mr-1 size-4" />
        )}
        Reset
      </Button>
    </div>
  );
}
