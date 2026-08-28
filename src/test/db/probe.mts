import { signInAs, draftPayload, transitionQuote } from "./supabase-clients";
const est = (await signInAs("estimator"))!;
const rep = (await signInAs("rep"))!;
const p = draftPayload(rep.userId, { margin_percent: 21, margin_justification: "probe" });
await rep.client.from("quotes").insert(p);
const vid = crypto.randomUUID();
const snapshot = { id: p.id, name: "x", marginPercent: 21, margin_percent: 21, margin_justification: "why", marginJustification: "why" };
console.log("ver insert rep:", (await rep.client.from("quote_versions").insert({ id: vid, quote_id: p.id, version_number: 1, snapshot, change_reason: "probe", changed_by: rep.userId })).error?.message ?? "ok");
for (const a of [rep, est]) {
  const { data, error } = await a.client.rpc("quote_versions_scoped" as any).select("*").eq("quote_id", p.id);
  console.log(a.role, error?.message, JSON.stringify((data as any)?.[0]?.snapshot));
}
const pdf = (v: string, by: string) => ({ quote_id: p.id, version: v, storage_path: `${p.id}/${v}-${by}.pdf`, file_size_bytes: 10, generated_by: by });
console.log("rep internal:", (await rep.client.from("quote_pdfs").insert(pdf("internal", rep.userId))).error?.message ?? "ok");
console.log("rep customer:", (await rep.client.from("quote_pdfs").insert(pdf("customer", rep.userId))).error?.message ?? "ok");
console.log("est internal:", (await est.client.from("quote_pdfs").insert(pdf("internal", est.userId))).error?.message ?? "ok");
await rep.client.from("quotes").delete().eq("id", p.id);
