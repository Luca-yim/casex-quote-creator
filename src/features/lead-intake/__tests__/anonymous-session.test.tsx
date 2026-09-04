import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { AuthProvider } from "@/lib/auth";

/**
 * Guards the anonymous-session contract of the public lead-intake route:
 * the visitor must be signed in anonymously exactly ONCE for the whole
 * six-step journey — not once per step, and not again on submit.
 */

const anonUser = { id: "anon-user-1", is_anonymous: true };
const anonSession = { access_token: "t", refresh_token: "r", user: anonUser };

const signInAnonymously = vi.fn();
const getSession = vi.fn();
const insert = vi.fn();

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: null, isLoading: false, isError: false, error: null }),
  profileQueryKey: (id?: string) => ["profile", id],
}));

// Turnstile is enabled; the widget hands back a token once, immediately.
vi.mock("@/lib/turnstile", () => ({
  isTurnstileEnabled: true,
  TURNSTILE_SITE_KEY: "test-site-key",
  loadTurnstile: async () => ({ render: () => "w", remove: () => {} }),
}));

vi.mock("@/components/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    queueMicrotask(() => onToken("captcha-token"));
    return <div data-testid="turnstile-widget" />;
  },
}));

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [] }),
}));

vi.mock("@/hooks/useVerticalLabels", () => ({
  useVerticalLabels: () => ({ options: [] }),
  OTHER_VERTICAL: "other",
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      signInAnonymously: (...args: unknown[]) => signInAnonymously(...args),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      insert: (...args: unknown[]) => insert(...args),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { lead_number: "L-000123" } }) }),
      }),
    }),
  },
}));

const { Route } = await import("@/routes/get-a-quote");
const GetAQuotePage = Route.options.component!;

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: null } });
  signInAnonymously.mockResolvedValue({ data: { session: anonSession }, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("/get-a-quote anonymous session", () => {
  it("signs in anonymously exactly once across all six steps and the submit", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <GetAQuotePage />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText(/organization name/i)).toBeEnabled());

    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/your name/i), "Dana Rivers");
    await user.type(screen.getByLabelText(/work email/i), "dana@acme.gov");

    for (let step = 1; step <= 5; step += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
      expect(screen.getByText(new RegExp(`step ${step + 1} of 6`, "i"))).toBeInTheDocument();
      // The count must not grow as the visitor moves between steps.
      expect(signInAnonymously).toHaveBeenCalledTimes(1);
    }

    // Once getSession() reports a session, the anon path must not run again.
    getSession.mockResolvedValue({ data: { session: anonSession } });
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert.mock.calls[0]![0]).toMatchObject({
      submitted_by_anon_id: anonUser.id,
      organization_name: "Acme County",
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  // Six-step typing flow: ~1.1s in isolation, but it exceeds the default 5s
  // budget when the full suite runs its files in parallel.
  }, 30_000);
});
