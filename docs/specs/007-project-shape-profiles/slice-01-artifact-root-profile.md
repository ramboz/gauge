---
status: DONE
dependencies: [adr-0009]
last_verified: 2026-08-03
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-01 — Explicit artifact-root profile (Pattern B)

**Goal:** A versioned project profile lets the Jig adapter read a project whose
jig artifacts live under a non-root path, so `mystique`'s `docs/opportunities/cwv`
sub-project renders its real progress (~12 specs, 26 ADRs) instead of a generic
card or a misleading `0/2` — with zero change to flat projects that carry no
profile.

**DoR:**
- ✅ ADR-0009 (D1: profile contract location & precedence) accepted, fixing where
  the profile lives (`gauge.config.json`-inline for pull; source-owned file as the
  spec-006 seam) and the v1 field set.
- ✅ Probe confirms `mystique` real roots (`docs/opportunities/cwv/{specs,decisions}`)
  and that its specs use standard `status:` frontmatter (spec `## Assumptions`).

**Acceptance Criteria:**

1. **Profile v1 is a canonical, dual-validated contract.**
   `schemas/project-profile-v1.schema.json` defines: `artifactRoot` (string,
   default `"docs"`), and optional `specsDir` / `decisionsDir` /
   `statusProperty` overrides (defaults `specs` / `decisions` / `status`). A
   runtime validator agrees with the schema on a malformed-value matrix, mirroring
   the `observation-v1` pattern. No new runtime dependency (ADR-0001).
2. **Config accepts and normalizes a per-project profile.** `src/config.mjs`
   accepts a `profile` on a project entry (per ADR-0009), resolves `artifactRoot`
   relative to the project path, and rejects a malformed profile with one
   actionable error. A project with no `profile` normalizes exactly as today.
3. **The adapter reads roots from the profile.** `src/scan.mjs` derives its
   artifact roots from the resolved profile (`<root>/<artifactRoot>/{specs,decisions,…}`)
   rather than a hardcoded `docs`. With no profile, output is **byte-identical**
   to current behavior (default `artifactRoot: "docs"`) — verified against the
   existing `proj-jig` fixture observation.
4. **Pattern B renders real progress.** Observing `mystique` with
   `profile.artifactRoot = "docs/opportunities/cwv"` yields a **supported**
   execution signal whose spec count matches the real `cwv/specs` set (not
   generic, not `0/2`), and the `jigManaged` evidence check (spec 006-adjacent /
   #6) fires on the real root. `jig` / `gauge` / `servo` / `shaper` (no profile)
   are unchanged.
5. **Read-only holds.** Collection performs no writes to the source (existing
   invariant re-verified for the non-root path).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). 81/81 pass.
- [x] Coverage: schema/runtime agreement, config normalization (valid + malformed
      profile), no-profile identity, and a synthetic nested-root fixture (plus a
      read-only real-corpus smoke against `mystique`: 14 specs / 43% / 29 ADRs,
      `cwv/bugs`, discovered all `docs/opportunities/cwv/…` — no parent-tree bleed).
- [x] Reviewed by `reviewer` subagent (compliance) + `pr-review` (craft) + arch pass.
      All three `pass` after one fix round; evidence in `reviews/slice-01-*.md`.
- [x] Deviation log + Reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` "Project onboarding and multi-entry sources" entry
      updated (07-01 resolves the artifact-root half; marked PARTIALLY RESOLVED).

**Anti-horizontal-phasing check:** After this slice, a user points a config
entry at `mystique` with one `artifactRoot` line and the dashboard shows a real
`cwv` progress card that was previously generic — end-to-end, observable value.

### Deviation log (after reconciliation)

- **Full artifact-root re-rooting, not just specs/decisions.** The first
  implementation pass threaded the resolved profile through `scanSpecs` and
  `hasJigEvidence` only, per an over-narrow reading of AC3's "…". Compliance
  and arch review (fix round 1) correctly read the "…" in
  `<root>/<artifactRoot>/{specs,decisions,…}` as covering every artifact scan,
  not just specs/decisions. Fixed: `scanBugs` (`<artifactRoot>/bugs`),
  `scanWorkstreams` (walks `<artifactRoot>` instead of `<root>/docs`, with
  discovery-exclusion prefixes and release/runbook path labels computed
  relative to `<artifactRoot>` so they stay root-relative for
  `pinnedWorkstreams`/`hiddenWorkstreams` matching), `countRefinement`
  (`<artifactRoot>/refinement-todo.md`), `countInboxItems`
  (`<artifactRoot>/inbox.md`), and `scanCompass`
  (`<artifactRoot>/status/compass-history.jsonl`) are all now scoped to the
  resolved `artifactRoot`. With the default profile (`artifactRoot ===
  <root>/docs`), every one of these resolves to byte-identical paths to
  pre-007-01 behavior — reverified via the `proj-jig` no-profile-identity test.
  **Deliberate exception:** `scanWorktreeOnlyDocs` stays scoped to
  `<root>/.claude/worktrees`, not `<artifactRoot>`. Worktree hygiene tracks
  docs lost to abandoned worktree checkouts across the *whole git repository*,
  not a per-sub-project concern — a nested profile (e.g. mystique's
  `docs/opportunities/cwv`) should still surface worktree-lost docs from
  anywhere in the repo, so this scan intentionally does not follow
  `artifactRoot`.
- **`statusProperty` wired, not inert.** The first pass added `statusProperty`
  to the schema/config normalization but never read it in `scanSpecs` (spec
  and slice status both stayed hardcoded to `data.status`). Fixed:
  `scanSpecs(artifactRoot, specsDirName, statusProperty)` now reads
  `normStatus(data[statusProperty])` (and the same for each slice's
  frontmatter), covered by a new `proj-status-property` fixture using a
  `state:` field. `scanBugs` intentionally still reads the literal
  `data.status` — the profile's `statusProperty` describes the *jig spec/slice*
  status convention (per ADR-0009's v1 field set), not bug lifecycle status,
  and no AC or ADR text extends it to bugs.
- **Forward note for 007-02.** ADR-0009's "Recommended Decision" narrative
  lists `entries[]` as part of the v1 profile shape ("Profile v1 field set…
  and optional `entries[]`"), but the *shipped* `schemas/project-profile-v1.schema.json`
  in this slice uses `additionalProperties: false` without an `entries` field —
  deliberately: 007-01's scope is the single-entry artifact-root case only
  (per the spec's boundary, `entries[]`/multi-entry decomposition is
  007-02's job). Because `additionalProperties: false` currently rejects an
  `entries` key, 007-02 must add `entries` to the v1 schema **additively**
  (a new optional property on the same `project-profile-v1` contract), not by
  cutting a v2 schema — flagged here so 007-02's implementer does not
  mistake the narrower 007-01 schema for the ADR's full intended v1 shape.
  007-02 must also extend the **runtime** side to preserve ADR-0009's
  "runtime validator agrees with the schema" invariant: `validateProfile`
  (`src/profile.mjs`) currently rejects any non-string field value and
  `PROFILE_DEFAULTS` maps every field to a scalar default, so an array-typed
  `entries[]` needs both taught about the new shape.
- **Pinned workstreams intentionally stay repo-root-relative.** The explicit
  `pinnedWorkstreams` loop resolves pins under `<root>` (not `<artifactRoot>`),
  so a pin may point anywhere in the repo, while the discovery walk directly
  above is `artifactRoot`-scoped. Like the `scanWorktreeOnlyDocs` exception,
  pins are explicit operator choices, so the artifact-root boundary is
  deliberately not absolute for pinned rows.
- Centralized profile defaults: `src/scan.mjs`'s `resolvedProfile` now
  imports `PROFILE_DEFAULTS` from `src/profile.mjs` instead of re-hardcoding
  `'docs'`/`'specs'`/`'decisions'` a third time, so the default set lives in
  exactly one place (the schema, via `src/profile.mjs`).
- `test/fixtures/proj-nested` was reshaped from a flat `workspace/` root (which
  could not exercise sibling non-bleed) to the real Pattern B shape:
  `docs/opportunities/cwv/{specs,decisions}` nested under a project root that
  also carries sibling umbrella content (`docs/releases/launch.md`,
  `docs/bugs/bug-x.md`, `docs/roadmap.md`) — the tests now assert the profiled
  scan sees zero of that sibling content, which is the test that actually
  proves the re-rooting fix (a fixture without genuine sibling content cannot
  distinguish "scoped to artifactRoot" from "scans everything under root/docs
  anyway").
- `test/profile.test.mjs`'s malformed-value matrix originally included a
  whitespace-only `decisionsDir: '   '` case asserted as failing both schema
  and runtime — but the schema's `minLength: 1` accepts a 3-character
  whitespace string (no content constraint), so schema and runtime actually
  disagree there. Fixed: the matrix case is now a genuinely empty string
  (schema/runtime agree), and the whitespace divergence is called out in its
  own test (`runtime is intentionally stricter than the schema for
  whitespace-only strings`) rather than misrepresented as agreement.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front door unaffected — no user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` to reflect 007-01 REVIEWED; a final regen runs at close-out after the DONE transition. |
| `docs/product-vision.md` | `no-op` | No scope/boundary drift; profiles are an enabling capability, the vision's success criteria are unchanged. |
| `docs/architecture.md` | `updated` | Added a **Project profile** entry under Contract surfaces (`project-profile-v1`, config-inline home + `gauge.profile.json` spec-006 seam, default-flat behavior, `entries[]` reserved for 007-02). |
| `docs/decisions/` (ADRs) | `updated` | ADR-0009 authored during shaping and indexed; this slice implements it. No new ADR needed — the load-bearing decision was already recorded. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 still in flight (007-02/03 remain), so no close-out compression; hot cache carries no per-slice invariant worth hoisting. |
| `docs/inbox.md` | `no-op` | The reference-project corpus entry remains the live validation set; nothing resolved by this slice. |
| `docs/refinement-todo.md` | `updated` | Marked "Convention discovery and multi-entry decomposition" **PARTIALLY RESOLVED** — 007-01 landed the artifact-root half; 007-02/03 still open. |
| `docs/memory/glossary.md` | `updated` | Added the **Project profile** term (memory-sync). |
| `schemas/` | `updated` | New `project-profile-v1.schema.json` contract (the deliverable). |
| Deferred/known limitations | `deferred` | `entries[]` multi-entry (→ 007-02), discovery/onboarding (→ 007-03), and `statusProperty`'s override path exercised only by synthetic fixtures until a real project needs it (ADR-0009 A1) — all recorded in the deviation log above. |
