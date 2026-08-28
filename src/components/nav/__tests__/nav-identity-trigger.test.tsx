import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: () => "/request-quote",
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

type Profile = { full_name: string | null; email: string | null } | null;
const authState: { profile: Profile; user: { email: string } | null } = {
  profile: null,
  user: null,
};

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    profile: authState.profile,
    user: authState.user,
    role: "sales_rep",
    signOut: vi.fn(),
  }),
}));

import { NavUserMenu } from "../NavUserMenu";
import { NavMobileMenu } from "../NavMobileMenu";

const EMAIL = "rep@test.local";

beforeEach(() => {
  authState.profile = null;
  authState.user = { email: EMAIL };
});

describe("collapsed nav identity triggers", () => {
  it("desktop trigger uses full_name, never the email", () => {
    authState.profile = { full_name: "Test Rep", email: EMAIL };
    render(<NavUserMenu />);
    const trigger = screen.getByRole("button", { name: /^User menu — Test Rep$/ });
    expect(trigger).toHaveAttribute("title", "Test Rep");
    expect(trigger.getAttribute("aria-label")).not.toContain(EMAIL);
  });

  it("desktop trigger falls back to email when full_name is empty", () => {
    authState.profile = { full_name: "   ", email: EMAIL };
    render(<NavUserMenu />);
    const trigger = screen.getByRole("button", { name: `User menu — ${EMAIL}` });
    expect(trigger).toHaveAttribute("title", EMAIL);
  });

  it("desktop trigger falls back to plain label with no identity", () => {
    authState.user = null;
    render(<NavUserMenu />);
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
  });

  it("mobile trigger uses full_name, never the email", () => {
    authState.profile = { full_name: "Test External", email: EMAIL };
    render(<NavMobileMenu />);
    const trigger = screen.getByRole("button", { name: /^Open main menu — Test External$/ });
    expect(trigger).toHaveAttribute("title", "Test External");
    expect(trigger.getAttribute("aria-label")).not.toContain(EMAIL);
  });

  it("mobile trigger falls back to email when full_name is null", () => {
    authState.profile = { full_name: null, email: EMAIL };
    render(<NavMobileMenu />);
    const trigger = screen.getByRole("button", { name: `Open main menu — ${EMAIL}` });
    expect(trigger).toHaveAttribute("title", EMAIL);
  });
});
