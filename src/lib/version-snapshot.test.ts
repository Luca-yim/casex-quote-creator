import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle })) })),
        })),
      })),
      insert,
    })),
  },
}));

import { snapshotChangeType, writeVersionSnapshot } from "./version-snapshot";

const INPUT = {
  quoteId: "q1",
  quoteData: { id: "q1", state: "approved" },
  changeReason: "Approved by estimator Ada",
  changedBy: "user-9",
  changeType: "approve" as const,
};

beforeEach(() => {
  maybeSingle.mockReset();
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("writeVersionSnapshot", () => {
  it("starts at version 1 when no versions exist", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await writeVersionSnapshot(INPUT);
    expect(result.version_number).toBe(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ version_number: 1 });
  });

  it("increments from the latest version", async () => {
    maybeSingle.mockResolvedValue({ data: { version_number: 7 }, error: null });
    const result = await writeVersionSnapshot(INPUT);
    expect(result.version_number).toBe(8);
  });

  it("embeds the change type inside the snapshot payload", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await writeVersionSnapshot(INPUT);
    expect(insert.mock.calls[0]?.[0].snapshot).toMatchObject({
      id: "q1",
      __changeType: "approve",
    });
  });

  it("records the quote id, reason and author", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await writeVersionSnapshot(INPUT);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      quote_id: "q1",
      change_reason: "Approved by estimator Ada",
      changed_by: "user-9",
    });
  });

  it("stores a null author when none is known", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await writeVersionSnapshot({ ...INPUT, changedBy: undefined });
    expect(insert.mock.calls[0]?.[0].changed_by).toBeNull();
  });

  it("wraps a non-object snapshot payload", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await writeVersionSnapshot({ ...INPUT, quoteData: "raw" });
    expect(insert.mock.calls[0]?.[0].snapshot).toEqual({
      value: "raw",
      __changeType: "approve",
    });
  });

  it("throws when the version lookup fails", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "denied", code: "42501" },
    });
    await expect(writeVersionSnapshot(INPUT)).rejects.toThrow("denied");
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws when the insert fails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    insert.mockResolvedValue({ error: { message: "insert denied" } });
    await expect(writeVersionSnapshot(INPUT)).rejects.toThrow("insert denied");
  });

  it("supports the pdf_generated change type", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await writeVersionSnapshot({ ...INPUT, changeType: "pdf_generated" });
    expect(insert.mock.calls[0]?.[0].snapshot.__changeType).toBe("pdf_generated");
  });
});

describe("snapshotChangeType", () => {
  it("reads the embedded change type", () => {
    expect(snapshotChangeType({ __changeType: "return" })).toBe("return");
  });

  it("returns null for legacy snapshots", () => {
    expect(snapshotChangeType({ id: "q1" })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(snapshotChangeType(null)).toBeNull();
    expect(snapshotChangeType("x")).toBeNull();
  });
});
