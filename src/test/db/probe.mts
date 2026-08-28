import { signInAs, draftPayload, transitionQuote } from "./supabase-clients";
const est = (await signInAs("estimator"))!;
const rep = (await signInAs("rep"))!;
// rep view of a version snapshot
const p = draftPayload(rep.userId, { margin_percent: 21, margin_justification: "probe" });
console.log("insert", (await rep.client.from("quotes").insert(p)).error?.message);
await rep.client.from("quotes").update({ submitted_at: new Date().toISOString() }).eq("id", p.id);
console.log("t", (await transitionQuote(rep, p.id, "submitted_for_review")).error);
for (const a of [rep, est]) {
  const { data, error } = await a.client.rpc("quote_versions_scoped" as any).select("*").eq("quote_id", p.id);
  const snap: any = (data as any)?.[0]?.snapshot;
  console.log(a.role, error?.message, snap && Object.keys(snap).filter(k=>/margin/i.test(k)), snap && snap.marginPercent);
}
// notification insert attempt as rep
const ni = await rep.client.from("notifications").insert({ user_id: est.userId, type: "quote_submitted", quote_id: p.id, title: "probe" });
console.log("notif insert as rep:", ni.error?.message ?? "ok");
// did trigger create notification for estimator?
const { data: nd } = await est.client.from("notifications").select("*").eq("quote_id", p.id);
console.log("notifs for est:", JSON.stringify(nd));
const { data: nr, error: nre } = await rep.client.from("notifications").select("*").eq("quote_id", p.id);
console.log("notifs visible to rep:", JSON.stringify(nr), nre?.message);
// quote_pdfs insert
const pdfRow = (v: string) => ({ quote_id: p.id, version: v, storage_path: `${p.id}/${v}-probe.pdf`, file_size_bytes: 10 });
console.log("rep internal:", (await rep.client.from("quote_pdfs").insert(pdfRow("internal"))).error?.message ?? "ok");
console.log("rep customer:", (await rep.client.from("quote_pdfs").insert(pdfRow("customer"))).error?.message ?? "ok");
console.log("est internal:", (await est.client.from("quote_pdfs").insert({...pdfRow("internal"), storage_path:`${p.id}/internal-est.pdf`})).error?.message ?? "ok");
await rep.client.from("quotes").delete().eq("id", p.id);
