---
status: RECONCILED
dependencies: [adr-0011, adr-0009, 007-03]
last_verified: 2026-08-05
frame_review: true
claimed_by: claude/jig-orient-6dc7a1
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 009-01 — Goal/deadline onboarding authoring

**Goal:** A project's **goal** and **deadline** are authored into its gauge-side
profile by a human-curated onboarding step — whose deterministic tool surfaces the
source's vision/release/README as *candidate artifacts* to draw from, which the
author (optionally Claude-assisted) turns into values and the user confirms or
overrides — and the project's dashboard card then displays them, sourced from
literal profile fields the zero-dependency runtime reads without ever parsing
source prose ([ADR-0011](../../decisions/adr-0011-goal-deadline-source-strategy.md)).

**DoR:**
- ✅ ADR-0011 accepted (goal/deadline source strategy); ADR-0009 profile contract
  accepted; spec 007-03 (`src/discover.mjs` + `npm run onboard`) DONE.
- ✅ `schemas/project-profile-v1.schema.json` is the extension target (verified:
  `additionalProperties: false`, no goal/deadline fields today).
- ✅ The current-state read path to extend is `observeAll` (`src/observation.mjs`)
  → `/api/data` (`src/server.mjs`) → `public/index.html` (verified: the card
  renders no goal/deadline today).

**Acceptance Criteria:**

1. **Additive profile fields.** `project-profile-v1` gains an optional `goal`
   (string) and `deadline` (a date, or the literal `unknown`), each with a
   `provenance` marker naming the seeding artifact (`product-vision` / `release` /
   `readme` / `user`). A profile with neither field validates exactly as today
   (the 007 identity is preserved); `additionalProperties: false` still holds.
2. **Onboarding surfaces candidate source artifacts in precedence order.** The
   deterministic onboarding step reports, per field, which source artifact an
   author should draw from — goal from jig `product-vision.md` → `README`;
   deadline from shaper `docs/releases/*` → `README` — selecting the first that
   **exists** and skipping absent layers. It surfaces the artifact as an authoring
   **pointer** (its path); it does **not** parse the prose or emit a goal/deadline
   value. Turning that prose into a goal string or a date is the human-curated,
   optionally Claude-assisted authoring step (ADR-0011), not this tool. When no
   candidate artifact exists for a field, the tool reports none.
3. **The machine never fabricates a deadline.** No code path converts prose — a
   relative appetite ("maximum two weeks from start") or otherwise — into a
   concrete date; the committed deadline is only ever a value the user authors, or
   `unknown` (ADR-0011).
4. **The tool proposes; the user authors; nothing is clobbered.** The onboarding
   tool never overwrites an existing authored profile — it emits its proposal to
   stdout and/or writes a drop-in profile only when none exists; the user authors
   `goal`/`deadline` into the profile (`provenance: user`). Because the tool does
   not rewrite an existing config, a re-onboard cannot clobber a user-authored
   value, and no runtime merge is added — preserving `discover.mjs`'s edge-purity
   (it still imports no central/config/state module). Gauge performs **no** write
   to any source repository.
5. **Runtime reads literals only.** Regular `npm run collect` / `npm start`
   surface the profile's `goal`/`deadline` verbatim; no runtime code reads or
   parses `product-vision.md`, a release doc, or a README. (Enumeration: the only
   readers of those source artifacts remain the onboarding/discover path — shown
   by a search over `src/` for reads of vision/release/readme.)
6. **The card shows goal + deadline.** After onboarding, the project's card
   renders its goal and deadline (deadline shown as the date, or an explicit
   "deadline: unknown"), joined from the profile onto the current-state read path.
   A project with no authored goal/deadline renders as it does today plus an
   explicit "no goal set" affordance — never a fabricated or blank-looking value.

**DoD:**
- [x] All ACs pass; full test suite green (164/164; no regressions to the 007/008 suites).
- [x] Implementer coverage exercises: schema additive-validation (present/absent
      fields, bad provenance, bad deadline); candidate-artifact surfacing
      precedence per field (first existing artifact chosen, absent layers skipped,
      none-exist reported); the no-value-from-prose invariant (the tool emits an
      artifact pointer, never a computed goal/deadline value); the tool never
      overwrites an existing authored profile; the no-source-write invariant; and
      the card render (goal, deadline, unknown, none-set).
- [x] Each new test shown to fail when its feature is removed (mutation-verified).
- [x] Reviewed by `reviewer` subagent (compliance pass). Craft pass run (both pass).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] **Cutline reconciliation (from ADR-0011):** the GitHub-milestone goal
      adapter moved from *Include* to deferred in
      `docs/releases/local-portfolio-loop.md` and `docs/product-vision.md`
      (+ `docs/architecture.md`). Done under the standing owner directive to
      implement all of spec 009 (the milestone deferral was owner-approved when
      the pull direction was chosen); a `shaper:cutline` re-slate remains available.
      Captured in deviation items 6–7.
- [x] `docs/refinement-todo.md` updated (multi-entry follow-up); status board
      regenerated at DONE.

<!-- frame_review is set from the ## Assumptions of this slice via
     `workflow.py frame-review-needed`; leave to the shaping step. -->

**Anti-horizontal-phasing check:** after this slice a user onboards a project,
reviews the proposed goal/deadline in its profile, and sees them on that project's
Gauge card — the authoring path is visible end to end, not an unused schema field.

### Assumptions

- **The onboard seam is scoped, not deferred (from frame-critique).** Verified
  current state: `scripts/onboard.mjs` is a config-blind stdout emitter and the
  profile is config-inline / hand-authored (`schemas/project-profile-v1.schema.json`
  says "config-inline home only in v1"; `src/config.mjs`). This slice's *tested
  runtime* surface is therefore exactly: the additive schema, the deterministic
  **candidate-artifact surfacing** (existence-based, no prose parsing), the runtime
  literal read, and the card render. The **prose→value comprehension** (a vision
  paragraph → a goal string; a release → a date) is the human-curated / optionally
  Claude-assisted authoring step ADR-0011 chose — a documented workflow, **not**
  deterministic jig code, and explicitly not unit-tested here. This keeps
  `discover.mjs`'s edge-purity intact (no central/config/state reach added) and
  does not re-introduce the runtime prose-parsing ADR-0011 rejected as Option B.
- The current-state read join (profile goal/deadline → card) does not require
  changing the observation contract; the join happens at the read/render layer,
  not inside observation-v1. (To verify during implementation: whether `/api/data`
  already has profile access, or the join is added in the server read.)

### Deviation log (after reconciliation)

The original ACs are preserved above. Implementation notes:

1. **Read-layer join (AC6), contract untouched.** Goal/deadline are joined onto
   the read path via a new `joinProjectProfileFields` in `src/observation.mjs`,
   called only by `src/server.mjs` — deliberately *not* folded into
   `observeProject`/`observeAll`, so the observation-v1 record is unchanged (a test
   asserts the persisted record still validates and carries no goal/deadline).
2. **AC4 chosen interpretation — stdout-only.** The AC permitted "stdout and/or a
   drop-in profile only when none exists." Implementation is stdout/stderr-only:
   `scripts/onboard.mjs` writes no file, which trivially satisfies the no-clobber
   invariant and keeps `discover.mjs` edge-pure.
3. **AC5 enumeration scoped honestly.** A blanket grep for release/README reads
   across `src/` would false-positive on `src/scan.mjs`'s pre-existing, legitimate
   reads of `docs/releases/*` content for workstream display (spec 007). The
   enumeration invariant was scoped to (a) the `product-vision.md` literal confined
   to `discover.mjs` and (b) `scan.mjs` never assigning `goal:`/`deadline:` — a
   narrower but accurate guard that does not collide with that behavior.
4. **Symmetric absent-deadline affordance.** AC6 names "no goal set"; a symmetric
   "no deadline set" was added, kept distinct from an authored `"unknown"`
   (which renders "Deadline: unknown") to preserve ADR-0011's never-onboarded vs.
   explicitly-authored-unknown distinction.
5. **onboard surfacing on the no-jig path.** Candidate-artifact surfacing prints
   before the "no jig artifacts" early exit, so a plain README-only source still
   gets a pointer (ADR-0011: "a plain repo may only have a README").
6. **ADR-0011 cutline reconciliation done.** GitHub-milestone goal adapter moved
   Include→Defer in `docs/releases/local-portfolio-loop.md` (plus Solution Outline
   and JIG Handoff), and `docs/product-vision.md` Committed-MVP step 3 rewritten to
   the curated-authoring path. Owner-approved in substance (the user explicitly
   chose to defer the milestone with GitHub-push collection); anchored by
   Accepted ADR-0011. `docs/architecture.md` updated likewise.
7. **Daily-scheduling deferral — separate owner decision, not ADR-0011.** The same
   docs also reflect "collection is manual pull; automated daily scheduling
   deferred." This is **not** decided by ADR-0011 — it traces to the owner's
   explicit 2026-08-05 choice ("Defer automation, manual collect") recorded in the
   spec 009 overview. Logged distinctly here per the reconciliation reviewer. The
   `local-portfolio-loop.md` Include row was reworded to "Manual pull collection …
   runs are manually triggered" and a Defer row "Automated daily scheduling
   (unattended runs)" added, so the committed plan is now internally consistent
   (the earlier row-47 vs. Solution-Outline contradiction is resolved). Editing the
   `committed` plan without a full `shaper:cutline` pass is a known shortcut taken
   under the standing owner directive to implement all of spec 009; a
   `shaper:cutline` pass remains available if the owner wants the release
   re-slated formally.
8. **005/006 DEFERRED flips (spec-009 scope, logged here for completeness).** The
   five 005/006 slices were transitioned DRAFT→DEFERRED (with resolution triggers)
   during spec 009 shaping, not by 009-01's code change. They are status-board
   inputs; recorded here so the sweep accounts for them.

**Carried follow-ups (from review):**
- *[compliance nit]* The `deadline` value pattern is syntactic and accepts
  calendar-invalid dates (e.g. `2026-13-40`). Harmless here (the card echoes
  verbatim) but a latent gap once **009-02** does forecast date arithmetic —
  tighten deadline validation there.
- *[craft nit]* A profile with both `entries[]` and top-level `goal`/`deadline`
  silently drops the umbrella goal/deadline in `expandEntries`
  (`src/config.mjs`). Recorded in `docs/refinement-todo.md` as a bounded
  reject-vs-thread follow-up (out of single-project scope).
- *[craft nit]* The `test/observation.test.mjs` static no-I/O guard slices the
  function body by first unindented brace; defer-safe test-robustness nit.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Project front door unaffected by this slice. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close. |
| `docs/product-vision.md` | `updated` | Committed-MVP step 3 rewritten to curated goal/deadline authoring; GitHub milestone deferred (ADR-0011 cutline reconciliation). |
| `docs/architecture.md` | `updated` | Source-adapters goal/due-date source, later-slices note, and profile contract updated for authored goal/deadline + read-layer join. |
| `docs/releases/local-portfolio-loop.md` | `updated` | ADR-0011: GitHub milestone Include→Defer + curated-authoring Include row. Owner 2026-08-05: manual-pull collection row reworded + "Automated daily scheduling" Defer row added (resolves the row-47 self-contradiction). Solution Outline + JIG Handoff aligned. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 009 still in flight (009-02/03 pending); compress-on-close-out deferred to 009-03. |
| `docs/inbox.md` | `no-op` | No items resolved by this slice. |
| `docs/refinement-todo.md` | `updated` | Added the multi-entry goal/deadline reject-vs-thread follow-up. |
| `docs/memory/**` | `no-op` | Seam scoping is captured in ADR-0011 + the slice; no new durable term or dead-end learning to persist. |
| `docs/decisions/README.md` / ADR index | `updated` | ADR-0011 index line added by the acceptance-time regen. That same regen had rendered ADR-0008 as "(no description)" (bug-020: its Context opened with a list lead-in); ADR-0008's Context opening was reworded to a standalone sentence (ADR-0006 allows Context-prose edits for index rendering) and the index re-run, restoring its summary. |
| `docs/decisions/adr-0008-*.md` | `updated` | Context opening reworded to a standalone sentence so the derived index summary is real, not "(no description)". No decision-content change (immutability preserved). |
| `docs/specs/005-*`, `006-*` slice files | `updated` | Five slices flipped DRAFT→DEFERRED with resolution triggers during spec-009 shaping (deferring the push topology); status-board inputs, logged in deviation item 8. |
