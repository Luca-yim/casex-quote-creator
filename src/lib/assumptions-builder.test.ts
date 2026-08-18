import { describe, expect, it } from "vitest";
import { buildAssumptions } from "./assumptions-builder";
import {
  makeEmptyQuote,
  makeQuote,
} from "./calculation-engine/__test-fixtures__/catalog";

const ids = (quote: Parameters<typeof buildAssumptions>[0]) =>
  buildAssumptions(quote).map((a) => a.id);

describe("buildAssumptions — repeatable activation", () => {
  it("full_match returns a success-toned assumption", () => {
    const [a] = buildAssumptions(
      makeQuote({ repeatableActivation: "full_match" }),
    );
    expect(a?.tone).toBe("success");
    expect(a?.text).toMatch(/10%/);
  });

  it("partial_match returns a success-toned assumption", () => {
    const [a] = buildAssumptions(
      makeQuote({ repeatableActivation: "partial_match" }),
    );
    expect(a?.tone).toBe("success");
    expect(a?.text).toMatch(/5%/);
  });

  it("novel returns an info-toned assumption", () => {
    const [a] = buildAssumptions(makeQuote({ repeatableActivation: "novel" }));
    expect(a?.tone).toBe("info");
    expect(a?.id).toBe("repeatability-novel");
  });
});

describe("buildAssumptions — rules", () => {
  it("FedRAMP High compliance triggers a hosting note", () => {
    expect(ids(makeQuote({ compliance: ["fedramp_high"] }))).toContain(
      "compliance-fedramp",
    );
  });

  it("CJIS compliance triggers the same hosting note", () => {
    expect(ids(makeQuote({ compliance: ["cjis"] }))).toContain(
      "compliance-fedramp",
    );
  });

  it("SOC-2 alone does not trigger the FedRAMP note", () => {
    expect(ids(makeQuote({ compliance: ["soc2_type2"] }))).not.toContain(
      "compliance-fedramp",
    );
  });

  it("case worker count above 1,500 triggers a warning", () => {
    const found = buildAssumptions(makeQuote({ caseWorkerCount: 1800 })).find(
      (a) => a.id === "caseworker-tier-exceeded",
    );
    expect(found?.tone).toBe("warning");
  });

  it("case worker count of exactly 1,500 does not warn", () => {
    expect(ids(makeQuote({ caseWorkerCount: 1500 }))).not.toContain(
      "caseworker-tier-exceeded",
    );
  });

  it("low rep confidence triggers a warning", () => {
    const found = buildAssumptions(makeQuote({ repConfidence: "low" })).find(
      (a) => a.id === "low-confidence",
    );
    expect(found?.tone).toBe("warning");
  });

  it("short contract terms trigger a warning", () => {
    expect(ids(makeQuote({ contractYears: 2 }))).toContain("short-term");
  });

  it("five-year terms are flagged as favorable", () => {
    expect(ids(makeQuote({ contractYears: 5 }))).toContain("multi-year");
  });

  it("customer-hosted deployments note the missing hosting fee", () => {
    expect(ids(makeQuote({ hostingModel: "customer_hosted" }))).toContain(
      "customer-hosted",
    );
  });

  it("high integration counts add an info note", () => {
    expect(
      ids(makeQuote({ hasIntegrations: true, integrationCount: 8 })),
    ).toContain("high-integrations");
  });

  it("multiple rules can fire concurrently", () => {
    const result = ids(
      makeQuote({
        repeatableActivation: "full_match",
        compliance: ["fedramp_high"],
        caseWorkerCount: 2000,
        repConfidence: "low",
      }),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        "repeatability-full",
        "compliance-fedramp",
        "caseworker-tier-exceeded",
        "low-confidence",
      ]),
    );
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it("an empty quote warns that the module tier is not selected", () => {
    const found = buildAssumptions(makeEmptyQuote({ contractYears: 3 })).find(
      (a) => a.id === "module-tier-missing",
    );
    expect(found?.tone).toBe("warning");
    expect(found?.text).toMatch(/Module tier not selected/);
  });

  it("returns a deterministic array for the default quote", () => {
    expect(buildAssumptions(makeQuote())).toEqual(
      buildAssumptions(makeQuote()),
    );
  });
});
