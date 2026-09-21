# Correct Section 1 questionnaire visibility

## Root cause
`CustomerInfoSection` renders Opportunity Stage, Deal Priority, and Deal Template unconditionally. Because the same `IntakeForm` is used for Ballpark and Proposal quotes, these Proposal/internal metadata controls leak into the Ballpark questionnaire.

## Changes
- Gate only these three controls behind an internal Proposal check: Proposal tier plus a non-external authorized internal role.
- Keep their form values, defaults, autosave column mapping, row mapping, and Section 1 migration unchanged.
- Leave Quote Validity Date, Q2.2 Geographic Scope, and Q2.3 Pricing Schedule behavior unchanged.
- Make no database, pricing, workflow, PDF, snapshot, or deployment changes.

## Tests
- Add form-level coverage proving the three controls are hidden for Ballpark and external users but retained for authorized internal Proposal users.
- Add public-intake coverage proving none of the three controls appear there.
- Assert Ballpark readiness and submission remain independent of these fields.
- Preserve and run Section 1 mapping/default/persistence tests, Section 2 tests, external visibility tests, and pricing regression tests.
- Run the focused tests, then the full test suite and report any pre-existing failures separately.

## Technical detail
The smallest correction is a render boundary inside `CustomerInfoSection`, using the existing intake quote tier and role. No fields or mappings will be removed, so stored values continue to hydrate and autosave on the authorized Proposal surface.
