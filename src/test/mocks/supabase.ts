import { vi } from "vitest";
import type { AppRole } from "@/lib/auth-types";

export interface MockResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Builds a PostgREST-shaped response envelope. */
export function mockSupabaseResponse<T>(
  data: T | null,
  error: { message: string; code?: string } | null = null,
): MockResponse<T> {
  return { data, error };
}

/** Builds an authenticated-session shape for `auth.getSession()` mocks. */
export function mockAuthenticatedUser(role: AppRole, id = "user-test-1") {
  const user = {
    id,
    email: `${role}@test.local`,
    app_metadata: {},
    user_metadata: { role },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  };
  return {
    user,
    profile: { id, email: user.email, full_name: `${role} user`, role },
    session: {
      access_token: `token-${id}`,
      refresh_token: `refresh-${id}`,
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  };
}

/**
 * Creates a chainable Supabase query-builder mock. Every terminal call
 * resolves to `response`, so `.from(...).select(...).eq(...)` works.
 */
export function createQueryBuilderMock<T>(response: MockResponse<T>) {
  const builder: Record<string, unknown> = {};
  const chainable = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "in",
    "is",
    "not",
    "or",
    "gte",
    "lte",
    "order",
    "limit",
    "range",
  ];
  for (const method of chainable) {
    builder[method] = vi.fn(() => builder);
  }
  builder["single"] = vi.fn(async () => response);
  builder["maybeSingle"] = vi.fn(async () => response);
  builder["then"] = (resolve: (r: MockResponse<T>) => unknown) =>
    Promise.resolve(response).then(resolve);
  return builder;
}

/** Minimal Supabase client mock covering auth, data and storage surfaces. */
export function createSupabaseMock(options: {
  role?: AppRole;
  userId?: string;
  tableResponse?: MockResponse<unknown>;
} = {}) {
  const { role = "sales_rep", userId = "user-test-1" } = options;
  const auth = mockAuthenticatedUser(role, userId);
  const response = options.tableResponse ?? mockSupabaseResponse([]);

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: auth.session },
        error: null,
      })),
      getUser: vi.fn(async () => ({ data: { user: auth.user }, error: null })),
      signInWithPassword: vi.fn(async () => ({
        data: { session: auth.session, user: auth.user },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => createQueryBuilderMock(response)),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: "path.pdf" }, error: null })),
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://example.test/signed.pdf" },
          error: null,
        })),
      })),
    },
    __auth: auth,
  };
}
