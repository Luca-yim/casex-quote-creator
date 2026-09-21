import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY, isTurnstileEnabled, loadTurnstile } from "@/lib/turnstile";
import { devLog } from "@/lib/debug-log";

export interface TurnstileWidgetProps {
  /** Called with a fresh token each time the challenge is solved. */
  onToken: (token: string) => void;
  /** Called when the widget errors or the token expires. */
  onExpire?: () => void;
}

/** Human-readable hints for the Cloudflare error codes we can act on. */
function describeError(code: string | undefined): string {
  if (code?.startsWith("110200")) {
    return "This site's verification widget is not authorised for this domain. Add this hostname to the Turnstile widget's allowed domains in Cloudflare.";
  }
  return "The verification challenge couldn't load. Please refresh and try again.";
}

/**
 * Renders the Cloudflare Turnstile challenge. Only mounted on the step of the
 * lead-intake flow that triggers anonymous sign-in — never on every step.
 */
export function TurnstileWidget({ onToken, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const tokenRef = useRef(onToken);
  const expireRef = useRef(onExpire);
  tokenRef.current = onToken;
  expireRef.current = onExpire;

  useEffect(() => {
    const siteKey = TURNSTILE_SITE_KEY;
    devLog("[turnstile] mount", {
      hasSiteKey: Boolean(siteKey),
      siteKeyLength: siteKey?.length ?? 0,
      enabled: isTurnstileEnabled,
      hostname: typeof window !== "undefined" ? window.location.hostname : null,
    });
    if (!siteKey || !isTurnstileEnabled) return;
    let widgetId: string | null = null;
    let cancelled = false;

    void loadTurnstile()
      .then((api) => {
        devLog("[turnstile] script loaded", {
          containerPresent: Boolean(containerRef.current),
          cancelled,
        });
        if (cancelled || !containerRef.current) return;
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            devLog("[turnstile] success callback fired", { hasToken: Boolean(token) });
            setErrorCode(null);
            setFailed(false);
            tokenRef.current(token);
          },
          "error-callback": (code?: string) => {
            devLog("[turnstile] error callback", { code: code ?? "unknown" });
            setErrorCode(code ?? null);
            setFailed(true);
            expireRef.current?.();
          },
          "expired-callback": () => {
            devLog("[turnstile] token expired");
            expireRef.current?.();
          },
        });
        devLog("[turnstile] render called", { rendered: Boolean(widgetId) });
      })
      .catch((err) => {
        devLog("[turnstile] script failed to load", { message: (err as Error)?.message });
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!TURNSTILE_SITE_KEY || !isTurnstileEnabled) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} data-testid="turnstile-widget" className="min-h-[65px]" />
      {failed && (
        <p className="text-xs text-destructive">
          {describeError(errorCode ?? undefined)}
          {errorCode ? ` (error ${errorCode})` : null}
        </p>
      )}
    </div>
  );
}
