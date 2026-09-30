import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { RequiredLabel } from "@/features/intake/sections/RequiredLabel";
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
  useUpdateCostItem,
  useUpdateWbsLine,
  useWbsLines,
  type CostItemRow,
  type WbsLineRow,
  type WbsLinePatch,
} from "./useWbsData";

const ITEM_TYPES = ["travel", "license", "hardware", "subcontractor", "other"];

/** The only location values the editor accepts. */
const LOCATIONS = ["onshore", "nearshore", "offshore"] as const;
type LocationValue = (typeof LOCATIONS)[number];
const LOCATION_LABEL: Record<LocationValue, string> = {
  onshore: "Onshore",
  nearshore: "Nearshore",
  offshore: "Offshore",
};
function toLocationValue(v: string): LocationValue | "" {
  const l = v.trim().toLowerCase();
  return (LOCATIONS as readonly string[]).includes(l) ? (l as LocationValue) : "";
}

/** Quote states whose cost basis has been committed to a customer price. */
const COMMITTED_STATES = ["approved", "sent_to_customer", "accepted", "declined"];

const emptyLine: {
  phase: string;
  area: string;
  role: string;
  location: LocationValue | "";
  revenueHours: string;
  costHours: string;
} = {
  phase: "",
  area: "",
  role: "",
  location: "",
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
  const updateLine = useUpdateWbsLine(quoteId);
  const updateItem = useUpdateCostItem(quoteId);

  const [line, setLine] = useState(emptyLine);
  const [item, setItem] = useState(emptyItem);
  /** Row being edited; the entry form doubles as the edit form. */
  const [editingLine, setEditingLine] = useState<WbsLineRow | null>(null);
  const [editingItem, setEditingItem] = useState<CostItemRow | null>(null);

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

  const committed = COMMITTED_STATES.includes(String((quote as { state?: string }).state ?? ""));
  const roles = Array.from(new Set(rates.map((r) => r.role))).sort();
  const selectedRate = rates.find(
    (r) => r.role === line.role && toLocationValue(r.location) === line.location && line.location !== "",
  );
  const pairingUnchanged =
    editingLine !== null &&
    line.role === editingLine.role &&
    line.location === toLocationValue(editingLine.location);
  // When editing, the line's own role/location stays valid even if it is no
  // longer on the active rate card — its override rates are kept as-is.
  const roleValid = Boolean(selectedRate) || pairingUnchanged;
  /** True when saving would replace the line's rates with rate-card rates. */
  const willReprice = editingLine !== null && !pairingUnchanged && Boolean(selectedRate);
  const canAddLine =
    Boolean(line.phase) &&
    Boolean(line.area.trim()) &&
    roleValid &&
    line.costHours !== "";

  const startEditLine = (l: WbsLineRow) => {
    setEditingLine(l);
    setLine({
      phase: l.phase,
      area: l.area,
      role: l.role,
      location: toLocationValue(l.location),
      costHours: String(l.costHours),
      revenueHours: String(l.revenueHours),
    });
  };
  const cancelEditLine = () => {
    setEditingLine(null);
    setLine(emptyLine);
  };

  const submitLine = () => {
    if (!canAddLine) return;
    if (editingLine) {
      const patch: WbsLinePatch = {
        phase: line.phase,
        area: line.area.trim(),
        costHours: Number(line.costHours),
        revenueHours: Number(line.revenueHours || line.costHours),
      };
      // Re-snapshot rates only when the role/location pairing changed.
      if (willReprice && selectedRate) {
        patch.role = selectedRate.role;
        patch.location = selectedRate.location;
        patch.costRate = selectedRate.costRate;
        patch.billRate = selectedRate.billRate;
      }
      updateLine.mutate({ id: editingLine.id, patch }, { onSuccess: cancelEditLine });
      return;
    }
    if (!selectedRate) return;
    addLine.mutate(
      {
        phase: line.phase,
        area: line.area.trim(),
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

  const startEditItem = (i: CostItemRow) => {
    setEditingItem(i);
    setItem({
      name: i.name,
      itemType: i.itemType,
      amount: String(i.amount),
      customerVisible: i.customerVisible,
    });
  };
  const cancelEditItem = () => {
    setEditingItem(null);
    setItem(emptyItem);
  };

  const submitItem = () => {
    if (!item.name || item.amount === "") return;
    if (editingItem) {
      updateItem.mutate(
        {
          id: editingItem.id,
          patch: {
            name: item.name,
            itemType: item.itemType,
            amount: Number(item.amount),
            customerVisible: item.customerVisible,
          },
        },
        { onSuccess: cancelEditItem },
      );
      return;
    }
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
                    <TableCell>{l.area}</TableCell>
                    <TableCell>{l.role}</TableCell>
                    <TableCell>{l.location}</TableCell>
                    <TableCell className="text-right">{l.costHours}</TableCell>
                    <TableCell className="text-right">{l.revenueHours}</TableCell>
                    <TableCell className="text-right">{l.personDays ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(l.costHours * l.costRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {committed ? null : (<>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit line ${l.phase} ${l.role}`}
                        onClick={() => startEditLine(l)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete line ${l.phase} ${l.role}`}
                        onClick={() => deleteLine.mutate(l.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                      </>)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {committed ? (
          <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground" role="note">
            This quote is committed — lines cannot be changed.
          </p>
        ) : (
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
            <Label htmlFor="wbs-area">
              <RequiredLabel>Area</RequiredLabel>
            </Label>
            <Input
              id="wbs-area"
              aria-required="true"
              value={line.area}
              onChange={(e) => setLine((s) => ({ ...s, area: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-role">Role</Label>
            <Select
              value={line.role}
              onValueChange={(v) => setLine((s) => ({ ...s, role: v }))}
            >
              <SelectTrigger id="wbs-role">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {editingLine && !roles.includes(editingLine.role) && (
                  <SelectItem value={editingLine.role}>{editingLine.role} (current)</SelectItem>
                )}
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wbs-location">Location</Label>
            <Select
              value={line.location}
              onValueChange={(v) => setLine((s) => ({ ...s, location: toLocationValue(v) }))}
            >
              <SelectTrigger id="wbs-location">
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {LOCATION_LABEL[loc]}
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
          {editingLine && (
            <div
              className="rounded-md border bg-muted/50 p-2 text-sm sm:col-span-2 lg:col-span-3"
              data-testid="wbs-rate-preview"
              role="status"
            >
              {willReprice && selectedRate ? (
                <>
                  <span className="font-medium">New rates will replace this line&apos;s rates on save:</span>{" "}
                  cost rate {formatCurrency(selectedRate.costRate)} (was {formatCurrency(editingLine.costRate)}),
                  bill rate {formatCurrency(selectedRate.billRate)} (was {formatCurrency(editingLine.billRate)}).
                </>
              ) : !pairingUnchanged && !selectedRate ? (
                <>No rate on the active rate card for this role and location.</>
              ) : (
                <>
                  Keeping this line&apos;s rates: cost rate {formatCurrency(editingLine.costRate)}, bill rate{" "}
                  {formatCurrency(editingLine.billRate)}.
                </>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              onClick={submitLine}
              disabled={!canAddLine || addLine.isPending || updateLine.isPending}
            >
              {editingLine ? null : <Plus className="size-4" aria-hidden="true" />}
              {editingLine ? "Save line" : "Add line"}
            </Button>
            {editingLine && (
              <Button variant="outline" onClick={cancelEditLine}>
                Cancel
              </Button>
            )}
          </div>
        </div>
        )}

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
                        {committed ? null : (<>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit cost item ${i.name}`}
                          onClick={() => startEditItem(i)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete cost item ${i.name}`}
                          onClick={() => deleteItem.mutate(i.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                        </>)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {committed ? null : (
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
              <div className="flex gap-2">
                <Button
                  onClick={submitItem}
                  disabled={
                    !item.name || item.amount === "" || addItem.isPending || updateItem.isPending
                  }
                >
                  {editingItem ? null : <Plus className="size-4" aria-hidden="true" />}
                  {editingItem ? "Save" : "Add"}
                </Button>
                {editingItem && (
                  <Button variant="outline" onClick={cancelEditItem}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
          )}
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
