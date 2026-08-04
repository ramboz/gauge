---
status: DONE
dependencies: [007-01, 007-02, adr-0010]
last_verified: 2026-08-04
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 008-01 — Flat layout + honest completion (jig preset unchanged)

**Goal:** The adapter reads a **flat** `specs/<name>.md` layout (declared via a
new profile-v1 `specLayout` capability) and reports honest completion — a root
with no recognized delivery status observes as **"N documents · completion
`unknown`"**, never a false `0%` — so `mystique/docs/superpowers` flips from a
blank "unsupported" card to a truthful one, while every existing jig card stays
byte-identical.

**DoR:**
- ✅ ADR-0010 Accepted (generic-doc-adapter; `jig` = preset; `specLayout`;
  vocabulary-gated completion).
- ✅ 007-01/02 DONE (profile-v1 with `artifactRoot`/overrides + `entries[]`).
- Resolve the **byte-identical tension** (Assumptions): decide whether
  status-absent *jig* specs keep their current denominator treatment (they must,
  for byte-identical jig cards) while the `unknown` floor applies at the root
  level when no recognized delivery status exists.

**Acceptance Criteria:**

1. **`specLayout` is an additive profile-v1 capability.** The schema
   (`schemas/project-profile-v1.schema.json`) and runtime validator
   (`src/profile.mjs`) gain `specLayout` ∈ {`nested`, `flat`, `auto`} at the
   profile and per-`entries[]` level, defaulting to `nested`. A profile with no
   `specLayout` validates and behaves exactly as today (007 identity).
2. **The adapter reads a flat layout.** With `specLayout: flat`, the adapter
   discovers spec artifacts as `<specsDir>/<name>.md` files (not
   `<dir>/spec.md`); with `nested` (or default) it behaves exactly as today. Each
   flat file is one spec artifact; its title comes from its first `#` heading (or
   filename), consistent with the nested reader.
3. **Completion is vocabulary-gated; status-absent → `unknown`, never `0%`.**
   For a root whose artifacts resolve **no** status in the recognized jig
   delivery vocabulary (a to-be-defined allowlist over `normStatus`), the adapter
   reports execution completion **`unknown`** (an evidenced insufficient-signal
   state), not `0/N`. The status-absent artifacts are surfaced as a count
   (`N documents`), consistent with the "unknown, never coerce" invariant.
4. **`jig` preset is byte-identical.** `adapters: ["jig"]` resolves to the
   built-in preset (`specLayout: nested`, frontmatter `status`, `specs`/
   `decisions`); every existing corpus/fixture card (jig/gauge/servo/shaper,
   nested `proj-*` fixtures) produces identical observations to pre-008 — proven
   by regression tests over the existing fixtures.
5. **The card gate requires a real matching artifact.** A declared/resolved root
   becomes a card only when it contains ≥1 artifact matching the declared
   `specLayout` (ADR-0010 sub-decision 4, tier 2); an empty/irrelevant declared
   root does not fabricate a card. The tier-1 completion invariant (AC3) holds
   regardless of who authored the declaration.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions); existing fixtures
      byte-identical.
- [x] Coverage: flat-layout reading, `specLayout` schema/validator validity,
      status-absent → `unknown` (not 0%), jig-preset byte-identical regression,
      empty-declared-root → no card, and a read-only real-corpus smoke against
      `mystique/docs/superpowers` (flips blank → "N documents · unknown", source
      untouched).
- [x] Reviewed (compliance + craft + arch).
- [x] Deviation log + Reconciliation sweep produced.
- [x] `docs/refinement-todo.md` updated for any decisions deferred during
      implementation.

**Anti-horizontal-phasing check:** After this slice, onboarding a flat-spec repo
and pasting the discovered/authored profile renders a truthful card
(`superpowers`: blank → "N documents · completion unknown") where Gauge was
previously blind — end-to-end, observable on the dashboard.

### Deviation log (after reconciliation)

- **Document count carried in the freshness/resolution reason string, not a
  structured field.** AC3 requires the status-absent artifacts to be "surfaced
  as a count." `normalizeContribution` (`src/observation.mjs:76`) strips `value`
  from every non-`supported` signal, so an `unknown` execution signal cannot
  carry the count in a typed field without expanding the observation contract
  (ADR-0005 territory). The count therefore rides in the reason string as
  `no-recognized-delivery-status-<N>-documents`. All three review passes flagged
  this as the weakest seam and recommended deferring a structured carrier — filed
  in `docs/refinement-todo.md` ("Structured carrier for status-absent document
  count"). The observation contract and its validators are unchanged.
- **The dashboard card renders "Execution signal unknown.", not the literal
  "N documents · completion unknown".** The tier-1 invariant AC3 pins is
  delivered end-to-end: `superpowers` flips from a blank "unsupported" card to a
  truthful `unknown` card (a visible dashboard change), and no false `0%` is
  ever shown. But the card renderer (`public/index.html:49`) does not yet consume
  the count, because doing so today means parsing the diagnostic reason string —
  the exact brittleness the reviews flagged. The literal "N documents" render is
  therefore deferred to land together with the structured carrier as one coherent
  follow-up (same refinement-todo entry), rather than building on the reason-string
  seam. AC3 (adapter-level completion + count surfaced in the observation) is met.
- **`specLayout: auto` validates and is accepted but behaves as `nested`.** Not a
  deviation — auto-detection is slice 008-02 per the spec's own decomposition.
  The schema/validator accept `auto` now so 008-02 needs no schema change; the
  adapter's flat-vs-nested branch treats a non-`flat` value as nested.
- **Additive test-assertion updates.** `test/profile.test.mjs` (2) and
  `test/config.test.mjs` (3) deep-equal assertions were updated to include the
  additive `specLayout: 'nested'` now present in `PROFILE_DEFAULTS` / the resolved
  profile object. Expected consequence of the schema default flowing into the
  schema-derived defaults map; observation output is byte-identical, no behavioral
  regression.

### Reconciliation sweep

- **Schema ↔ runtime validator (`schemas/project-profile-v1.schema.json` ↔
  `src/profile.mjs`):** `updated` — `specLayout` enum added to both; the validator
  sources the enum from `PROFILE_SCHEMA.properties.specLayout.enum` so they stay
  in lockstep. Verified `PROFILE_DEFAULTS` picks up the schema default.
- **Config plumbing (`src/config.mjs`):** `updated` — `specLayout` threaded through
  `resolvedSingleProfile`, `profileOf` (via `PROFILE_DEFAULTS`), and `expandEntries`
  with the same entry→profile→default fallback as the other override fields.
- **Observation contract (`schemas/observation-v1.schema.json`, validators):**
  `no-op` — deliberately untouched; the unknown-completion signal reuses the
  existing `unknown`-status shape. Confirmed no validator changes were needed.
- **`progressOf` / existing derivation (`src/lib.mjs`, ADR-0006):** `no-op` —
  `progressOf` signature and math unchanged; the vocabulary gate is a separate
  additive predicate (`hasDeliveryStatus`) layered on top. Byte-identical jig
  cards proven by regression tests over existing fixtures.
- **Dashboard renderer (`public/index.html`):** `deferred` — count render deferred
  with the structured carrier (see deviation log + refinement-todo). The
  unsupported→unknown card flip is delivered by the existing renderer path.
- **`docs/architecture.md`:** `no-op` — no module boundary or public contract
  changed; `specLayout` is an additive profile-v1 capability within the existing
  adapter boundary. The arch review confirmed boundaries are preserved.
- **`docs/refinement-todo.md`:** `updated` — added the structured-count-carrier
  deferred decision with a resolution trigger.
