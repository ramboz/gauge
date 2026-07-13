# Release Plan: Gauge Follow-up 2 — Multi-source Portfolio Signals

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- The MVP proves delivery tracking with generic GitHub milestone and Jig evidence, but it cannot yet consume release-shaping or evaluation-quality signals from the wider ecosystem.

## Appetite

- TBD — owner to set after MVP forecasting and hosted access produce real usage evidence.

## Solution Outline

- Add optional Shaper and Servo adapters, evolution views over central history, and bounded project-specific metrics while preserving the normalized observation and explainability contracts.

## Risks / Rabbit Holes

- Conflating Shaper appetite or Servo oracle scores with delivery completion; retire with typed signal semantics and adapter-specific confidence, never one opaque health score.

## No-Gos

- No organization-wide portfolio governance, multiple-team roles/views, multi-repository projects, concurrent goals, automatic source-state mutation, generic plugin marketplace, or arbitrary user code execution.
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Optional Shaper adapter | Existing release-plan artifacts | Adds release scope, cutline, risks, and readiness without making Shaper mandatory. |
| Project-owned Shaper target-date contract | ADR-0003 open question | Supplies deadlines without central duplication. |
| Optional Servo adapter | Stable JSON/status seams reviewed in Servo | Adds suitability, gate/regression, and evaluation freshness as typed evidence. |
| Evolution views over central history | MVP snapshot store | Makes pace and scope change visible without new source writes. |
| Bounded project-specific metrics | Owner long-term direction | Allows useful local measures behind explicit semantics and provenance. |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Organization-wide governance and multiple-team roles/views | Later identity expansion | The preceding release's one-team access boundary is sufficient for signal depth. |
| Multi-repository project identity | Long-term topology | Avoid combining source enrichment with identity redesign. |
| Concurrent goals | Long-term topology | Preserve the one-active-goal model while adapters mature. |
| Write-back and automated lifecycle transitions | Gauge boundary | Signals remain observational. |
| Generic plugin marketplace or arbitrary adapter code | Operational/security risk | Add adapters through reviewed contracts only. |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Shaper integration | One adapter spec | Release semantics and deadline mapping are distinct from evaluation evidence. |
| Servo integration | One adapter spec | Preserve suitability/gate semantics without mapping scores to completion. |
| History-derived views | One UI/data slice | Build only after enough MVP observations exist. |
| Project-specific metrics | One bounded extension contract | Keep custom metrics from contaminating the core schema. |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Coordinate Shaper `target_date` ownership and schema | Field does not exist today | Do not parse an invented deadline from appetite prose. |
| Freeze semantic mapping for Servo evidence | Servo scores are conformance, not progress | Prevent a misleading composite health score. |
| Collect real requests before custom metric API design | Current signal is aspirational | Avoid a speculative plugin system. |

## JIG Handoff

- Shape adapter specs only from observed MVP gaps.
- Coordinate a project-owned Shaper `target_date` contract before drafting its Gauge adapter.
- Consume Servo only through stable JSON/export seams; never read or mutate writer-owned local state directly when a command/export exists.
- Keep Shaper, Servo, history views, and custom metrics as separate JIG slices/specs so any one can be cut without invalidating the release.

## Release-Check Criteria

- Gauge remains useful when either adapter is absent and labels missing signals as unavailable rather than failed.
- Shaper scope/readiness and Servo evaluation evidence remain distinct from delivery progress and deadline forecasts.
- Every trend and metric links to its source, collection time, and adapter semantics.

_Last shaped: 2026-07-13_
