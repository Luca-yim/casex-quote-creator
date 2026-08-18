/** Inline Zod/react-hook-form validation message. */
export function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
