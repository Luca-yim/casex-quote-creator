import { describe, expect, it } from "vitest";
import { mapQuoteToDrivers } from "../mapQuoteToDrivers";
import type { DriverQuoteInput } from "../mapQuoteToDrivers";

const empty: DriverQuoteInput = {};

describe("mapQuoteToDrivers — integration driver", () => {
  it("is none when integrations are off", () => {
    expect(mapQuoteToDrivers({ hasIntegrations: false }).integration).toBe(
      "none",
    );
  });

  it("is none when the count is zero even if the toggle is on", () => {
    expect(
      mapQuoteToDrivers({ hasIntegrations: true, integrationCount: 0 })
        .integration,
    ).toBe("none");
  });

  it("maps simple to low", () => {
    expect(
      mapQuoteToDrivers({
        hasIntegrations: true,
        integrationCount: 2,
        integrationDifficulty: "simple",
      }).integration,
    ).toBe("low");
  });

  it("maps very_complex to very_high", () => {
    expect(
      mapQuoteToDrivers({
        hasIntegrations: true,
        integrationCount: 12,
        integrationDifficulty: "very_complex",
      }).integration,
    ).toBe("very_high");
  });
});

describe("mapQuoteToDrivers — migration driver", () => {
  it("is none when migration is not required", () => {
    expect(mapQuoteToDrivers({ migrationRequired: false }).migration).toBe(
      "none",
    );
  });

  it("maps the smallest band to low", () => {
    expect(
      mapQuoteToDrivers({
        migrationRequired: true,
        migrationVolumeRange: "<100k",
      }).migration,
    ).toBe("low");
  });

  it("maps the largest band to very_high", () => {
    expect(
      mapQuoteToDrivers({
        migrationRequired: true,
        migrationVolumeRange: "5m+",
      }).migration,
    ).toBe("very_high");
  });

  it("bumps one level when cleanup is required", () => {
    expect(
      mapQuoteToDrivers({
        migrationRequired: true,
        migrationVolumeRange: "1m-5m",
        migrationCleanupRequired: true,
      }).migration,
    ).toBe("very_high");
  });
});

describe("mapQuoteToDrivers — identity driver", () => {
  it("is none when no SSO is needed", () => {
    expect(mapQuoteToDrivers(empty).identity).toBe("none");
  });

  it("is low for one documented audience", () => {
    expect(
      mapQuoteToDrivers({ workerIdpRequired: true, idpDocumented: true })
        .identity,
    ).toBe("low");
  });

  it("is very_high for both audiences undocumented", () => {
    expect(
      mapQuoteToDrivers({
        externalIdpRequired: true,
        workerIdpRequired: true,
        idpDocumented: false,
      }).identity,
    ).toBe("very_high");
  });
});

describe("mapQuoteToDrivers — portal driver", () => {
  it("is none with no portals", () => {
    expect(mapQuoteToDrivers(empty).portal).toBe("none");
  });

  it("is low for one portal with few forms", () => {
    expect(
      mapQuoteToDrivers({ includeB2c: true, portalFormCountRange: "1-3" })
        .portal,
    ).toBe("low");
  });

  it("bumps when both portals are in scope", () => {
    expect(
      mapQuoteToDrivers({
        includeB2c: true,
        includeB2bPortal: true,
        portalFormCountRange: "11-25",
      }).portal,
    ).toBe("very_high");
  });

  it("defaults to low when form count is not collected", () => {
    expect(mapQuoteToDrivers({ includeB2c: true }).portal).toBe("low");
  });
});

describe("mapQuoteToDrivers — compliance driver", () => {
  it("is none with no regimes", () => {
    expect(mapQuoteToDrivers({ compliance: [] }).compliance).toBe("none");
  });

  it("is low for a single standard regime", () => {
    expect(mapQuoteToDrivers({ compliance: ["soc2_type2"] }).compliance).toBe(
      "low",
    );
  });

  it("is high for any federal audit regime", () => {
    expect(mapQuoteToDrivers({ compliance: ["cjis"] }).compliance).toBe("high");
  });

  it("is very_high for four regimes including a federal one", () => {
    expect(
      mapQuoteToDrivers({
        compliance: ["fedramp_high", "soc2_type2", "hipaa", "stateramp"],
      }).compliance,
    ).toBe("very_high");
  });
});

describe("mapQuoteToDrivers — not-collected safe defaults", () => {
  it("never infers undocumented integrations from integrationDifficulty", () => {
    expect(
      mapQuoteToDrivers({
        hasIntegrations: true,
        integrationCount: 5,
        integrationDifficulty: "very_complex",
      }).hasUndocumentedIntegration,
    ).toBe(false);
  });

  it("only reports undocumented when IdP work is in scope and marked so", () => {
    expect(
      mapQuoteToDrivers({ externalIdpRequired: true, idpDocumented: false })
        .hasUndocumentedIntegration,
    ).toBe(true);
    expect(
      mapQuoteToDrivers({ idpDocumented: false }).hasUndocumentedIntegration,
    ).toBe(false);
  });

  it("treats payments/e-signature/multilingual as absent for the portal driver", () => {
    // Those inputs are not collected anywhere in the intake form; the portal
    // level must come from portal presence + form count alone.
    expect(
      mapQuoteToDrivers({ includeB2bPortal: true, portalFormCountRange: "4-10" })
        .portal,
    ).toBe("medium");
  });

  it("returns all-none for a completely empty quote", () => {
    expect(mapQuoteToDrivers(empty)).toEqual({
      integration: "none",
      migration: "none",
      identity: "none",
      portal: "none",
      compliance: "none",
      hasUndocumentedIntegration: false,
    });
  });
});
