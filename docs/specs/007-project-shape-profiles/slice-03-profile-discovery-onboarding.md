---
status: DONE
dependencies: [007-01]
last_verified: 2026-08-03
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-03 — Profile discovery and onboarding

**Goal:** A read-only onboarding step introspects a source — and prefers a
source's own self-declaration (`repos.yaml` scope tags, a `tracks/*/specs`
layout) — to author a valid profile, so a Pattern B/C project is configured
without hand-writing artifact roots or entries.

**DoR:**
- ✅ 007-01 DONE (profile v1 contract + adapter consumption); 007-02 DONE
  strongly preferred so discovery can emit multi-entry profiles.

**Acceptance Criteria:**

1. **A discovery command proposes a profile.** `node scripts/onboard.mjs --path <repo>`
   (wired as `npm run onboard`) inspects a source **read-only** and prints a
   proposed profile-v1 document: detected artifact root(s), folder names, and —
   for umbrella repos — candidate `entries`.
2. **Declaration wins over guessing.** When the source self-declares structure (a
   `repos.yaml` with `scope:` tags, or a `tracks/*/{specs,decisions}` layout),
   discovery derives entries from that declaration rather than heuristics —
   honoring project authority (ADR-0003).
3. **Output is drop-in and valid.** The proposed profile validates against
   `project-profile-v1` and can be pasted into `gauge.config.json` unedited;
   discovery on `personalization-workspace` proposes the 3-track multi-entry
   profile, and on `mystique` proposes the `docs/opportunities/cwv` (+
   `superpowers`) root(s).
4. **Discovery is read-only and non-collecting.** It emits a profile only; it
   performs no source writes and no observation collection (the invariant and the
   separation of concerns both hold).
5. **Reusable at the edge.** The discovery logic is a pure module with no
   central-only assumptions, so [spec 006](../006-edge-collection-client/spec.md)'s
   edge skill can reuse it to self-profile a project at onboarding time.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). 103/103 pass (baseline 92 → +11).
- [x] Coverage: heuristic discovery (nested roots), declaration-driven discovery
      (`repos.yaml` / `tracks/*`), profile-v1 validity of output, read-only
      assertion, CLI-level smoke, and real-corpus smokes (mystique +
      personalization-workspace, run read-only by the orchestrator — see deviation log).
- [x] Reviewed (compliance + craft + arch). All three `pass`; evidence in
      `reviews/slice-03-*.md`.
- [x] Deviation log + Reconciliation sweep produced.
- [x] `docs/refinement-todo.md` entry marked RESOLVED (07 closes the onboarding item).

**Anti-horizontal-phasing check:** After this slice, a user runs one command
against a real Pattern C repo and gets a ready-to-paste profile that renders its
tracks — the hand-authoring cost from 01/02 disappears.

### Deviation log (after reconciliation)

- **New pure module `src/discover.mjs` + read-only CLI `scripts/onboard.mjs`
  (wired `npm run onboard`).** `discoverProfile(root)` returns
  `{ source, profile, notes }` with precedence **declaration → heuristic →
  default → none**. It emits a profile-v1 document that validates against
  `validateProfile` and is drop-in for a `gauge.config.json` project's
  `profile` field (proven end-to-end: a discovered `entries[]` profile expands
  through `normalizeConfig` into N projects). No change to
  `config`/`observation`/`state`/`scan`/`server` — discovery is upstream of the
  config seam.
- **AC5 purity held to the letter, with one carried coupling.** `discover.mjs`
  imports only node builtins + `safeProjectId` from `config.mjs`; it imports
  **none** of `observation.mjs` / `state.mjs` / `server.mjs` (asserted by a
  source-string test). The arch pass flagged that pulling `safeProjectId`
  transitively loads `config.mjs` + `profile.mjs` (a schema `readFileSync` at
  init) — functionally pure (nothing central-only) but not the minimal edge
  footprint. **Deferred, not done:** extracting `safeProjectId` into a tiny
  `src/ids.mjs` is recommended *before* spec 006 reuses discovery at the edge;
  logged in `docs/refinement-todo.md`. Doing it now would widen this slice into
  `config.mjs` without a consumer requiring it.
- **AC2 "declaration" implemented as tracks/*-anchored, repos.yaml-ordered.**
  The literal AC wording is "a `repos.yaml` with `scope:` tags, **or** a
  `tracks/*` layout." Implemented as: entries always derive from the filesystem
  `tracks/*` directories (the authoritative artifact roots); `repos.yaml`
  `scope:` tags, when present, only **order/identify** them (scope-named tracks
  first, in declared order). A `repos.yaml` with no `tracks/` dirs does not by
  itself drive declaration. This is a deliberate narrowing — `scope:` tags name
  external code repos, not local artifact roots — and makes the parser
  non-load-bearing (a malformed manifest changes card order, never
  correctness). Both branches are tested (`proj-umbrella` = tracks-only;
  `proj-declared` = repos.yaml scope order overriding dir-alpha order, incl. an
  inline-list `scope: [ ... ]` line).
- **repos.yaml parsed by a minimal zero-dependency line scan (ADR-0001).** No
  YAML library. `parseScopeTags` recognizes scalar (`scope: rtb`) and inline-list
  (`scope: [rtb, offer-management]`) forms, stripping quotes/comments; the YAML
  **block-list** form (`scope:` then `- rtb` lines) is **not** recognized —
  such tracks fall back to directory-sort order. Known limitation of the
  line scanner; the real corpus (`personalization-workspace`) uses the
  supported forms.
- **Heuristic "drop the bare `docs` root when a nested root exists."** Mystique's
  root `docs/specs` holds 2 incidental spec dirs while the real artifacts live
  at `docs/opportunities/cwv`; when any strictly-nested artifact root is found,
  the bare `docs` root is dropped so genuine nested artifacts drive the profile.
  Carried assumption (arch pass): the inverse can misfire — an incidental nested
  root (e.g. `docs/archive/specs`) could suppress a real flat `docs` root. Judged
  acceptable because discovery is a **reviewed proposal** that prints its
  `source` + `notes`, not an autonomous write.
- **Declaration detection is scoped to the literal `tracks/` umbrella name**
  (per ADR-0009's Pattern C). A differently-named umbrella (`packages/`,
  `projects/`) falls through to the heuristic. In-scope for this slice; noted so
  spec 006 knows this is not a general umbrella detector.
- **Real-corpus smokes run read-only, not committed as tests.** The DoD names
  `mystique` + `personalization-workspace` smokes; external repos cannot be
  vendored as fixtures and must never be written to (ADR-0003), so — matching
  007-02's precedent — automated coverage uses synthetic fixtures
  (`proj-multiroot` mirrors mystique's cwv+superpowers+stray-docs shape;
  `proj-umbrella`/`proj-declared` mirror the tracks+repos.yaml shape) and the
  literal-repo smoke was run read-only by the orchestrator. Verified results:
  mystique → 2-entry `[docs/opportunities/cwv, docs/superpowers]` (source
  `heuristic`); personalization-workspace → 3-entry `[rtb, offer-management,
  contextual-experimentation]` in repos.yaml scope order (source `declaration`,
  note "derived from repos.yaml scope tags"). Both sources untouched.
- **Post-review polish applied before recording verdicts** (the ceremony's
  address-findings-then-record flow): dropped the misleading `[--json]` no-op
  from the CLI usage; wrapped the CLI's `discoverProfile` call in try/catch so a
  pathological id-derivation throw surfaces as a graceful error, not a raw stack
  trace; added 3 `spawnSync` CLI-level tests (drop-in stdout JSON, missing-path
  failure, no-artifacts failure) strengthening AC1's command framing.
- **Craft nits carried (non-blocking):** entry `label` is not deduped on a
  basename collision (ids are, deterministically via `safeProjectId` +
  numeric-suffix `uniqueId`); `parseArgs` (snapshot.mjs + onboard.mjs) and
  `isDir` (scan.mjs + discover.mjs) each have 2 callers — under ADR-0002's
  extract-on-third-caller threshold, so left inline; logged so the third caller
  triggers extraction.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `src/discover.mjs`, `scripts/onboard.mjs` | `added` | The slice deliverable: pure discovery module + read-only onboarding CLI. |
| `package.json` | `updated` | Wired `npm run onboard`. |
| `test/discover.test.mjs`, `test/fixtures/proj-multiroot`, `test/fixtures/proj-declared` | `added` | 11 tests (8 module + 3 CLI) over every AC + DoD coverage list; two new fixtures for the multi-nested-root and repos.yaml-ordering cases. |
| `docs/architecture.md` | `updated` | Contract-surfaces: profile bullet now notes automated discovery (`src/discover.mjs`, declaration-preferring, edge-reusable); CLI bullet adds read-only `npm run onboard`. |
| `docs/refinement-todo.md` | `updated` | Onboarding/multi-entry item marked **RESOLVED** (007-03 closes it, spec 007 complete); added the `safeProjectId → src/ids.mjs` pre-spec-006 follow-up and the block-list-YAML limitation. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` to reflect 007-03 DONE and spec 007 rollup DONE. |
| `docs/decisions/` (ADRs) | `no-op` | Implements ADR-0009's already-recorded contract (D1 config-inline home, D2 `entries[]`); no new/changed decision. Discovery is production of the existing contract, not a new one. |
| `schemas/` | `no-op` | Discovery emits the existing `project-profile-v1`; no schema change. |
| `src/config.mjs` / `src/scan.mjs` / `src/observation.mjs` / `src/state.mjs` / `src/server.mjs` | `no-op` | Discovery sits upstream of the config seam; consumers see an ordinary profile. |
| Render layer (`public/index.html`) | `no-op` | No new rendering — a discovered profile pasted into config renders through the existing per-entry card path. |
| `docs/product-vision.md` | `no-op` | Removes hand-authoring cost; changes no success criterion. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Compress-on-close-out checked: `CLAUDE.md` carries no spec-007 line (007 is follow-up-line work, never in the Hot Cache), no `AGENTS.md` exists, and no scaffold template references 007 — nothing to compress. |
| `docs/inbox.md` | `no-op` | The reference-project corpus entry (mystique/personalization-workspace) is a standing validation corpus — unchanged; this slice validated *against* it. |
| `docs/memory/glossary.md` | `no-op` | "Project profile" term already covers discovery-produced profiles; no new load-bearing term. |
| Deferred/known limitations | `deferred` | `safeProjectId → ids.mjs` extraction (pre-spec-006); block-list-YAML scope form; label dedup; per-entry-pin scoping (carried from 007-02) — all in `docs/refinement-todo.md`. |
