# Gauge

> Status: Active — reframed 2026-07-13 by
> [ADR-0003](docs/decisions/adr-0003-reframe-onto-gauge-portfolio-product.md),
> sharpened 2026-08-07 by
> [ADR-0017](docs/decisions/adr-0017-reframe-onto-manager-lens.md) (manager lens,
> analytics scope, reconstructable/captured history).
> Generated Jig workflow infrastructure remains authoritative for development.

## What this project does

Gauge is the **manager / portfolio lens** — a private, read-only, cross-project
view: how each project advances toward its active milestone, whether it will
hold (RAG), what it costs (token spend), and what needs a hand next (PRs to
merge · in flight · blockers). It works at **milestone** granularity (never
slices) and is complementary to a separate **engineer daily-driver** (slice/
session) it does not rebuild (ADR-0017). It **derives, never asks** — no manual
status. The committed MVP is local, single-user, single-repository-per-project.

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

- **Gauge** — the manager/portfolio lens (ADR-0017); read-only observer that owns
  registry, observations/history, forecasts, risk, cost/velocity analytics, and
  cross-project attention. Milestone granularity, never slices; shallow detail
  tier (stops before slices/sessions/tasks — that's the engineer daily-driver's
  job). Project-centric (people dimension deferred).
- **Source projects** — own goals, deadlines, local priorities, and lifecycle
  state; Gauge reads them without writing.
- **Active build (manager dashboard)** — two dated releases:
  [manager-dashboard-local-data](docs/releases/manager-dashboard-local-data.md)
  (committed, 2026-08-14) and
  [thin-client-and-central-collection](docs/releases/thin-client-and-central-collection.md)
  (**shipped** 2026-08-18 via [spec 014](docs/specs/014-thin-client-and-central-collection/spec.md),
  4/4 slices DONE: SessionEnd capture hook + auto-installer, capture-validity +
  read-layer live-tail currency, history-derived velocity/cost trends, and the
  optional live-session "running now" enrichment — `npm run install-hook`
  registers the SessionEnd + SessionStart hooks; forecast/trend reads are
  `/api/data` joins; `deriveForecast` stays a pure now-free fold).
  [Spec 011 — milestone-centric cards](docs/specs/011-milestone-centric-cards/spec.md)
  is **DONE** (all 5 slices landed): the card leads with the active milestone
  (goal = active release title, appetite = timebox, milestone-scoped progress bar),
  a no-release-plan **fallback** (global bar + discovered workstreams), warnings
  collapsed to a header **⚠ + tooltip**, and worktrees/PRs mapped to their
  milestone(s) with an **unassociated** bucket. The read-layer join is
  `attachMilestones` in `src/milestone.mjs` (`milestone: {active, next}` on
  `/api/data`, `active.specProgress` + `referencedSpecs`).
  [Spec 015 — manager-card redesign](docs/specs/015-manager-card-redesign/spec.md)
  is **DONE** (all 4 slices; **landed directly to main, formal review waived** —
  honest per-slice deviation logs record it). Rebuilds the `public/index.html`
  card to the spec-012 mockup: RAG-tinted **callout band** (`cardCallout`),
  compact milestone line + **scope-labeled progress bar** ("milestone · 6/7" vs
  "overall · 11/13" — the render half of the 100%-vs-behind-pace fix), a **2×2
  metric grid** (`statsRow`: big numbers cost/LLM-ratio over velocity/cost-trend
  graphs), **SVG sparklines** (`sparkline`, replacing unicode blocks), and CSS
  overflow discipline (`.card{min-width:0}`). The old all-releases workstream
  dump is gone. Gated by a servo **`design-eval`** (`.servo/design-eval/`, `cli`
  vision judge, Playwright scoped so the product `package.json` stays `{}`);
  fidelity 0.25 → 0.55. **Rebaseline pending:** the frozen mockup is single-row,
  so the 2×2 diverges deliberately — update `manager-dashboard-mockup.html` +
  re-freeze to make the gate track the real target (see lightweight-decisions).
  [Spec 012 — portfolio-manager analytics](docs/specs/012-portfolio-manager-analytics/spec.md)
  is **DONE** (spike + all 5 raw-layer/RAG slices landed): git **velocity**
  (`src/velocity.mjs`, sparkline), **token cost** total + by-model and the
  by-activity/by-skill detail tier (`src/cost.mjs`, per-request deduped, illustrative
  pricing, `GAUGE_TRANSCRIPTS_ROOT`), **team** signals (`src/team.mjs`, agent-coauthor
  proxy + contributors, no PII), and the deadline-gated **RAG health chip**
  (`forecastToRag` over the existing 009-02 forecast; gray "needs a deadline set"
  until a curated deadline exists; worst-first card sort). Each is a `/api/data`
  read-layer join. Design reference: spec 012
  `design/manager-dashboard-mockup.html`. **History is reconstructable from git
  (past) + captured on session-stop (future)** — the forecast "history gate" is a
  code limit, not a data one. Blockers count is approximate pending jig#195.
  Gauge's own deadline is now set (2026-08-28) in the gitignored config; RAG reads
  honest `unknown (insufficient-history)` until the git-backfill seed accrues ≥2
  spaced observations (spike 012-01 dogfood done). Releases:
  manager-dashboard-local-data and thin-client-and-central-collection are both
  **shipped**.
- **Dateless forecast —
  [ADR-0018](docs/decisions/adr-0018-date-independent-forecast.md) (Accepted
  2026-08-13):** the portfolio is appetite-shaped, not date-driven, so ADR-0012's
  deadline gate collapses every card to grey. ADR-0018 adds a **tiered** model:
  committed hard deadline → green/red; committed **soft appetite-window** →
  green/amber (`over-appetite`=cutline-due; **curated at onboarding** per ADR-0011,
  runtime never parses prose); no committed target → **neutral** `advancing`/
  `stalled` (no colour, no attention re-tiering); else `unknown`. Grounded in a git
  reconstruction: history gate dissolves, Gate 4 vindicated (gauge −0.60 naive vs
  +3.73 in-window pace), signal computable on 31–71% of observations. **Lesson:**
  any target/forecast inference must be **author-time curated, never runtime-derived
  from prose** (ADR-0011) — this killed an interim appetite-prose-parsing draft.
  **Implemented by [spec 013](docs/specs/013-date-independent-forecast/spec.md)
  (DONE):** 013-01 git-backfill seed (`src/backfill.mjs`, `npm run backfill` —
  reconstructs `progress(t)` from git so tier-1 deadline RAG lights on real
  history); 013-02 neutral date-free pace (`advancing`/`stalled`, gray, no
  attention re-tiering); 013-03 curated soft appetite-window (a distinct
  `appetiteWindow` profile field `$ref`'d to `deadline`; `within-appetite`→green /
  `over-appetite`→amber cutline-due at attention tier 2, never red). All in
  `deriveForecast(observations, deadline, appetiteWindow)` — one pure fold, gates
  run before the target discriminator. Owner action to light tier-2: curate an
  `appetiteWindow` date in the gitignored config; run `npm run backfill` for history.
- **Committed local-pull MVP** — the prior loop; see
  [local-portfolio-loop](docs/releases/local-portfolio-loop.md) (largely shipped).
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
