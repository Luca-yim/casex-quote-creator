import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  transitionQuote,
  type TestActors,
} from "./supabase-clients";

/**
 * Internal PDFs carry pricing detail, so only estimators may record one.
 * A sales rep may generate customer-facing PDFs only.
 */

let actors: TestActors;
let ready = false;
const created: string[] = [];
let quoteId = "";

function pdfRow(id: string, version: "internal" | "customer", generatedBy: string) {
  return {
    quote_id: id,
    version,
    storage_path: `${id}/${version}-${Date.now()}.pdf`,
    file_size_bytes: 1024,
    generated_by: generatedBy,
  };
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) {
    console.warn(SKIP_REASON);
    return;
  }
  const rep = actors.rep!;
  const payload = draftPayload(rep.userId, { name: `PDF scope ${Date.now()}` });
  const { error } = await rep.client.from("quotes").insert(payload);
  if (error) throw new Error(error.message);
  quoteId = payload.id;
  created.push(payload.id);

  await rep.client
    .from("quotes")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", payload.id);
  await transitionQuote(rep, payload.id, "submitted_for_review");
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("quote_pdfs internal version scope", () => {
  it("rejects an internal PDF row from a sales rep", async () => {
    if (!ready) return;
    const { error } = await actors
      .rep!.client.from("quote_pdfs")
      .insert(pdfRow(quoteId, "internal", actors.rep!.userId));
    expect(error).not.toBeNull();
  });

  it("accepts an internal PDF row from an estimator", async () => {
    if (!ready) return;
    const { error } = await actors
      .estimator!.client.from("quote_pdfs")
      .insert(pdfRow(quoteId, "internal", actors.estimator!.userId));
    expect(error).toBeNull();
  });
});
