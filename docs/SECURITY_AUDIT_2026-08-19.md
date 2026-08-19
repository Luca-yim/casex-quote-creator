# Security Audit — CaseX Pricing Calculator

**Date:** 2026-08-19
**Auditor:** Lovable agent (automated static + configuration review)
**Scope:** application source, dependency graph, build config, database access patterns
**Standards referenced:** OWASP Top 10 2025, NIST SP 800-53 rev 5 (AC/AU/IA/SC families), Supabase hardening guidance

> **Honesty note / audit integrity.** A large part of this audit could NOT be executed
> as specified, and I have not substituted guesses for evidence. Specifically:
>
> - The application's real database is an **external Supabase project**
>   (`lsmrxbpvmvrzpbtjqygh`, hardcoded in `src/lib/supabase.ts`). The database
>   credentials available to this environment point at a **different** project
>   (the Lovable Cloud backend), which contains only `profiles` and `user_roles`
>   and is **not the database the app reads or writes**. Therefore every SQL task in
>   Phase 2 (RLS coverage, policy quality, SECURITY DEFINER review, storage buckets,
>   auth settings) is **UNVERIFIED**. Exact commands for you to run are in §J.
> - `npm audit` / `bun audit` could not complete (registry audit endpoint returned
>   404 in this environment). No CVE data was retrieved. Dependency risk is
>   **UNVERIFIED** — do not read the absence of CVEs here as a clean bill of health.
> - No production deployment exists (no published URL), so response headers, TLS
>   posture and deploy-preview exposure could not be probed live.
> - I did not add or run the Phase 3 dynamic security tests; they are specified in §I
>   as runnable prompts, per your instruction not to auto-fix or expand scope.
>
> Everything below marked "confirmed" was read directly from the codebase.

---

## A. Executive summary

**Overall risk rating: HIGH (pre-production).**

The application is well structured and its business logic is unusually well tested,
but its security model rests almost entirely on assumptions that this audit could not
verify, plus two design choices that are wrong regardless of how the database is
configured. The two structural problems are: (1) **user roles are stored on the
`profiles` table** and read client-side to drive all authorization, which is the
canonical privilege-escalation pattern unless a column-level guard exists in the
database; and (2) **pricing confidentiality — the core security requirement of this
product — is enforced only in React components**, while every quote query selects
`*`, so an external user's browser almost certainly receives `margin_percent`,
`margin_justification` and pricing fields it is trusted not to render. Neither issue
is exploitable through the UI; both are trivially exploitable with the browser
console and the anon key that ships in the bundle. Add missing security headers, no
CI security gate, untracked `.env` files containing test credentials, and an
unverifiable RLS surface, and the system is not ready for production data until §B
is closed out.

---

## B. Critical findings — fix before production

### C-1. Role is stored on `profiles` and drives authorization (privilege escalation)
**Confirmed in code. Exploitability UNVERIFIED (depends on the external DB's RLS).**

`src/lib/auth.tsx` derives the app role from `profile?.role`; `ProtectedRoute` and
every visibility rule branch on it. If the `profiles` UPDATE policy on the external
project is the common `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`, then:

```js
await supabase.from('profiles').update({ role: 'estimator' }).eq('id', user.id)
```

succeeds, and the caller becomes an estimator — gaining pricing visibility, margin
control and approval rights. This is OWASP A01:2025 (Broken Access Control) and the
exact scenario NIST AC-6 (least privilege) is meant to prevent.

**Fix options (your decision — architectural):**
1. *Recommended.* Move roles to a dedicated `public.user_roles` table with **no**
   user-writable policy, plus a `SECURITY DEFINER has_role(uuid, app_role)` function
   used by all other policies. Read roles through that table in `useProfile`. Effort:
   ~4h + migration + test updates.
2. *Minimum viable.* Keep `profiles.role` but add a BEFORE UPDATE trigger that raises
   unless `NEW.role = OLD.role` or the caller is an admin. Effort: ~30min. Weaker:
   still couples identity data and authorization data in one row.

**Verification step for you:** §J-2.

---

### C-2. Pricing data is sent to clients that must never see it
**Confirmed in code.**

`src/features/intake/useQuote.ts`, `useSalesRepQuotes.ts` and `useReviewQueue.ts` all
issue `.select("*")`. Concealment happens afterwards, in the UI:
`IntakeContext.tsx:20` (`if (role === "external") return false`),
`PricingSidebar.tsx:96`, `QuotePdfDownloadButton.tsx:37`.

Postgres RLS is row-level, not column-level. Unless you have added a restricted view
or column grants on the external project, an external requester's session receives
the full quote row — margin, justification, TCV inputs — and it is visible in the
Network tab and in `window` state. The UI gate is a display convenience, not a
control. Same applies to a sales rep viewing a not-yet-approved quote.

**Fix options:**
1. *Recommended.* Add a `quotes_client_view` (or explicit column list per role) and
   have external/rep-pre-approval reads select only non-pricing columns. Combine with
   a `REVOKE SELECT (margin_percent, margin_justification, ...) ON quotes FROM
   authenticated` + targeted `GRANT` to estimator-only paths. Effort: ~6h.
2. Route all quote reads through a server function that strips fields by role before
   returning. Effort: ~8h, but centralises the rule and is testable.
3. Accept the exposure and document it as "pricing is confidential from the UI, not
   from a determined authenticated user". **Not recommended** — it contradicts the
   product's stated requirement.

---

### C-3. Entire RLS, storage and auth-configuration surface is unverified
**UNVERIFIED — requires manual review.**

The database the app actually uses is not reachable from this environment. I cannot
confirm that `quotes`, `quote_versions`, `quote_pdfs`, `notifications`,
`pricing_catalog` or `profiles` have `rowsecurity = true`, that each has policies,
that the `quote-pdfs` bucket is private, or that any SECURITY DEFINER function sets
`search_path`. The DB test suite (`src/test/db/rls.test.ts`) provides *positive*
evidence for several important behaviours (anon reads denied on quotes/profiles/
notifications/catalog; cross-owner insert rejected; external cannot read or update a
rep's draft) — that is real, mutation-sensitive coverage and I am counting it. It
does **not** cover: column-level exposure, storage policies, role mutation,
`quote_versions` / `quote_pdfs` policies, or delete permissions.

Run §J in full before go-live. Treat any table with RLS off, or RLS on with zero
policies, as a critical finding at that point.

---

## C. High-severity findings — fix within 30 days

### H-1. Dependency vulnerability status is unknown; no CI security gate
`bun audit` failed (registry 404) and there is **no `.github/` directory at all** —
no CI, therefore no `npm audit` on build, no Dependabot/Renovate, no branch
protection, no required-tests gate. OWASP A06:2025 (Vulnerable and Outdated
Components) and A08 (Software and Data Integrity Failures) are unaddressed as a
process. Dependencies are pinned via `bun.lock`, and `bunfig.toml` enforces a 24h
minimum release age (a good supply-chain control, worth keeping). Effort to fix: ~3h
to add a CI workflow running lint + typecheck + vitest + audit, and enable Dependabot.

### H-2. `.env` and `.env.test` are tracked and contain credentials
`.gitignore` excludes only `.env.test.local`. Both `.env` and `.env.test` exist in the
working tree and are **not** ignored. `.env.test` contains the external project's
publishable anon key (public by design — low impact) **and six test-account
passwords** (`TestPass123!`) for external/rep/estimator personas. If those accounts
exist on the production project, they are pre-published credentials to real roles.
NIST IA-5 violation. Fix: add `.env*` to `.gitignore` (keeping `.env.example`),
rotate the three test passwords, and confirm those accounts do not exist on the
production project. Effort: ~1h.

### H-3. No security headers and no CSP
`src/server.ts` sets only `content-type`. There is no Content-Security-Policy,
`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, or frame-ancestors control. The app renders user-supplied
customer names and loads Google Fonts from a remote origin, so a CSP is the main
compensating control against injected script. OWASP A05:2025 (Security
Misconfiguration). Fix: add a response-header middleware in `src/server.ts` with a
CSP allowing `self`, the Supabase origin, and the two font origins. Effort: ~2h
including tuning for the PDF worker and Vite dev.

### H-4. Authorization is client-side only, by construction
`ProtectedRoute` (`src/components/ProtectedRoute.tsx`) redirects with `useNavigate`
inside a `useEffect` and renders a spinner meanwhile — the child tree is never
mounted, so this is adequate as UX, but it is not a control: the data is fetched by
the same browser that decides the role. Every guarantee therefore reduces to RLS
(see C-3). This is a note to prevent false confidence in the route guards, not a
demand to rewrite them — the correct remedy is C-1 + C-2, not more client checks.

---

## D. Medium-severity findings — next sprint

- **M-1. Weak password policy.** `src/routes/signup.tsx:30` requires only 6
  characters, no complexity. August 2026 baseline (and NIST SP 800-63B as applied by
  SP 800-53 IA-5) is ≥12 characters with a breached-password check. Supabase's own
  minimum must be raised in parallel (§J-5) or client validation is cosmetic.
- **M-2. Signup is open.** Anyone can self-register at `/signup` and lands as
  `external`. For an internal Speridian tool this should be invite-only or
  admin-approved; at minimum, restrict signup to allowed email domains.
- **M-3. No input length bounds.** No `.max()` on any string schema
  (`signup.tsx`, quote fields). A multi-megabyte `customer_name` is accepted by
  validation and forwarded to Postgres and to `@react-pdf/renderer`. Add `.max(200)`
  class bounds and a server/DB-side length constraint.
- **M-4. Typed-client bypasses.** Ten `as any` / `as unknown as` casts, notably
  `useQuotePdfHistory.ts:21`, `useQuotePdfDownload.ts:49`,
  `version-snapshot.ts:63`, `useDebouncedSave.ts:51`, `useSubmitQuote.ts:22`. These
  exist because `quote_pdfs` and some columns are missing from
  `src/lib/database.types.ts`. They disable exactly the compile-time checks that would
  catch a mis-shaped write to a security-relevant table. Regenerate types and remove
  the casts.
- **M-5. Debug logging of identity and business data.**
  `src/lib/auth.tsx:72-74` logs the user id and the **entire profile object** to the
  console on every render; `useSalesRepQuotes.ts:27`, `useQuote.ts:53,64`,
  `useReviewQueue.ts:30-32` log full quote payloads including pricing. These run in
  production builds. NIST AU-9/SI-11. Remove or gate behind `import.meta.env.DEV`.
- **M-6. Dual-backend configuration hazard.** The app talks to
  `lsmrxbpvmvrzpbtjqygh` (hardcoded URL + hardcoded fallback anon key in
  `src/lib/supabase.ts:16-25`) while a second, Lovable-managed Supabase project is
  also wired into the repo (`.env`, `src/integrations/supabase/*`). The hardcoded
  fallback means a misconfigured environment silently points at the real production
  project instead of failing. Make the key required (throw when absent) and delete
  the unused integration to remove ambiguity.
- **M-7. No rate limiting or abuse controls implemented in-app.** Quote creation,
  PDF generation (CPU-heavy, runs client-side but writes to storage on every call)
  and realtime subscriptions have no throttle. Supabase's defaults apply to auth
  endpoints only. Storage growth is acknowledged as unbounded in a code comment in
  `useQuotePdfDownload.ts`.

---

## E. Low-severity / informational

- **L-1.** Publishable anon key hardcoded as a fallback in `src/lib/supabase.ts`.
  Public by design, so not a secret leak — but see M-6 for the real problem with it.
- **L-2.** JWT lives in `localStorage` (Supabase default). Acceptable and standard;
  the residual risk is XSS-driven token theft, which is why H-3 (CSP) matters.
  Cookie-based storage with `SameSite=Strict` is the higher-security alternative and
  is an architecture decision, not a defect — flagged for your call, not fixed.
- **L-3.** CSRF is not applicable to the Supabase Data API (bearer token in header,
  not cookies). Server functions are separately protected by
  `createCsrfMiddleware` in `src/start.ts`. Confirmed adequate.
- **L-4.** One `dangerouslySetInnerHTML` at `src/components/ui/chart.tsx:73` — this
  is stock shadcn chart theming that interpolates a fixed config object, not user
  input. Reviewed and cleared (see §F).
- **L-5.** No data-retention or deletion procedure documented; no incident-response
  plan in the repo.

---

## F. False positives ruled out (showing the work)

| Candidate | Verdict | Evidence |
|---|---|---|
| Hardcoded service_role key | **Clean** | Only `process.env['SUPABASE_SERVICE_ROLE_KEY']` references, all inside `src/integrations/supabase/client.server.ts` (server-only module). No literal key anywhere in `src/`, `e2e/`, or migrations. |
| Private keys / cloud credentials in repo | **Clean** | Pattern scan for PEM blocks, `AKIA…`, `sk_live/sk_test`, `ghp_…` returned zero hits outside `node_modules`. |
| `dangerouslySetInnerHTML` XSS | **Not exploitable** | `chart.tsx:73` builds a CSS string from the developer-supplied chart config; no user data path reaches it. |
| PDF storage path traversal | **Not exploitable from the client path** | `useQuotePdfDownload.ts` builds `${quote.id}/${version}-${isoStamp}` where `quote.id` is a DB-issued UUID and `version` is a union type. A crafted request could still bypass the app — which is why the storage policy's `split_part` check must be verified (§J-4). |
| `eval` / dynamic `Function` / non-literal RegExp | **Clean** | No hits in `src/` or `e2e/`. |
| TypeScript strictness | **Clean** | `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Zero `@ts-ignore` / `@ts-expect-error` in the codebase. The weakness is the `as any` casts (M-4), not the compiler config. |
| SQL injection | **Not applicable** | All database access goes through PostgREST via `supabase-js` parameter binding. No raw SQL string concatenation in `src/`. A literal `'; DROP TABLE quotes;--` stores as text. |
| GPL/AGPL license contamination | **UNVERIFIED, low concern** | Not machine-checked (audit tooling unavailable). Direct dependencies are all MIT/Apache-2.0 by reputation (React, Radix, TanStack, Supabase, Zod, `@react-pdf/renderer`). Worth one automated pass via `license-checker` before shipping. |
| Typosquatting / unusual registries | **Clean** | All dependencies resolve to well-known npm packages; `@lovable.dev/*` scoped packages are first-party platform packages. |

---

## G. Compliance posture

### OWASP Top 10 2025

| # | Category | Status |
|---|---|---|
| A01 | Broken Access Control | **FAIL** — C-1, C-2, H-4 |
| A02 | Cryptographic Failures | **UNVERIFIED** — TLS/at-rest handled by Supabase, not independently confirmed; no production deployment to probe |
| A03 | Injection | **PASS** — parameterised access, no eval, React escaping; one cleared `dangerouslySetInnerHTML` |
| A04 | Insecure Design | **PARTIAL** — approval workflow and state machine are well designed and DB-enforced (check constraints + transition guard verified by tests); confidentiality design is not (C-2) |
| A05 | Security Misconfiguration | **FAIL** — H-3 (no headers/CSP), M-2 (open signup), M-6 (dual backend) |
| A06 | Vulnerable & Outdated Components | **UNVERIFIED** — audit tooling unavailable; no CI gate (H-1) |
| A07 | Identification & Auth Failures | **FAIL** — M-1 (6-char passwords), M-2, plus unverified session/MFA settings |
| A08 | Software & Data Integrity Failures | **PARTIAL** — lockfile pinned and 24h release-age guard is good; no CI verification, no signed builds |
| A09 | Security Logging & Monitoring Failures | **FAIL** — no application logging strategy, no alerting, and debug logs leak data (M-5) |
| A10 | Server-Side Request Forgery | **PASS** — no server-side fetch of user-supplied URLs |

### GDPR readiness

| Requirement | Status |
|---|---|
| Inventory of personal data | **Partial** — `customer_name`, `customer_email`, plus `profiles.email/full_name/company`. No documented inventory. |
| Lawful basis / privacy notice | **No** — none present in the app |
| Encryption at rest / in transit | **UNVERIFIED** — Supabase-managed, confirm per §J-6 |
| Right to erasure procedure | **No** — no documented or implemented deletion path; quote versions and archived PDFs would retain customer data after any row delete |
| Retention limits | **No** — code comment explicitly defers PDF pruning |
| Breach-notification process | **No** — no incident-response plan |
| Processor agreements | **UNVERIFIED** — Supabase DPA status is a Speridian procurement question |

### SOC 2 gap analysis (Security / Confidentiality criteria)

Material gaps: **CC6.1** logical access (C-1, C-2), **CC6.6** boundary protection
(H-3), **CC7.2** monitoring and anomaly detection (none), **CC8.1** change management
(no CI, no branch protection, no PR review requirement), **C1.1** confidential-data
handling (C-2 directly contradicts the stated confidentiality control). The strong
automated test suite is genuine evidence toward CC8.1 once it gates merges.

---

## H. Recommended remediation priorities

| Rank | Item | Effort | Blocking production? |
|---|---|---|---|
| 1 | C-3 — run the §J SQL and settle the RLS/storage/auth picture | 1–2h | Yes |
| 2 | C-1 — stop roles being self-writable (trigger now, `user_roles` properly) | 0.5h / 4h | Yes |
| 3 | C-2 — column-level pricing confidentiality | 6–8h | Yes |
| 4 | H-2 — gitignore `.env*`, rotate test passwords | 1h | Yes |
| 5 | M-1 / M-2 — password policy ≥12 chars, close open signup | 2h | Yes |
| 6 | H-3 — security headers + CSP | 2h | Strongly recommended |
| 7 | M-5 — strip debug logging of profiles/quotes | 0.5h | Strongly recommended |
| 8 | H-1 — CI with lint/typecheck/tests/audit + Dependabot | 3h | No |
| 9 | M-3 — input length bounds (Zod + DB constraints) | 2h | No |
| 10 | M-4 — regenerate DB types, delete `as any` casts | 2h | No |
| 11 | M-6 — remove hardcoded key fallback / unused second backend | 1h | No |
| 12 | M-7 — rate limits, PDF retention job | 4h | No |
| 13 | L-5 — retention policy, deletion runbook, IR plan | 4h | No |

---

## I. Security tests to add to CI (runnable prompts)

Each of these is a self-contained prompt you can hand back to me later.

1. *"Add `e2e/security/auth-bypass.spec.ts`: unauthenticated visits to /quotes, /review, /admin and /notifications must land on /login; a malformed JWT, an expired JWT and a JWT signed with the wrong key placed in localStorage must each force re-authentication rather than rendering the page."*
2. *"Add `src/test/db/authz.test.ts` covering privilege escalation: a signed-in rep updating their own `profiles.role` to 'admin' or 'estimator' must fail; a rep inserting a notification for another user must fail; a rep deleting any quote must fail; a rep updating `margin_percent` on an approved quote must fail."*
3. *"Add `src/test/db/column-exposure.test.ts`: sign in as the external persona, read a quote they requested, and assert the returned object contains no `margin_percent`, `margin_justification`, or any pricing column. This test must fail today — that is the point."*
4. *"Add `src/test/db/storage-policy.test.ts`: as a rep, attempt uploads to `quote-pdfs` at `../../../etc/passwd.pdf`, at another user's quote id prefix, and at a path with no quote-id segment; all three must be rejected. Also assert the bucket is private by fetching its public URL and expecting a non-200."*
5. *"Add `e2e/security/injection.spec.ts`: create a quote with customer_name set to `<script>alert(1)</script>`, `'; DROP TABLE quotes;--`, a 1,000,000-character string, and `Аdmin` (Cyrillic А). Assert the first two render as literal text in the UI and in the generated PDF, the third is rejected by validation, and the fourth round-trips byte-identically."*
6. *"Add a GitHub Actions workflow running lint, tsgo typecheck, vitest, and a dependency audit on every PR, with the audit failing the build on high or critical advisories; enable Dependabot for npm."*
7. *"Add `src/test/security/headers.test.ts` asserting the server response carries Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy and a frame-ancestors directive."*

---

## J. Requires manual verification — exact steps

Run these against the **external project `lsmrxbpvmvrzpbtjqygh`** (SQL editor of that
project, or `psql` with its connection string). Paste the output back to me and I will
fold it into this report.

**J-1 — RLS coverage**
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

select tablename, count(*) as policy_count from pg_policies
where schemaname = 'public' group by tablename order by tablename;
```
Any table with `rowsecurity = false`, or `true` with zero policies, is critical.

**J-2 — Policy quality, focused on the escalation path in C-1**
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;
```
Look specifically at the `profiles` UPDATE policy: if its `with_check` does not
prevent `role` from changing, C-1 is confirmed exploitable.

**J-3 — SECURITY DEFINER functions**
```sql
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p where p.prosecdef and p.pronamespace = 'public'::regnamespace;
```
Each must contain `SET search_path`. Also confirm `REVOKE ALL ON FUNCTION … FROM PUBLIC;`
followed by `GRANT EXECUTE … TO authenticated;`.

**J-4 — Storage**
```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
select policyname, cmd, qual, with_check from pg_policies where schemaname = 'storage';
```
`quote-pdfs` must have `public = false`, a size limit, `allowed_mime_types` restricted
to `application/pdf`, and a policy that ties the first path segment to a quote the
caller may access.

**J-5 — Auth settings** (that project's dashboard → Authentication → Providers/Policies)
Record and tighten: minimum password length (set ≥12), leaked-password protection
(enable), JWT expiry (1h), refresh-token rotation (enable), session timeout (24h for
an internal tool, not the 1-week default), email confirmation (require), signup
(disable open signup or restrict to Speridian domains), MFA (enable for estimator and
admin at minimum), auth rate limits.

**J-6 — Platform assurances**
Confirm from that project's settings: encryption at rest, PITR/backup configuration
and backup encryption, log retention period, and whether auth logs are retained long
enough for your compliance requirement.

**J-7 — Dependency audit** (from a network-enabled shell)
```
npm audit --json > audit-report.json
npx license-checker --summary
```

**J-8 — Bundle check for secrets** (after a production build)
```
npm run build && grep -r "service_role\|SERVICE_ROLE" dist/ .output/ || echo clean
```
Static reading says this will be clean — the service-role key is only referenced in
`client.server.ts`, a server-only module — but confirm empirically before release.
