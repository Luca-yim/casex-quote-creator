import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { homeRouteForRole } from "@/lib/auth";

describe("test infrastructure", () => {
  it("renders components", () => {
    render(<p>CaseX Pricing Calculator</p>);
    expect(screen.getByText("CaseX Pricing Calculator")).toBeInTheDocument();
  });

  it("routes each role to its home surface", () => {
    expect(homeRouteForRole("admin")).toBe("/admin");
    expect(homeRouteForRole("estimator")).toBe("/review");
    expect(homeRouteForRole("sales_rep")).toBe("/quotes");
    expect(homeRouteForRole("external")).toBe("/request-quote");
  });
});
