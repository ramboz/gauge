---
status: DRAFT
dependencies: [008-01, 007-03]
last_verified:
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 008-02 — Auto-detect + discovery emits `specLayout`

**Goal:** Onboarding a flat-spec project is **zero-touch** — `specLayout: auto`
resolves nested-vs-flat by inspection, and 007-03's `discoverProfile` /
`npm run onboard` **detect and emit** the layout per entry, so a user runs one
command against `mystique` and gets a ready-to-paste profile that renders
`superpowers` correctly without hand-authoring `specLayout`.

**DoR:**
- ✅ 008-01 DONE (`specLayout` capability + flat reader + honest completion).
- ✅ 007-03 DONE (`discoverProfile` pure module + `onboard.mjs`).

**Acceptance Criteria:**

1. **`specLayout: auto` detects layout.** When an entry declares `auto` (or when
   the adapter resolves an undetermined root), it prefers `nested` if any
   `<specsDir>/<dir>/spec.md` exists, else `flat` if any `<specsDir>/<name>.md`
   exists; a mixed folder resolves toward `nested` (ADR-0010 A3), and the choice
   is deterministic and covered by fixtures.
2. **Discovery emits a detected `specLayout`.** `discoverProfile(root)` sets
   `specLayout` on each proposed entry (or the single-entry profile) when the
   detected layout is not the `nested` default — so the emitted profile is
   drop-in and renders correctly with no hand-editing. `nested` roots emit no
   `specLayout` (007 identity preserved: a jig repo's proposal is unchanged).
3. **`onboard` on the real corpus is correct and drop-in.** `npm run onboard
   --path <mystique>` proposes an entry for `docs/superpowers` carrying
   `specLayout: flat` (alongside the existing `docs/opportunities/cwv` nested
   entry); the emitted profile validates and, pasted into `gauge.config.json`,
   renders `superpowers` as "N documents · completion unknown". Read-only; source
   untouched.
4. **Purity preserved (AC5 of 007-03 carries).** The `specLayout` detection lives
   in the pure `discover` module (no central-only imports), so spec 006's edge
   skill still gets it for free.

**DoD:**
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Coverage: `auto` detection (nested/flat/mixed), discovery emission of
      `specLayout` (flat emitted, nested omitted), read-only real-corpus smoke
      (`mystique` → cwv nested + superpowers flat), purity assertion.
- [ ] Reviewed (compliance + craft + arch).
- [ ] Deviation log + Reconciliation sweep produced.
- [ ] `docs/refinement-todo.md` updated for any deferred decisions.

**Anti-horizontal-phasing check:** After this slice, a user runs `npm run
onboard` against a mixed-layout Pattern B repo and pastes the result unedited —
the hand-authoring of `specLayout` from 008-01 disappears; the flat card renders
end-to-end from one command.

### Deviation log (after reconciliation)

_Filled during reconciliation._

### Reconciliation sweep

_Filled during reconciliation._
