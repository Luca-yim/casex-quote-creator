
describe("canConvertLead", () => {
  const lead = (claimedBy: string | null) => ({ claimedBy }) as never;

  it("allows admins regardless of who claimed the lead", () => {
    expect(canConvertLead("admin", lead("someone-else"), "me")).toBe(true);
    expect(canConvertLead("admin", lead(null), null)).toBe(true);
  });

  it("allows the claimant only", () => {
    expect(canConvertLead("sales_rep", lead("me"), "me")).toBe(true);
    expect(canConvertLead("sales_rep", lead("other"), "me")).toBe(false);
    expect(canConvertLead("sales_rep", lead(null), "me")).toBe(false);
    expect(canConvertLead("estimator", lead("me"), null)).toBe(false);
  });
});
