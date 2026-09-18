/**
 * Cloudflare Turnstile helpers for the public lead-intake route.
 *
 * The site key is PUBLIC by design (it ships in the HTML). The matching
 * *secret* key lives only in the Supabase Auth CAPTCHA settings and must never
 * appear in this repo or in any VITE_* variable.
 *
 * When VITE_APP_TURNSTILE_SITE_KEY is unset the widget is skipped entirely and
 * anonymous sign-in runs without a token (local dev / unit tests).
 */

const rawSiteKey = import.meta.env["VITE_APP_TURNSTILE_SITE_KEY"] as string | undefined;

export const TURNSTILE_SITE_KEY = rawSiteKey?.trim() ? rawSiteKey.trim() : null;

/**
 * Development-only escape hatch for the Lovable preview environment.
 *
 * Requires BOTH conditions, so a production/Vercel bundle can never activate it:
 *  1. import.meta.env.DEV — true only for the dev server (Lovable preview);
 *     statically false in any production build, so the branch is dead code there.
 *  2. VITE_DISABLE_TURNSTILE_PREVIEW === "true" — explicit opt-in, default off.
 *
 * It is not readable from, or togglable by, any URL parameter or hostname string.
 */
export const isTurnstileBypassed =
  import.meta.env.DEV &&
  (import.meta.env["VITE_DISABLE_TURNSTILE_PREVIEW"] as string | undefined)?.trim() === "true";

/** True when a site key is configured and the widget should be rendered. */
export const isTurnstileEnabled = TURNSTILE_SITE_KEY !== null && !isTurnstileBypassed;

if (isTurnstileBypassed && typeof window !== "undefined") {
  // Dev-only diagnostic; stripped from production bundles with the branch above.
  console.warn(
    "[turnstile] Bypassed: VITE_DISABLE_TURNSTILE_PREVIEW=true in the development/preview environment. " +
      "This never applies to production or Vercel builds.",
  );
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Injects the Turnstile script once and resolves with its global API. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile needs a browser"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded without a global"));
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", () => reject(new Error("Turnstile script failed to load")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}
