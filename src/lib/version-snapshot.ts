import { supabase } from "@/lib/supabase";

/** Kind of pipeline event that produced a snapshot. */
export type VersionChangeType =
  | "submit"
  | "claim"
  | "adjust"
  | "approve"
  | "return"
  | "send"
  | "accept"
  | "decline"
  | "pdf_generated"
  | "promote";

export interface WriteVersionSnapshotInput {
  quoteId: string;
  /** Full quote object as it exists at snapshot time. */
  quoteData: unknown;
  changeReason: string;
  changedBy: string | undefined | null;
  changeType: VersionChangeType;
}

/**
 * Appends an immutable snapshot row to `quote_versions`.
 *
 * The remote table has no dedicated `change_type` column, so the type is
 * carried inside the JSON snapshot under `__changeType` and read back by the
 * version-history UI.
 *
 * Throws on failure — audit-trail writes are never swallowed.
 */
export async function writeVersionSnapshot({
  quoteId,
  quoteData,
  changeReason,
  changedBy,
  changeType,
}: WriteVersionSnapshotInput): Promise<{ version_number: number }> {
  const { data: latest, error: readError } = await supabase
    .from("quote_versions")
    .select("version_number")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw Object.assign(new Error(readError.message), { code: readError.code });
  }

  const versionNumber = (latest?.version_number ?? 0) + 1;

  const snapshot = {
    ...(typeof quoteData === "object" && quoteData ? quoteData : { value: quoteData }),
    __changeType: changeType,
  };

  const { error: insertError } = await supabase.from("quote_versions").insert({
    quote_id: quoteId,
    version_number: versionNumber,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshot: snapshot as any,
    change_reason: changeReason,
    changed_by: changedBy ?? null,
    changed_at: new Date().toISOString(),
  });

  if (insertError) {
    throw Object.assign(new Error(insertError.message), { code: insertError.code });
  }

  return { version_number: versionNumber };
}

/** Reads the change type back out of a stored snapshot payload. */
export function snapshotChangeType(snapshot: unknown): VersionChangeType | null {
  if (snapshot && typeof snapshot === "object" && "__changeType" in snapshot) {
    return (snapshot as { __changeType: VersionChangeType }).__changeType;
  }
  return null;
}
