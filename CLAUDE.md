# Gauge

> Status: Active — reframed 2026-07-13 by
> [ADR-0003](docs/decisions/adr-0003-reframe-onto-gauge-portfolio-product.md).
> Generated Jig workflow infrastructure remains authoritative for development.

## What this project does

Gauge is a private cross-project delivery dashboard. It tracks progress toward
project-owned goals, deadline confidence, blockers, and recommended attention
without mutating source repositories. The committed MVP is local, single-user,
single-repository-per-project, and limited to one active goal per project.

The shipped runtime implements the Gauge adapter, normalized-observation, and
central-state boundary from
[spec 004](docs/specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md),
plus the complete **local pull portfolio loop** from
[spec 009](docs/specs/009-complete-local-portfolio-loop/spec.md): curated
goal/deadline onboarding (ADR-0011), history-derived forecast/risk (ADR-0012),
and the cross-project attention queue (ADR-0013), all on the manual-pull model.
Deferred: automated daily scheduling and the edge-push topology (specs 005/006).

## Hot Cache

This is an index. Durable detail lives in `docs/`; update it through
`/jig:memory-sync` rather than expanding this primer indefinitely.

### Project identity and active work

- **Gauge** — portfolio observer; owns registry, central observations/history,
  forecasts, risk, and cross-project attention policy.
- **Source projects** — own goals, deadlines, local priorities, and lifecycle
  state; Gauge reads them without writing.
- **Committed MVP** — maximum two weeks; see
  [local-portfolio-loop](docs/releases/local-portfolio-loop.md).
- **Landed runtime** —
  [spec 004](docs/specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md)
  (identity, adapters, normalized observations, central state), spec 007
  (project-shape profiles), spec 008 (generic-doc adapter), and
  [spec 009](docs/specs/009-complete-local-portfolio-loop/spec.md) (the complete
  local pull loop: goal/deadline, forecast/risk, attention queue). `src/derive.mjs`
  is the history-derived layer (ADR-0006); goal/deadline + forecast + attention are
  read-layer joins on `/api/data`, not observation-v1 fields.
- **Retired work** — spec 003's local session panel was abandoned by ADR-0003.

### Key terms

- **Adapter** — optional read-only translator from a source convention into
  Gauge observations.
- **Observation** — versioned, provenance-bearing evidence collected at a point
  in time; v1 is canonical in `schemas/observation-v1.schema.json` with typed,
  independently versioned capability signals.
- **Instance state** — Gauge-owned private registry and history, separate from
  product code and source repositories.
- **Attention queue** — deterministic, explained cross-project ordering; never
  a rewrite of project-local priority.
- **Unknown** — required output when dates, freshness, or evidence are
  insufficient; never coerce to zero or healthy.
- Full definitions: [glossary](docs/memory/glossary.md).

## Session workflow

1. Read [product vision](docs/product-vision.md),
   [architecture](docs/architecture.md), and the
   [spec](docs/specs/README.md) plus [bug](docs/bugs/README.md) boards.
2. Route defects through `jig:bug-fix`; route non-trivial behavior through
   `jig:spec-workflow`.
3. Select the next shaped MVP slice from the status board and resolve any
   trigger-bound decision in `docs/refinement-todo.md` first.
4. Implement with tests, required independent review passes, reconciliation,
   and memory sync.

## Key documents

| Document | Purpose |
|---|---|
| [docs/product-vision.md](docs/product-vision.md) | Product boundary and success criteria |
| [docs/architecture.md](docs/architecture.md) | Target modules, data flow, and trust boundaries |
| [docs/workflow.md](docs/workflow.md) | Jig lifecycle and review gates |
| [docs/conventions.md](docs/conventions.md) | Coding and authoring rules; edits require human approval |
| [docs/releases/](docs/releases/) | MVP and follow-up cutlines |
| [docs/specs/README.md](docs/specs/README.md) | Implementation status board |
| [docs/bugs/README.md](docs/bugs/README.md) | Defect status board |
| [docs/refinement-todo.md](docs/refinement-todo.md) | Deferred decisions and triggers |

## Constraints

- Never write to configured source repositories.
- Preserve explicit provenance, freshness, and unknown states.
- Keep Jig, Shaper, Servo, and GitHub integrations optional behind adapters.
- Do not add runtime dependencies while ADR-0001 remains accepted.
- Do not edit `docs/conventions.md` without explicit human approval.
- Never commit or log secrets; private portfolio context is sensitive data.
