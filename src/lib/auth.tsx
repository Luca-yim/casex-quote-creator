import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProfile, profileQueryKey } from "@/hooks/useProfile";
import type { AppRole, Profile } from "@/lib/auth-types";
import { devLog } from "./debug-log";

export type { AppRole, Profile };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  /** True while the auth session is being restored. */
  loading: boolean;
  /** True while the profile row for the signed-in user is being fetched. */
  profileLoading: boolean;
  profileError: Error | null;
  /** True when the session exists but no profile row was found. */
  profileMissing: boolean;
  /** True only when session AND profile are both settled and present. */
  ready: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  profileLoading: true,
  profileError: null,
  profileMissing: false,
  ready: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: ["profile"] });
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const user = session?.user ?? null;
  const { profile, isLoading: profileLoading, isError, error } = useProfile(user?.id);

  devLog("[auth] user:", user?.id);
  devLog("[auth] profile loading:", loading || profileLoading);
  devLog("[auth] profile:", profile);

  const profileMissing = Boolean(user) && !loading && !profileLoading && !isError && !profile;

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.removeQueries({ queryKey: ["profile"] });
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: profile?.role ?? null,
        loading,
        profileLoading: Boolean(user) && profileLoading,
        profileError: isError ? ((error as Error | null) ?? new Error("Profile failed to load")) : null,
        profileMissing,
        ready: Boolean(user) && !loading && !profileLoading && Boolean(profile),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeRouteForRole(role: AppRole | null) {
  switch (role) {
    case "admin":
      return "/admin";
    case "estimator":
      return "/review";
    case "sales_rep":
      return "/quotes";
    default:
      return "/request-quote";
  }
}

export { profileQueryKey };
