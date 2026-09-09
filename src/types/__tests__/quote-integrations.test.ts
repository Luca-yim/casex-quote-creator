import { describe, expect, it } from "vitest";
import { quoteSchema } from "@/types/quote";

const base = {
  customerName: "Acme County",
  customerType: "county",
  vertical: "GovCx",
  solution: "Licensing",
  moduleTier: "standard",
  contractYears: 3,
  hostingModel: "soc2",
  supportTier: "standard",
};

describe("quoteSchema — integrations list", () => {
  it("blocks submission when integrations are on but the list is empty", () => {
    const result = quoteSchema.safeParse({
      ...base,
      hasIntegrations: true,
      integrations: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "integrations",
      );
      expect(issue?.message).toBe("Please add at least one integration");
    }
  });

  it("accepts a populated list", () => {
    const result = quoteSchema.safeParse({
      ...base,
      hasIntegrations: true,
      integrations: [{ difficulty: "complex" }, { difficulty: "simple" }],
    });
    expect(result.success).toBe(true);
  });

  it("defaults to an empty list and passes when integrations are off", () => {
    const result = quoteSchema.safeParse({ ...base, hasIntegrations: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.integrations).toEqual([]);
  });
});
