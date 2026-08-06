---
status: DONE
dependencies: [007-02, 009-01, adr-0009, adr-0011]
last_verified: 2026-08-06
arch_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon).
     See docs/workflow.md "Self-defining vocabulary". -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section —
     never assert an unverified claim as fact. -->

## Slice 010-01 — entry-level goal/deadline

**Goal:** Let a `profile.entries[]` item declare its own `goal` and `deadline`
(same shape and validation as the top-level profile fields), thread them through
config expansion onto each expanded entry-project, and — with no read/derive
change — surface per-track forecast/risk/attention on the dashboard for
multi-entry projects. An entry with neither field falls back to the parent
profile's goal/deadline when present, and otherwise behaves exactly as pre-010.

**DoR:**
- ✅ Spec 007-02 (multi-entry decomposition, `expandEntries`) is DONE.
- ✅ Spec 009-01 (goal/deadline profile fields + `joinProjectProfileFields`) is DONE.
- ✅ `schemas/project-profile-v1.schema.json`, `src/profile.mjs`,
  `src/config.mjs` are the identified change seams (see spec `## Assumptions`).
- ✅ Existing test suites for profile validation and config normalization exist
  to extend (`test/profile.*`, `test/config.*`).

**Acceptance Criteria:**

1. **The schema accepts entry-level goal/deadline with the top-level shape, and
   rejects malformed ones.** `schemas/project-profile-v1.schema.json` allows a
   `goal` and a `deadline` object on each `entries[]` item, each `{value,
   provenance}` with the same `required`, `additionalProperties: false`,
   provenance enum (`product-vision | release | readme | user`), and — for
   deadline — the same `^(\d{4}-\d{2}-\d{2}|unknown)$` value pattern the
   top-level fields use. The top-level and entry-level definitions are
   **single-sourced** (a shared `$defs` definition referenced from both) so the
   two cannot drift.

2. **`validateProfile` accepts a valid entry-level goal/deadline and reports an
   actionable error for a malformed one.** For `profile.entries[i].goal` /
   `.deadline`: a non-object, an unrecognized sub-field, a missing/empty
   `value`, a bad `provenance`, or (deadline) a `value` that is neither an ISO
   date nor the literal `unknown` each yield a specific error string naming
   `profile.entries[i].goal`/`.deadline` and the violated rule. A valid one
   yields no error. The generic "must be a non-empty string" check is **not**
   applied to these object fields.

3. **Config expansion threads entry-level goal/deadline onto the expanded
   entry-project.** After `loadConfig`, a multi-entry project whose entry
   declares `goal`/`deadline` produces a normalized project whose
   `profile.goal`/`profile.deadline` equal the entry's literal values. An entry
   that declares neither inherits the parent `profile.goal`/`profile.deadline`
   when the parent declares them. An entry with neither, under a parent with
   neither, produces a normalized project whose profile has **no**
   `goal`/`deadline` own-property (byte-identical to pre-010 for that shape).

4. **Entry-declared goal/deadline reaches the read layer and drives derivation.**
   Through the real read path (`joinProjectProfileFields` →
   `attachForecasts` → `attentionQueue`), an entry-project carrying a concrete
   future `deadline` gets `project.deadline.value` set and a forecast whose
   `reason` is **not** `deadline-unknown` (i.e. it leaves attention tier 3),
   while a sibling entry with no deadline stays `unknown (deadline-unknown)` in
   tier 3. Demonstrated on a fixture multi-entry project, not the live corpus.

5. **Full backward compatibility.** The existing profile/config/observation test
   suites pass unchanged; a multi-entry profile with no entry-level and no
   parent goal/deadline normalizes to exactly the pre-010 shape (no added
   own-properties).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture,
      including: valid entry goal+deadline, each malformed variant (AC2),
      entry-override, parent-inheritance, and neither-present identity (AC3/AC5).
- [x] Each new test has been shown to fail when its feature is removed (mutate
      the feature, watch it go red, restore).
- [x] Reviewed by `reviewer` subagent. Reviewer prompt built by `review.py`.
- [x] Implementation review passed.
- [x] Arch pass run and passed (`arch_review: true` — this slice widens a
      versioned public contract, `project-profile-v1`).
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred — none
      were deferred; see deviation log §4.

**Anti-horizontal-phasing check:** After this slice lands, a user onboarding a
multi-entry project (Mystique, Personalization) can set a goal and deadline per
track and immediately see that track's forecast, risk, and attention tier move
off "needs a deadline set" on the dashboard — the same end-to-end value a
single-entry project already gets, now reaching the nested shape. End-to-end
observable; one slice.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

1. **Single-sourcing forced three existing 009-01 test edits (flagged, accepted).**
   AC1 mandates the top-level and entry-level goal/deadline be single-sourced.
   The implementation extracts the object shapes into `schema.$defs.goal` /
   `$defs.deadline` and `$ref`s them from both sites. That turns
   `schema.properties.goal` into `{ $ref }`, so three pre-existing raw-schema
   assertions in `test/profile.test.mjs` that read
   `schema.properties.goal.properties.*` / `.additionalProperties` were
   repointed to `schema.$defs.goal.*`. This is lossless (the shared definition
   carries the same `required`/enum/pattern) and the new single-source test
   (`test/profile.test.mjs:346`) pins the top-level→`$defs` `$ref` binding, so
   drift is guarded. Both the craft and compliance reviewers judged this an
   acceptable, expected consequence of single-sourcing, not a coverage loss —
   a narrow reading of AC5 ("existing suites pass unchanged" as *behavior*
   parity, not byte-frozen test source).

2. **Entry→parent goal/deadline inheritance is a deliberate consistency choice
   (open question logged, not blocking).** An entry that declares neither field
   inherits the parent profile's `goal`/`deadline`, mirroring how every other
   entry field (`specsDir`/`decisionsDir`/`statusProperty`/`specLayout`) already
   falls back to the profile value. The arch reviewer noted that a single parent
   `deadline` inherited across sibling tracks yields a *separate per-track
   forecast against a shared date*, which could read as misleading precision for
   a track the umbrella deadline does not truly govern. Kept for consistency and
   honesty (per-track delivery evidence still differentiates the forecasts, and
   the value is an explicit authored literal, never inferred). No umbrella card
   is emitted for a multi-entry project, so the parent goal/deadline surfaces
   *only* via this inheritance.

3. **Contract widened additively; `docs/architecture.md` § Contract surfaces
   updated inline** (live prose, ADR-0010 amendment policy) to record that an
   `entries[]` item may carry its own `goal`/`deadline` with parent fallback.
   No `project-profile-v1` version bump: the change is purely additive and a
   pre-010 profile validates and normalizes byte-identically (AC5).

4. **No decisions deferred; ADR disposition surfaced, not self-applied.** The
   arch reviewer's recommendation — a one-line amendment note on
   [ADR-0009](../../decisions/adr-0009-project-shape-profile-contract.md) (its
   D2 entry contract now includes optional `goal`/`deadline` with parent
   fallback), and **no** new ADR (this composes ADR-0009 D2 + ADR-0011
   additively; ADR-0011's authoring policy is untouched) — is recorded here.
   ADR-0009 is an accepted, closed record; amending it is held for explicit
   owner approval per the reconciliation "Authorisation to amend" rule (issue
   #125) rather than applied in this slice. The spec overview and this slice
   already document and link the extension, so the amendment is optional
   provenance polish, not a correctness gap.

5. **Reviewer nits (non-blocking), not actioned:** (a) `validateGoalOrDeadline`'s
   `entry` parameter names the goal/deadline object, which reads as colliding
   with the multi-entry `entries[]` vocabulary — cosmetic, pre-existing from
   009-01, left as-is to avoid churn on an unrelated signature; (b) a combined
   "entry declares goal but inherits parent deadline" fixture would be a
   nice-to-have — `goal` and `deadline` are threaded independently and each is
   covered in isolation, so this is not a coverage gap.

### Reconciliation sweep

Record the drift-prone surfaces checked during reconciliation. The transition
gate only requires this subsection to exist; the reconciliation reviewer judges
whether coverage and rationales are honest.

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Project front door describes the product, not the profile schema; no user-facing change to how Gauge is run. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (spec 010 row + slice 010-01 state). |
| `docs/product-vision.md` | `no-op` | Vision boundary/goals unchanged; per-entry goal/deadline is a shape detail, not a scope change. No `## Use cases` section to trace against. |
| `docs/architecture.md` | `updated` | § Contract surfaces now records that an `entries[]` item may carry its own `goal`/`deadline` (single-sourced via schema `$defs`) with parent-profile fallback. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 010 is in flight until this slice lands; CLAUDE.md Hot Cache describes the loop at the spec granularity and needs no per-slice invariant. `AGENTS.md` absent. |
| `docs/inbox.md` | `no-op` | The 2026-08-03 reference-corpus note is the corpus *recipe* (still valid); it does not itself track this gap, so nothing to strike. |
| `docs/refinement-todo.md` | `no-op` | No decision deferred by this slice; no existing item resolved by it. |
| `docs/memory/**` | `updated` | Session auto-memory `gauge-reference-corpus-collection` updated: the profile-v1 "entries can't carry goals" limitation is now resolved by spec 010-01. |
| `docs/decisions/README.md` / ADR index | `deferred` | Arch reviewer's optional one-line amendment to ADR-0009 (accepted, closed record) is held for explicit owner approval per issue #125; no new ADR needed (composes ADR-0009 D2 + ADR-0011 additively). See deviation log §4. |
| `schemas/project-profile-v1.schema.json` | `updated` | `goal`/`deadline` extracted to `$defs` and `$ref`'d from both the top-level profile and each `entries[]` item (AC1). |
| Additional live prose / generated templates touched by this slice | `no-op` | No other live prose or generated template affected. |
