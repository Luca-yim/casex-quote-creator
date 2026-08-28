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

/** True when a site key is configured and the widget should be rendered. */
export const isTurnstileEnabled = TURNSTILE_SITE_KEY !== null;

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
