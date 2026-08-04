---
status: DRAFT
dependencies: [007-01, 007-02, adr-0010]
last_verified:
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
- [ ] All ACs pass; full test suite green (no regressions); existing fixtures
      byte-identical.
- [ ] Coverage: flat-layout reading, `specLayout` schema/validator validity,
      status-absent → `unknown` (not 0%), jig-preset byte-identical regression,
      empty-declared-root → no card, and a read-only real-corpus smoke against
      `mystique/docs/superpowers` (flips blank → "N documents · unknown", source
      untouched).
- [ ] Reviewed (compliance + craft + arch).
- [ ] Deviation log + Reconciliation sweep produced.
- [ ] `docs/refinement-todo.md` updated for any decisions deferred during
      implementation.

**Anti-horizontal-phasing check:** After this slice, onboarding a flat-spec repo
and pasting the discovered/authored profile renders a truthful card
(`superpowers`: blank → "N documents · completion unknown") where Gauge was
previously blind — end-to-end, observable on the dashboard.

### Deviation log (after reconciliation)

_Filled during reconciliation._

### Reconciliation sweep

_Filled during reconciliation._
