import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { AuthShell } from "../AuthShell";

describe("AuthShell", () => {
  it("renders a back-to-home link pointing at /", () => {
    render(
      <AuthShell title="Sign in" subtitle="Access the app">
        <p>Form content</p>
      </AuthShell>,
    );

    const link = screen.getByRole("link", { name: /Back to home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
