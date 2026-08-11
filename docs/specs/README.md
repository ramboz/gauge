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
| [004-retrofit-dashboard-runtime-onto-gauge-portfolio-product](004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md) | 004-01 — Gauge core and central state | **DONE** | 64 tests green; all implementation and reconciliation reviews pass; ADR-0005 is the corrected contract |
| [005-central-observation-ingest-boundary](005-central-observation-ingest-boundary/spec.md) | 005-01 — Authenticated observation ingest endpoint | DEFERRED |  |
| [005-central-observation-ingest-boundary](005-central-observation-ingest-boundary/spec.md) | 005-02 — Freshness aging for silent projects | DEFERRED |  |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-01 — Local observation emitter | DEFERRED |  |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-02 — Trigger and authenticated push | DEFERRED |  |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-03 — Project-declared goal and deadline | DEFERRED |  |
| [007-project-shape-profiles](007-project-shape-profiles/spec.md) | 007-01 — Explicit artifact-root profile (Pattern B) | **DONE** |  |
| [007-project-shape-profiles](007-project-shape-profiles/spec.md) | 007-02 — Multi-entry decomposition (Pattern C) | **DONE** |  |
| [007-project-shape-profiles](007-project-shape-profiles/spec.md) | 007-03 — Profile discovery and onboarding | **DONE** |  |
| [008-generic-doc-adapter](008-generic-doc-adapter/spec.md) | 008-01 — Flat layout + honest completion (jig preset unchanged) | **DONE** |  |
| [008-generic-doc-adapter](008-generic-doc-adapter/spec.md) | 008-02 — Auto-detect + discovery emits `specLayout` | **DONE** |  |
| [008-generic-doc-adapter](008-generic-doc-adapter/spec.md) | 008-03 — Declarable completion vocabulary + foreign-status gate (DEFERRED) | DEFERRED |  |
| [009-complete-local-portfolio-loop](009-complete-local-portfolio-loop/spec.md) | 009-01 — Goal/deadline onboarding authoring | **DONE** |  |
| [009-complete-local-portfolio-loop](009-complete-local-portfolio-loop/spec.md) | 009-02 — Forecast/risk derivation | **DONE** |  |
| [009-complete-local-portfolio-loop](009-complete-local-portfolio-loop/spec.md) | 009-03 — Global attention queue | **DONE** |  |
| [010-multi-entry-goal-deadline](010-multi-entry-goal-deadline/spec.md) | 010-01 — entry-level goal/deadline | **DONE** |  |
| [011-milestone-centric-cards](011-milestone-centric-cards/spec.md) | 011-01 — active-and-next milestone from release Status | **DONE** |  |
| [011-milestone-centric-cards](011-milestone-centric-cards/spec.md) | 011-02 — milestone progress from referenced parent specs | **DONE** |  |
| [011-milestone-centric-cards](011-milestone-centric-cards/spec.md) | 011-03 — fallback card: global progress + discovered workstreams | **DONE** |  |
| [011-milestone-centric-cards](011-milestone-centric-cards/spec.md) | 011-04 — warnings collapse to a header ⚠ icon + tooltip | **DONE** |  |
| [011-milestone-centric-cards](011-milestone-centric-cards/spec.md) | 011-05 — map worktrees/PRs to their milestone | DRAFT |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 🔬 012-01 — feasibility spike: what local data supports which metrics | **DONE** |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 012-02 — git velocity on the card | DRAFT |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 012-03 — token cost: total + by-model | DRAFT |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 012-04 — token cost: by-activity + by-skill | DRAFT |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 012-05 — team signals: human-vs-agent split + contributors | DRAFT |  |
| [012-portfolio-manager-analytics](012-portfolio-manager-analytics/spec.md) | 012-06 — RAG health chip (deadline-gated) | DRAFT |  |

## Deferred slices

> Slices parked with a stated resolution trigger. Re-open by transitioning to DRAFT.

| Spec | Slice | Resolution trigger |
|------|-------|--------------------|
| [005-central-observation-ingest-boundary](005-central-observation-ingest-boundary/spec.md) | 005-01 — Authenticated observation ingest endpoint | when hosted auth / GitHub-push collection is tackled (the |
| [005-central-observation-ingest-boundary](005-central-observation-ingest-boundary/spec.md) | 005-02 — Freshness aging for silent projects | when hosted auth / GitHub-push collection is tackled. The |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-01 — Local observation emitter | when hosted auth / GitHub-push collection is tackled. The |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-02 — Trigger and authenticated push | when hosted auth / GitHub-push collection is tackled (the |
| [006-edge-collection-client](006-edge-collection-client/spec.md) | 006-03 — Project-declared goal and deadline | when hosted auth / GitHub-push collection is tackled. The |
| [008-generic-doc-adapter](008-generic-doc-adapter/spec.md) | 008-03 — Declarable completion vocabulary + foreign-status gate (DEFERRED) | a real project encodes a **delivery** status (work |

## Abandoned slices

> Slices permanently dropped, with a stated reason. This is distinct from Deferred (parked, resumable) — re-open by transitioning to DRAFT.

| Spec | Slice | Abandonment reason |
|------|-------|---------------------|
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-01 — sessions-scan-and-render |  |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-02 — recency-expand-toggle |  |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges |  |

## Richer-skill selection audit (spec 096-05)

Advisory (ADR-0040 auditability — never blocks). Regenerated from `reviews/slice-*.md` `substrate:` fields.

- **0** pass(es) recorded `not-shown` (selection step did not run — the kill-criterion-1 defect signal).
- **4** pass(es) recorded `non-interactive` (declared no-orchestrator / CI).
- **0** shown-and-declined anomaly(ies) (a high-confidence richer skill was shown and not applied):
