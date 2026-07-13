---
status: DONE
dependencies: [002-01]
last_verified: 2026-07-13
---

## Slice 002-02 — workstreams

**Goal:** Each project card lists its sub-projects — shaper release plans
and checkbox runbooks — with progress, current phase, next unchecked step
and its owner, plus a warning for docs that exist only in a worktree.

**DoR:**
- ✅ 002-01 scanner pipeline exists to extend.
- ✅ Real workstream shapes verified (spec brief): `docs/releases/*.md` +
  slate, checkbox runbooks with `**(you)**`/`**(Claude)**` owner tags,
  phase-heading roadmaps without checkboxes.
- ✅ Registry decision: pure auto-detection rejected (slice DoD checklists
  make checkbox scanning too noisy); discovered candidates require a pin.

**Acceptance Criteria:**

1. **Release plans.** Every `docs/releases/*.md` (README excluded) appears
   as a workstream row named from its H1 (filename fallback).
2. **Runbook parsing.** A pinned runbook shows: checked/total top-level
   boxes, current phase (first heading with an unchecked box), next action
   (first unchecked box, truncated), and owner when the step carries a
   `**(you)**` / `**(Claude)**` tag. Fixture: the caption runbook shape —
   10 steps, 0 checked, phases A–F, next = step 1, owner = you.
3. **Discovery, not auto-adoption.** Checkbox docs outside `docs/specs/`
   (and outside `docs/releases/`) with ≥ 3 boxes are listed as "discovered,
   not pinned"; `docs/specs/**` never appears. `docs/bugs/**` and the
   scaffold's `docs/adoption-readiness.md` are likewise excluded — bug
   lifecycle is its own counter, and scaffold boilerplate repeats in every
   project (pin explicitly to surface it). Pinning/hiding happens in
   `dashboard.config.json` per project (`pinnedWorkstreams`,
   `hiddenWorkstreams`, repo-relative paths).
4. **Worktree-only warning.** A doc under `.claude/worktrees/*/docs/**`
   whose repo-relative path does not exist in the main tree produces a
   warning badge on the project card naming the worktree and the file.
   Path-existence comparison only — never content diffing.
5. **Tests.** Runbook parser (boxes, phases, owner tags, next-step),
   discovery exclusion rules, worktree-only detection — each with fixtures.

**DoD:**
- [x] All ACs pass; full test suite green (28 tests, no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
- [x] Reviewed against spec — independent reviewer subagent, 2026-07-13,
      verdict "PASS with conditions"; all conditions closed same day (see
      deviation log).
- [x] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice the user sees, per
project, every sub-project with its next step and owner — the "many
sub-projects, one human brain" problem visibly solved, including the
at-risk caption runbook.

### Deviation log

- AC3 gained two discovery exclusions after live verification showed noise:
  `docs/bugs/**` (bug DoD checklists surfaced as workstreams) and the
  scaffold's `docs/adoption-readiness.md` (identical boilerplate in every
  project). AC text updated in place before review; regression test added.
- Render-only choice: checkbox-less **release** plans show no phase count
  (their `##` headings are prose sections, not phases); checkbox-less
  pinned runbooks still show one (e.g. the launch-phases roadmap).
- Live finding, no code change: a caption-generator runbook variant (4/22
  steps) now exists in project-b' main tree and surfaces via discovery;
  the worktree copy still trips the worktree-only warning as designed.
- Post-review fix: `ownerOf` matches only the bold tag convention
  (`**(you)**` / `**(Claude)**`, incl. suffixed forms) — a plain
  "(your choice)" no longer yields an owner. Tests added.
- Scope decisions logged per review: discovery walks `docs/**` only (a
  checkbox doc at repo root is never discovered); the test fixture is a
  reduced 3-step caption shape, not the full 10-step/phases-A–F original;
  numbered checkboxes count at any indent; worktree-only warnings cap at
  40 docs per project and the badge names only the first offender; a
  workstream with no H1 falls back to its repo-relative path as title;
  pinning a path under `docs/releases/` is ignored (already rendered).
