import type { Page, Route } from "@playwright/test";

/**
 * Network-level mocks for the Supabase auth endpoints.
 *
 * CI never solves a real Turnstile challenge and never sends a CAPTCHA token
 * to the real backend: the auth request is intercepted in the browser and
 * fulfilled locally. Nothing here weakens the server-side CAPTCHA check —
 * the real project still requires a valid token for every real caller.
 *
 * Because the project shares one backend between production and test, the
 * mocked session can only be as privileged as the token it carries. When
 * `E2E_SESSION_<PERSONA>` holds a real session JSON (minted out of band by a
 * human), the mock replays it verbatim and the app talks to the real database.
 * Otherwise a synthetic, clearly-fake session is returned, which is enough for
 * routing/guard assertions but is rejected by PostgREST for data reads.
 */

export type MockUser = {
  id: string;
  email: string;
  role: string;
  isAnonymous?: boolean;
};

const AUTH_TOKEN_GLOB = "**/auth/v1/token**";
const AUTH_SIGNUP_GLOB = "**/auth/v1/signup**";
const AUTH_USER_GLOB = "**/auth/v1/user**";

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Builds a structurally valid (but unsigned) JWT so supabase-js can parse it. */
function fakeJwt(user: MockUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    sub: user.id,
    email: user.email,
    role: "authenticated",
    is_anonymous: user.isAnonymous ?? false,
    app_metadata: { provider: user.isAnonymous ? "anonymous" : "email" },
    user_metadata: {},
  };
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.e2e-mock-signature`;
}

/** A realistic `GoTrueClient` session payload for the given user. */
export function sessionPayload(user: MockUser): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    access_token: fakeJwt(user),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `e2e-refresh-${user.id}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.isAnonymous ? undefined : user.email,
      email_confirmed_at: user.isAnonymous ? null : now,
      phone: "",
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: {
        provider: user.isAnonymous ? "anonymous" : "email",
        providers: [user.isAnonymous ? "anonymous" : "email"],
      },
      user_metadata: {},
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: user.isAnonymous ?? false,
    },
  };
}

/** Reads a real session JSON handed to CI through the environment, if any. */
export function realSessionFromEnv(key: string): Record<string, unknown> | null {
  const raw = process.env[key];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${key} is set but is not valid JSON.`);
  }
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

export type MockAuthOptions = {
  /** Session returned on a successful sign-in. */
  user: MockUser;
  /** Overrides the generated payload (e.g. a real session from the env). */
  session?: Record<string, unknown> | null;
  /** Credentials that are accepted; anything else gets a 400 like the real API. */
  accept?: { email: string; password: string };
};

/**
 * Intercepts `signInWithPassword`, `signInAnonymously`, `signUp` and the
 * follow-up `GET /auth/v1/user` call, so no auth request ever leaves the
 * browser during a test run.
 */
export async function mockSupabaseAuth(page: Page, options: MockAuthOptions): Promise<void> {
  const session = options.session ?? sessionPayload(options.user);
  const user = (session as { user?: unknown }).user ?? sessionPayload(options.user).user;

  await page.route(AUTH_TOKEN_GLOB, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return json(route, {});

    const url = new URL(request.url());
    const grant = url.searchParams.get("grant_type");

    if (grant === "refresh_token") return json(route, session);

    const body = request.postDataJSON() as { email?: string; password?: string } | null;
    if (options.accept && body) {
      const ok =
        body.email === options.accept.email && body.password === options.accept.password;
      if (!ok) {
        return json(
          route,
          { error: "invalid_grant", error_description: "Invalid login credentials" },
          400,
        );
      }
    }

    return json(route, session);
  });

  await page.route(AUTH_SIGNUP_GLOB, async (route) => {
    if (route.request().method() === "OPTIONS") return json(route, {});
    return json(route, session);
  });

  await page.route(AUTH_USER_GLOB, async (route) => {
    if (route.request().method() === "OPTIONS") return json(route, {});
    return json(route, user);
  });
}

/**
 * Replaces the Cloudflare Turnstile script with an inert stub that resolves
 * immediately. Purely client-side: the token it produces is never sent to the
 * real backend because the auth endpoints above are mocked too.
 */
export async function stubTurnstile(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.turnstile = {
          render: function (el, opts) {
            setTimeout(function () { opts && opts.callback && opts.callback('e2e-mock-turnstile-token'); }, 0);
            return 'e2e-widget';
          },
          reset: function () {},
          remove: function () {},
        };
      `,
    }),
  );
}
