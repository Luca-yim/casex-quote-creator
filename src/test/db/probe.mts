import { signInAs, draftPayload, transitionQuote } from "./supabase-clients";
const est = (await signInAs("estimator"))!;
const rep = (await signInAs("rep"))!;
const p = draftPayload(rep.userId, { margin_percent: 21, margin_justification: "probe" });
await rep.client.from("quotes").insert(p);
const snapshot = { id: p.id, margin_percent: 21, margin_justification: "why", marginPercent: 21 };
await rep.client.from("quote_versions").insert({ id: crypto.randomUUID(), quote_id: p.id, version_number: 1, snapshot, changed_by: rep.userId });
await rep.client.from("quotes").update({ submitted_at: new Date().toISOString() }).eq("id", p.id);
console.log((await transitionQuote(rep, p.id, "submitted_for_review")).error);
for (const a of [rep, est]) {
  const { data, error } = await a.client.rpc("quote_versions_scoped" as any).select("*").eq("quote_id", p.id).order("version_number", { ascending: false });
  console.log(a.role, error?.message, JSON.stringify(data));
}
await rep.client.from("quotes").delete().eq("id", p.id);
