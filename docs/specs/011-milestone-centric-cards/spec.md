---
status: IN_PROGRESS
skill:
use_cases: []
---

# Spec 011: Milestone-centric cards

> Reserved on 2026-08-06 via `workflow.py new`. Owner-approved model (mockup
> reacted to); SPIDR-split below.

## Overview

Today each project card is a generic scan dump: a project-description "goal", a
project-global deadline, a full spec list with a global progress bar, an empty
"workstreams" block, and a top-of-card warnings box listing worktree docs by
path. The owner's reframe: **the card is a high-level signal surface; the detail
lives in the project's code.** The card becomes **milestone-centric** — the
*active* workstream is the unit that carries the goal, deadline, and progress,
and everything else folds into it or demotes to an icon.

The model, anchored in shaper's own release-plan convention:

- A **milestone/workstream** is a shaper release plan (`docs/releases/*.md`) with
  a `## Status` field. Lifecycle: `candidate → committed → shipping → shipped →
  dropped`. **Active** = `shipping ?? committed`; **Next** = `candidate`;
  **Completed** = `shipped` (hidden); `dropped` (hidden).
- **Goal** = the active milestone's title (the project description is dropped as
  redundant).
- **Deadline** = the active milestone's *appetite*, shown inline with it.
  Appetites are usually relative ("≤ 2 weeks from start") or "TBD" → rendered as
  timebox text or `unknown`, never a fabricated date.
- **Progress** = the active milestone's %, rolled up from the **parent specs**
  its cutline references. Slices are a jig/SPIDR internal and are NOT surfaced.
  The project-wide spec bar becomes a **fallback** only when a project has no
  release plan.
- **Workstreams** = active + next by `Status`; no per-spec list. In the
  **fallback** (no release plan), the discovered checklist workstreams (the
  ≥3-checkbox docs already scanned) are surfaced instead.
- **Warnings** (collection issues + cleanup-worthy worktrees) collapse to a
  header ⚠ icon with a hover tooltip; the top warnings block is removed.
- **Worktrees/PRs** map to their **specific milestone**: an open PR shows as a
  badge on its milestone; cleanup-worthy (stale/forgotten) worktrees go in the ⚠
  tooltip. Worktrees that don't map to a milestone go to an honest
  "unassociated" bucket. No file paths anywhere.

## Assumptions

<!-- Grounding (spec 064-02 / ADR-0020): probed against the live repos. -->

- **Release plans carry a usable `Status`** — verified: gauge's four
  `docs/releases/*.md` each have a `## Status` with one of
  `candidate/committed/shipping/shipped/dropped` (local-portfolio-loop =
  `committed`; the other three = `candidate`). `scanWorkstreams` already emits
  them as `kind: 'release'` with parsed body.
- **Most projects have NO release plan** — verified: jig, shaper (README only),
  and the mystique/personalization entries have no `docs/releases/*.md`. So the
  fallback path is the common case, not the exception, and must be first-class.
- **The active-milestone → spec linkage is by prose reference, not structured
  data** — verified: gauge's active release references `spec 003/004/009/009-01/
  009-02` as free text in its Cutline. Rolling these up to parent specs
  (`003/004/009`) and reading their statuses is a heuristic parse, not a
  guaranteed contract. **Load-bearing assumption:** a release doc's spec
  references are discoverable by a `spec NNN` regex and map to `docs/specs/NNN-*`.
  Where a release references no specs, milestone progress is `unknown` and the
  card falls back to the global bar for that project.
- **Worktree → milestone mapping is a best-effort heuristic** — a worktree's
  branch name or resolved PR often (not always) encodes a spec id; only some
  branches do (e.g. `spec-096-jig-ceremony`), while others are codenames
  (`sad-jepsen`) or bug/review checkouts. **Load-bearing assumption:** mapping
  will be partial, so an "unassociated" bucket is required, not optional. The
  exact extraction rule is shaped in slice 05.
- Existing scan/derive building blocks are reused, not rebuilt: `scanWorkstreams`
  (releases + discovered checklists), `scanWorktreeOnlyDocs` (lifecycle state +
  `pr`, ADR-0015/0016), `scanSpecs` (statuses), and the `/api/data` read-layer
  join (ADR-0011/0012).

## Decomposition

SPIDR. This is an **Interface**-heavy redesign over existing scan data, split so
each slice touches the card UI and delivers end-to-end value. Spike not needed —
the model is decided; the one genuinely-unknown mechanism (worktree→milestone
mapping) is isolated to its own Rules/Data slice, not a research prelude.

- **Path** splits the spine: 011-01 handles the *has-a-release-plan* path
  (gauge); 011-03 handles the *no-release-plan* fallback path (jig/shaper/cwv).
- **Rules/Data** refines derivation: 011-02 (milestone progress from referenced
  parent specs) and 011-05 (worktree→milestone association rule).
- **Interface** covers the warning-affordance change: 011-04 (⚠ icon + tooltip).

Ordering: 01 (spine) → 02 (real progress) → 03 (fallback) → 04 (warnings) → 05
(worktree mapping). Each is independently shippable; the card degrades
gracefully between slices (e.g. before 02, the active milestone reuses the global
bar).

## Slices

- [011-01 — active-and-next milestone from release Status](slice-01-active-next-milestone.md)
- [011-02 — milestone progress from referenced parent specs](slice-02-milestone-progress-from-specs.md)
- [011-03 — fallback card: global progress + discovered workstreams](slice-03-fallback-card.md)
- [011-04 — warnings collapse to a header ⚠ icon + tooltip](slice-04-warning-icon-tooltip.md)
- [011-05 — map worktrees/PRs to their milestone](slice-05-worktree-milestone-mapping.md)
