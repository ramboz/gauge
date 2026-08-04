---
status: DONE
dependencies: [008-01, 007-03]
last_verified: 2026-08-04
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
- [x] All ACs pass; full suite green (no regressions).
- [x] Coverage: `auto` detection (nested/flat/mixed), discovery emission of
      `specLayout` (flat emitted, nested omitted), read-only real-corpus smoke
      (`mystique` → cwv nested + superpowers flat), purity assertion.
- [x] Reviewed (compliance + craft + arch).
- [x] Deviation log + Reconciliation sweep produced.
- [x] `docs/refinement-todo.md` updated for any deferred decisions (none surfaced).

**Anti-horizontal-phasing check:** After this slice, a user runs `npm run
onboard` against a mixed-layout Pattern B repo and pastes the result unedited —
the hand-authoring of `specLayout` from 008-01 disappears; the flat card renders
end-to-end from one command.

### Deviation log (after reconciliation)

- **`detectLayout` hosted in `src/discover.mjs`, imported by `src/scan.mjs`
  (new one-directional coupling).** The `auto` resolution (adapter, read-time)
  and the discovery emission share one heuristic so they cannot diverge —
  deliberate single-source-of-truth. The alternative (duplicate the heuristic in
  both modules) was rejected. The import is strictly one-directional
  (`scan.mjs → discover.mjs`); `discover.mjs`'s edge-purity contract is
  unchanged (it still imports only node builtins + `safeProjectId` from
  `config.mjs`), and there is no cycle (`scan → discover → config → profile` has
  no path back to `scan`). All three review passes confirmed this. Not a spec
  deviation; recorded because a future reader should know the adapter now depends
  on the discovery module intentionally.
- **New `test/fixtures/proj-mixed/` rather than editing `proj-multiroot`.** The
  brief allowed reusing an existing multi-root fixture, but `proj-multiroot`'s
  `docs/superpowers` is nested and existing tests assert its exact byte-identical
  proposal shape. A fresh `proj-mixed` (one nested `docs/opportunities/cwv` + one
  flat `docs/superpowers`, mirroring mystique) keeps those assertions intact.
- **Real-corpus smoke uses a targeted `readdirSync` before/after comparison, not
  the full-tree `snapshot()` helper.** `snapshot()` walks the entire tree; run
  against the live mystique repo (a large, unbounded real `docs/`) it hung the
  suite. The read-only assertion was narrowed to the two directories the run
  touches (`cwv/specs`, `superpowers/specs`); `discoverProfile(mystique)` itself
  runs in ~6ms. The guard skips cleanly when the corpus is absent.

### Reconciliation sweep

- **`src/discover.mjs` purity (AC4 / 007-03 AC5):** `updated` — `detectLayout`
  added as a pure fs-read helper; the purity assertion test confirms no
  central-only imports were introduced. Verified.
- **Nested discovery output byte-identical to 007-03 (AC2):** `no-op` /
  verified — `specLayout` is attached only when detected `flat`; nested/declared
  proposals keep identical key order and no extra key. Covered by the existing
  proposal-shape tests over `proj-nested`/`proj-multiroot`/`proj-umbrella`, which
  stayed green.
- **Byte-identical jig cards (ADR-0010 invariant 1):** `no-op` — `resolveLayout`
  calls `detectLayout` only when `specLayout === 'auto'`, so the default-`nested`
  corpus never invokes detection. Mechanism captured here for future readers.
- **`src/scan.mjs` reader ↔ evidence gate consistency:** `updated` — both
  `scanSpecs` and `hasJigEvidence` route `auto` through the same `resolveLayout`,
  so they can never disagree about which layout check applies.
- **`docs/architecture.md`:** `no-op` — no module boundary or public contract
  changed; the new `scan.mjs → discover.mjs` import is within the existing
  adapter/derive boundaries (the derive-layer boundary note constrains
  `derive.mjs`, not `scan.mjs`). Arch pass confirmed no doc change required.
- **`docs/refinement-todo.md`:** `no-op` — no new decisions were deferred during
  008-02 implementation (all three review passes confirmed none surfaced). The
  008-01 structured-count-carrier entry already stands.
- **Project-profile contract surface (`schemas/project-profile-v1.schema.json`,
  declared in `docs/architecture.md`):** `no-op` for structure — the `auto` enum
  value was pre-provisioned in 008-01, so 008-02 needed no schema change. The
  `specLayout` description was refreshed (`updated`) to drop the now-stale
  "reserved for detection (slice 008-02)" wording, since detection is now
  implemented.
