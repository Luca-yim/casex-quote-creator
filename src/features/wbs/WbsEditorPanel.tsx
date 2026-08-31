import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { grandTotalCost } from "@/lib/pricing-engine/fullQuote";
import { programTypeForCustomerType } from "@/features/estimator-ballpark/computeBallparkForQuote";
import { useIntake } from "@/features/intake/IntakeContext";
import {
  useAddCostItem,
  useAddWbsLine,
  useDeleteCostItem,
  useDeleteWbsLine,
  usePhaseOptions,
  useQuoteCostItems,
  useRateCardOptions,
  useWbsLines,
} from "./useWbsData";

const ITEM_TYPES = ["travel", "license", "hardware", "subcontractor", "other"];

const emptyLine = {
  phase: "",
  area: "",
  roleKey: "",
  revenueHours: "",
  costHours: "",
};

const emptyItem = { name: "", itemType: "travel", amount: "", customerVisible: false };

/**
 * Proposal-tier cost-basis entry: WBS labor lines plus itemized non-labor
 * costs, with a running grand total from the pricing engine. No margin,
 * contingency or scenario display — cost basis only.
 */
export function WbsEditorPanel() {
  const { quote, quoteId } = useIntake();
  const programType = programTypeForCustomerType(
    (quote as unknown as { customerType?: string | null }).customerType,
  );

  const linesQuery = useWbsLines(quoteId);
  const itemsQuery = useQuoteCostItems(quoteId);
  const ratesQuery = useRateCardOptions(programType);
  const phasesQuery = usePhaseOptions();

  const addLine = useAddWbsLine(quoteId);
  const deleteLine = useDeleteWbsLine(quoteId);
  const addItem = useAddCostItem(quoteId);
  const deleteItem = useDeleteCostItem(quoteId);

  const [line, setLine] = useState(emptyLine);
  const [item, setItem] = useState(emptyItem);

  const lines = useMemo(() => linesQuery.data ?? [], [linesQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const rates = ratesQuery.data ?? [];
  const phases = phasesQuery.data ?? [];

  const total = useMemo(
    () =>
      grandTotalCost(
        lines.map((l) => ({
          costHours: l.costHours,
          costRate: l.costRate,
          revenueHours: l.revenueHours,
          billRate: l.billRate,
        })),
        items.map((i) => ({ amount: i.amount })),
      ),
    [lines, items],
  );

  const selectedRate = rates.find((r) => `${r.role}|${r.location}` === line.roleKey);
  const canAddLine =
    Boolean(line.phase) && Boolean(selectedRate) && line.costHours !== "";

  const submitLine = () => {
    if (!canAddLine || !selectedRate) return;
    addLine.mutate(
      {
        phase: line.phase,
        area: line.area || null,
        role: selectedRate.role,
        location: selectedRate.location,
        costHours: Number(line.costHours),
        revenueHours: Number(line.revenueHours || line.costHours),
        // Snapshotted at insert time — never a live rate-card reference.
        costRate: selectedRate.costRate,
        billRate: selectedRate.billRate,
      },
      { onSuccess: () => setLine(emptyLine) },
    );
  };

  const submitItem = () => {
    if (!item.name || item.amount === "") return;
    addItem.mutate(
      {
        name: item.name,
        itemType: item.itemType,
        amount: Number(item.amount),
        customerVisible: item.customerVisible,
      },
      { onSuccess: () => setItem(emptyItem) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work breakdown structure</CardTitle>
        <CardDescription>
          Proposal cost basis. Rates are snapshotted from the active rate card when
          a line is added.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Cost hrs</TableHead>
                <TableHead className="text-right">Revenue hrs</TableHead>
                <TableHead className="text-right">Person days</TableHead>
                <TableHead className="text-right">Line cost</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground">
                    No WBS lines yet.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.phase}</TableCell>
                    <TableCell>{l.area ?? "—"}</TableCell>
                    <TableCell>{l.role}</TableCell>
                    <TableCell>{l.location}</TableCell>
                    <TableCell className="text-right">{l.costHours}</TableCell>
                    <TableCell className="text-right">{l.revenueHours}</TableCell>
                    <TableCell className="text-right">{l.personDays ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(l.costHours * l.costRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete line ${l.phase} ${l.role}`}
                        onClick={() => deleteLine.mutate(l.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wbs-phase">Phase</Label>
            {phases.length > 0 ? (
              <Select
                value={line.phase}
                onValueChange={(v) => setLine((s) => ({ ...s, phase: v }))}
              >
                <SelectTrigger id="wbs-phase">
                  <SelectValue placeholder="Select phase..." />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="wbs-phase"
                value={line.phase}
                onChange={(e) => setLine((s) => ({ ...s, phase: e.target.value }))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-area">Area</Label>
            <Input
              id="wbs-area"
              value={line.area}
              onChange={(e) => setLine((s) => ({ ...s, area: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-role">Role / location</Label>
            <Select
              value={line.roleKey}
              onValueChange={(v) => setLine((s) => ({ ...s, roleKey: v }))}
            >
              <SelectTrigger id="wbs-role">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {rates.map((r) => (
                  <SelectItem key={`${r.role}|${r.location}`} value={`${r.role}|${r.location}`}>
                    {r.role} — {r.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-cost-hours">Cost hours</Label>
            <Input
              id="wbs-cost-hours"
              type="number"
              min={0}
              value={line.costHours}
              onChange={(e) => setLine((s) => ({ ...s, costHours: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-revenue-hours">Revenue hours</Label>
            <Input
              id="wbs-revenue-hours"
              type="number"
              min={0}
              value={line.revenueHours}
              onChange={(e) => setLine((s) => ({ ...s, revenueHours: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={submitLine} disabled={!canAddLine || addLine.isPending}>
              <Plus className="size-4" aria-hidden="true" />
              Add line
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Non-labor cost items</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Customer visible</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      No cost items yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.name}</TableCell>
                      <TableCell>{i.itemType}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(i.amount)}
                      </TableCell>
                      <TableCell>{i.customerVisible ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete cost item ${i.name}`}
                          onClick={() => deleteItem.mutate(i.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="ci-name">Name</Label>
              <Input
                id="ci-name"
                value={item.name}
                onChange={(e) => setItem((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-type">Type</Label>
              <Select
                value={item.itemType}
                onValueChange={(v) => setItem((s) => ({ ...s, itemType: v }))}
              >
                <SelectTrigger id="ci-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-amount">Amount</Label>
              <Input
                id="ci-amount"
                type="number"
                min={0}
                value={item.amount}
                onChange={(e) => setItem((s) => ({ ...s, amount: e.target.value }))}
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="ci-visible"
                  checked={item.customerVisible}
                  onCheckedChange={(v) =>
                    setItem((s) => ({ ...s, customerVisible: Boolean(v) }))
                  }
                />
                <Label htmlFor="ci-visible">Visible</Label>
              </div>
              <Button
                onClick={submitItem}
                disabled={!item.name || item.amount === "" || addItem.isPending}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-md bg-muted p-3">
          <span className="text-sm font-medium">Grand total cost</span>
          <span className="text-lg font-semibold" data-testid="wbs-grand-total">
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
