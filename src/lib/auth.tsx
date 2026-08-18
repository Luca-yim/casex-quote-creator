import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "external" | "sales_rep" | "estimator" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

const ROLE_PRIORITY: AppRole[] = ["admin", "estimator", "sales_rep", "external"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrate(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      const userId = nextSession.user.id;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      const nextProfile = (profileRow as Profile | null) ?? null;
      setProfile(nextProfile);
      const claimed = nextProfile?.role as AppRole | null | undefined;
      setRole(claimed && ROLE_PRIORITY.includes(claimed) ? claimed : "external");
      setLoading(false);
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setTimeout(() => void hydrate(nextSession), 0);
    });

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, profile, role, loading, signOut }}
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
