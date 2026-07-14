# Spec Status Board

> Status: Draft (wizard-generated)
>
> Current state of all specs for Gauge. Update after each slice transition.
>
> A leading 🔬 in the Slice column flags slices marked `kind: spike` in
> their frontmatter — timeboxed investigation, not feature work. The
> marker is recomputed from each slice's `kind:` field on every regen
> by `workflow.py status-board`; it is never stored separately in this
> file.
>
> Related: [Bug Status Board](../bugs/README.md). Check both boards before
> folding reported defects into spec acceptance criteria.

| Spec | Slice | Status | Notes |
|------|-------|--------|-------|
| [001-adopt-jig](001-adopt-jig/spec.md) | 001-01 — bootstrap | **DONE** | worked example; review boxes satisfied by deterministic completion check |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-01 — scan-and-serve | **DONE** | scanner + server + cards page; independent review passed 2026-07-13 |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-02 — workstreams | **DONE** | releases + runbooks + pin registry + worktree-only warning |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-03 — compass-snapshot | **DONE** | closed POC history; ADR-0002 superseded by ADR-0003; legacy reader migrates in spec 004 |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-01 — sessions-scan-and-render | ABANDONED | retired by ADR-0003; session-centric expansion is outside the committed Gauge MVP |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-02 — recency-expand-toggle | ABANDONED | retired with spec 003 by ADR-0003 |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges | ABANDONED | retired with spec 003 by ADR-0003 |
| [004-retrofit-dashboard-runtime-onto-gauge-portfolio-product](004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md) | 004-01 — Gauge core and central state | RECONCILED | 64 tests green; all implementation and reconciliation reviews pass; ADR-0005 is the corrected contract |

## Abandoned slices

> Slices permanently dropped, with a stated reason. This is distinct from Deferred (parked, resumable) — re-open by transitioning to DRAFT.

| Spec | Slice | Abandonment reason |
|------|-------|---------------------|
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-01 — sessions-scan-and-render | Retired by ADR-0003; local session inspection is outside the Gauge MVP. |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-02 — recency-expand-toggle | Depended on retired slice 003-01 and the superseded session-panel frame. |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges | Depended on retired slice 003-01 and the superseded session-panel frame. |
