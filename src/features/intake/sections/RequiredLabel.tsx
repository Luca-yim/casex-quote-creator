import type { ReactNode } from "react";

/**
 * Wraps a field label with a red asterisk marking it as required.
 * The asterisk is aria-hidden — screen readers get the requirement from the
 * input's own `aria-required` attribute.
 */
export function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span>
      {children}
      <span className="ml-0.5 text-destructive" aria-hidden>
        *
      </span>
    </span>
  );
}
