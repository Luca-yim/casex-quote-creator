import { signInAs } from "./supabase-clients";
const est = await signInAs("estimator");
const rep = await signInAs("rep");
console.log("est", !!est, "rep", !!rep);
if (!est) process.exit(1);
for (const fn of ["quote_versions_scoped"]) {
  const { data, error } = await est.client.rpc(fn as any).select("*").limit(1);
  console.log(fn, error?.message ?? JSON.stringify(data)?.slice(0,300));
}
for (const t of ["notifications","quote_pdfs","quote_versions"]) {
  const { data, error } = await est.client.from(t).select("*").limit(1);
  console.log(t, error?.message ?? JSON.stringify(data)?.slice(0,400));
}
