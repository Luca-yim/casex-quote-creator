import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, TestProviders } from "@/test/test-utils";
import { createElement, type ReactNode } from "react";

const maybeSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  },
}));

import { profileQueryKey, useProfile } from "../useProfile";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(TestProviders, {
    queryClient: createTestQueryClient(),
    children,
  });
}

const ROW = {
  id: "user-1",
  email: "rep@test.local",
  full_name: "Rep One",
  role: "sales_rep",
};

beforeEach(() => {
  maybeSingle.mockReset();
});

describe("profileQueryKey", () => {
  it("scopes the cache key by user id", () => {
    expect(profileQueryKey("user-1")).toEqual(["profile", "user-1"]);
  });

  it("is stable for undefined users", () => {
    expect(profileQueryKey(undefined)).toEqual(["profile", undefined]);
  });
});

describe("useProfile", () => {
  it("reports loading before the query settles", async () => {
    maybeSingle.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("returns the profile once the query succeeds", async () => {
    maybeSingle.mockResolvedValue({ data: ROW, error: null });
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toEqual(ROW);
    expect(result.current.isError).toBe(false);
  });

  it("falls back to the external role for an unknown role value", async () => {
    maybeSingle.mockResolvedValue({
      data: { ...ROW, role: "wizard" },
      error: null,
    });
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.profile?.role).toBe("external");
  });

  it("falls back to the external role when role is null", async () => {
    maybeSingle.mockResolvedValue({ data: { ...ROW, role: null }, error: null });
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.profile?.role).toBe("external");
  });

  it("resolves a missing profile row to null without erroring", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("surfaces a query failure as an error state", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const { result } = renderHook(() => useProfile("user-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("permission denied");
  });

  it("stays disabled and not loading without a user id", async () => {
    const { result } = renderHook(() => useProfile(undefined), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("reuses the cached profile across remounts within staleTime", async () => {
    maybeSingle.mockResolvedValue({ data: ROW, error: null });
    const queryClient = createTestQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 300_000 } });
    const sharedWrapper = ({ children }: { children: ReactNode }) =>
      createElement(TestProviders, { queryClient, children });

    const first = renderHook(() => useProfile("user-1"), {
      wrapper: sharedWrapper,
    });
    await waitFor(() => expect(first.result.current.profile).not.toBeNull());
    first.unmount();

    renderHook(() => useProfile("user-1"), { wrapper: sharedWrapper });
    await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1));
  });
});
