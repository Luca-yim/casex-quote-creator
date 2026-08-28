import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY, loadTurnstile } from "@/lib/turnstile";

export interface TurnstileWidgetProps {
  /** Called with a fresh token each time the challenge is solved. */
  onToken: (token: string) => void;
  /** Called when the widget errors or the token expires. */
  onExpire?: () => void;
}

/**
 * Renders the Cloudflare Turnstile challenge. Only mounted on the step of the
 * lead-intake flow that triggers anonymous sign-in — never on every step.
 */
export function TurnstileWidget({ onToken, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const tokenRef = useRef(onToken);
  const expireRef = useRef(onExpire);
  tokenRef.current = onToken;
  expireRef.current = onExpire;

  useEffect(() => {
    const siteKey = TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    let widgetId: string | null = null;
    let cancelled = false;

    void loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => tokenRef.current(token),
          "error-callback": () => {
            setFailed(true);
            expireRef.current?.();
          },
          "expired-callback": () => expireRef.current?.(),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} data-testid="turnstile-widget" />
      {failed && (
        <p className="text-xs text-destructive">
          The verification challenge couldn't load. Please refresh and try again.
        </p>
      )}
    </div>
  );
}
