---
status: DONE
dependencies: [007-01]
last_verified: 2026-08-03
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-02 — Multi-entry decomposition (Pattern C)

**Goal:** A profile can declare multiple entries so one repository renders N
portfolio cards, each with its own artifact root and progress — turning
`personalization-workspace` from a single blind generic card into three real
track cards (`rtb`, `offer-management`, `contextual-experimentation`).

**DoR:**
- ✅ 007-01 DONE (single-entry profile + artifact-root resolution in place).
- ✅ D2 (one-repo→N-entries identity & state layout) resolved — composite id
  scheme and shared-repository-signal decision recorded (ADR-0009 addendum or its
  own note).

**Acceptance Criteria:**

1. **Profile v1 expresses entries.** The profile gains an optional `entries`
   array; each entry has `id`, `label`, and an `artifactRoot` (plus the same
   optional overrides as 007-01). A profile with `entries` expands one
   `gauge.config.json` project into **N observations**; a profile without
   `entries` behaves exactly as 007-01 (single entry).
2. **Composite identity is valid and disjoint.** Each entry observation carries a
   composite id `<baseId>-<entryId>` that satisfies
   `^[a-z0-9][a-z0-9-]{0,63}$`; entries share the umbrella repository/git signal
   (per D3) but carry their own execution/workstreams from their own root.
3. **State layout stays safe.** Each entry's immutable records land under its
   composite id in `stateDir`; the ADR-0005 source/state disjointness and
   containment guarantees still hold, with no cross-entry collision.
4. **Pattern C renders three real cards.** Observing `personalization-workspace`
   with a 3-entry profile renders three cards with per-track progress that matches
   `tracks/<name>/specs` (rtb ~6, offer-management ~5, contextual-experimentation
   decisions-only → execution `unknown`, not a false 0/0 per #6). Single-entry and
   no-profile projects are unchanged.
5. **The dashboard is unambiguous.** N cards from one config entry are labelled by
   entry `label`, ordered deterministically, and never merge across entries.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). 92/92 pass.
- [x] Coverage: entries expansion, composite-id validity/oversize/duplicate,
      per-entry root isolation, state-disjointness for multi-entry, and a
      read-only real-corpus smoke against `personalization-workspace` (3 track
      cards: rtb 1/6, offer-management 0/5, contextual-experimentation
      `unknown` (no specs) — shared umbrella git revision, source untouched).
- [x] Reviewed (compliance + craft + arch). All three `pass`; evidence in
      `reviews/slice-02-*.md`.
- [x] Deviation log + Reconciliation sweep produced.
- [x] `docs/refinement-todo.md` entry updated (07-02 resolves the multi-entry half).

**Anti-horizontal-phasing check:** After this slice, one config entry for the
umbrella repo yields three real track cards on the dashboard where there was one
empty generic card — end-to-end, observable value.

### Deviation log (after reconciliation)

- **Config-time expansion (lowest blast radius).** A project whose profile
  carries `entries[]` is fanned out inside `normalizeConfig` (`.map`→`.flatMap`,
  `expandEntries`) into N ordinary single-entry normalized projects sharing the
  umbrella `path`, each with a composite id `<baseId>-<entryId>`, its own
  entry `label`, and a single-entry profile scoped to `entry.artifactRoot`.
  `src/observation.mjs`, `src/state.mjs`, `src/scan.mjs`, and `src/server.mjs`
  needed **no** change — they see N ordinary projects. A no-entries profile is
  byte-identical to 007-01.
- **`entries[]` added additively to profile-v1 (per 007-01 forward note).** The
  schema gains an optional `entries` array (`minItems:1`, each item
  `additionalProperties:false` with required `id`/`label`/`artifactRoot` +
  optional overrides); it is **not** a v2 cut. `src/profile.mjs` learned the
  array shape: `PROFILE_DEFAULTS` still derives only the scalar four (excludes
  `entries`), and `validateProfile` gained an `entries`-aware `validateEntry`
  branch — preserving ADR-0009's "runtime validator agrees with schema".
- **Entry `artifactRoot` is schema-`required` (intentional narrowing).** The
  brief was ambiguous ("optional override"), but a per-entry root is the entire
  point of Pattern C — without a distinct root every entry collapses to the same
  card. Made required, matching AC1.
- **Composite-id validity is the load-bearing identity check.** `entry.id` is
  validated only as a non-empty string; character/length validity is enforced on
  the composite `<baseId>-<entryId>` against `^[a-z0-9][a-z0-9-]{0,63}$` (≤64)
  at normalization, with duplicate-entry-id and cross-project-collision rejection
  — all tested. ADR-0005 disjointness holds because the state dir derives from
  the pattern-valid composite id and is proven by filesystem-identity, not the
  id string.
- **Known limitation — umbrella pins propagate to every entry.**
  `pinnedWorkstreams`/`hiddenWorkstreams` are copied to each expanded entry, and
  pins resolve repo-root-relative (not per-`artifactRoot`), so a pinned umbrella
  doc would surface on all N track cards (mild tension with AC5's "never merge
  across entries"). Deliberate for MVP and asserted in a test; no corpus project
  pins today. Logged as a follow-up in `docs/refinement-todo.md` (per-entry pin
  scoping). `hiddenWorkstreams` copying is benign — each entry only walks its own
  subtree.
- **Real-corpus smoke was manual/read-only; automated tests use a synthetic
  fixture.** `test/fixtures/proj-umbrella` (tracks a/b/c) exercises isolation and
  the decisions-only→`unknown` path; the literal `personalization-workspace`
  3-track smoke was run read-only against the real repo (source untouched) but
  not committed as a test.
- **Craft nits carried (non-blocking):** `compositeId`'s third `projectName`
  param is redundant with `baseId` at its sole call site; `expandEntries` has a
  wide 8-positional signature — both are readability polish, deferred.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` to reflect 007-02 REVIEWED; final regen at close-out after DONE. |
| `docs/product-vision.md` | `no-op` | Multi-entry moves toward the vision's explicitly-future "concurrent goals / multi-source" line but changes no success criterion. |
| `docs/architecture.md` | `updated` | Contract-surfaces "Project profile" bullet now describes live `entries[]` (composite-id cards, shared umbrella git) instead of "reserved for 007-02". |
| `docs/decisions/` (ADRs) | `no-op` | Implements ADR-0009's already-recorded D2 (`entries[]`, composite ids, shared git); no new/changed decision. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 still in flight (007-03 remains); no close-out compression. |
| `docs/inbox.md` | `no-op` | Reference-project corpus entry unchanged. |
| `docs/refinement-todo.md` | `updated` | Marked 007-02 landed (only 007-03 open); added the per-entry-pin follow-up limitation. |
| `docs/memory/glossary.md` | `no-op` | "Project profile" term already covers `entries[]` (added at 007-01 close-out). |
| `schemas/` | `updated` | `project-profile-v1.schema.json` gained the additive `entries[]`. |
| Render layer (`public/index.html`) | `no-op` | Expansion happens at the config seam; the dashboard renders N ordinary projects via the existing per-project path — card rendering inherited, no change. |
| Deferred/known limitations | `deferred` | Umbrella-pin cross-entry propagation (→ refinement-todo); per-entry git recency (ADR-0009 D3); discovery/onboarding (→ 007-03). |
