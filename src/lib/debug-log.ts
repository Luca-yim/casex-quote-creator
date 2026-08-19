/**
 * Development-only logger.
 *
 * Debug output is stripped in production builds so quote payloads, profile
 * records, and Supabase responses never land in a end user's console.
 */
export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.debug(...args);
}
