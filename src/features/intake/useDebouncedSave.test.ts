import { describe, expect, it } from "vitest";
import { mergePendingPatch } from "./useDebouncedSave";

describe("mergePendingPatch", () => {
  it("maps camelCase field paths to database columns", () => {
    expect(mergePendingPatch({}, "customerName", "Nevada")).toEqual({
      customer_name: "Nevada",
    });
  });

  it("batches multiple distinct fields into one patch", () => {
    let patch: Record<string, unknown> = {};
    patch = mergePendingPatch(patch, "customerName", "Nevada");
    patch = mergePendingPatch(patch, "contractYears", 5);
    expect(patch).toEqual({ customer_name: "Nevada", contract_years: 5 });
  });

  it("keeps only the latest value for rapid edits to one field", () => {
    let patch: Record<string, unknown> = {};
    patch = mergePendingPatch(patch, "contractYears", 1);
    patch = mergePendingPatch(patch, "contractYears", 3);
    patch = mergePendingPatch(patch, "contractYears", 7);
    expect(patch).toEqual({ contract_years: 7 });
  });

  it("ignores unknown field paths", () => {
    const patch = { customer_name: "Nevada" };
    expect(mergePendingPatch(patch, "notARealField", 1)).toBe(patch);
  });
});
