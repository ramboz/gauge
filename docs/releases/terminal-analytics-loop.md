# Release Plan: Gauge — Terminal Analytics Loop (history-derived MVP)

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- The landed runtime ([spec 004](../specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md))
  produces normalized observations and writes central history, but nothing yet
  *reads* that history. `readObservationHistory()` exists in `src/state.mjs` with
  no runtime caller; the shipped current-state card (`public/index.html`,
  `observeAll`) only ever shows the latest observation. The committed
  [local-portfolio-loop](local-portfolio-loop.md) MVP lists forecast/risk and the
  attention queue as in-scope but leaves them unbuilt, and it assumes a rendered
  UI. This plan shapes the history-derived (analytics) layer defined by
  [ADR-0006](../decisions/adr-0006-two-layer-derivation.md) as a raw terminal
  system, deferring polished web views.

## Appetite

- Roughly one to one-and-a-half weeks from implementation start.
- Fixed constraints: surface only in the terminal (extend `npm run scan`); derive
  observed pace, confidence-aware categorical risk, and a cross-project attention
  queue over central history joined to a real project-owned goal/deadline;
  preserve read-only source access, explicit `unknown` states, per-signal
  provenance/freshness, and the ADR-0006 derivation-module import boundary.
- Variable scope: forecast sophistication (a simple evidenced rule or `unknown` is
  acceptable where a trustworthy forecast is not), attention-overlay richness
  (coarse tiers are acceptable before ordered/weighted policy), the number of
  progress strategies, and any presentation polish. Cut these before extending the
  appetite.

## Solution Outline

- A generic GitHub milestone **goal adapter** supplies one project-owned
  goal/due-date (`goal@1`, already probed in ADR-0004) without requiring Jig. A
  new **`src/derive.mjs`** (per ADR-0006) folds `readObservationHistory()` plus the
  goal signal into observed pace, confidence-aware categorical risk
  (`on_track` / `at_risk` / `unknown`), and a deterministic **cross-project
  attention queue**. `npm run scan` (`src/cli.mjs`) gains derived sections beside
  the current-state dump. Two small policy ADRs — forecast confidence and the
  attention overlay — precede their derivation slices. No web analytics views ship
  in this release.

## Risks / Rabbit Holes

- False precision in forecasts: retire by gating `on_track` / `at_risk` behind an
  evidenced minimum-history rule tested against real accumulated observations;
  below it the only result is `unknown`.
- Attention overlay becoming a second project-management authority (ADR-0003 kill
  criterion): retire by keeping the queue categorical/advisory and explained, never
  a rewrite of project-local priority.
- Goal/deadline availability assumed rather than proven: retire by confirming a
  source-owned goal/date on at least three real projects before designing the
  forecast, per the ADR-0003 release gate.
- Layer-boundary erosion: `src/derive.mjs` must import only the history reader and
  observation-contract helpers, never adapters or `src/scan.mjs` (ADR-0006);
  enforce in review.
- Thin history at start: forecast confidence needs enough observations; manual
  `npm run collect` runs are acceptable for the MVP and this loop is what begins
  accruing that data.

## No-Gos

- No web-based analytics UI, evolution graphs, or charts (follow-up).
- No automated/scheduled collection; collection stays manual via `npm run collect`.
- No source-repository writes, multi-repository projects, concurrent goals,
  composite health score, Shaper/Servo adapters, hosted auth, notifications, or
  lifecycle mutation.

## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Generic GitHub milestone goal adapter (`goal@1`) | ADR-0004 non-Jig probe; refinement-todo "Generic goal and deadline source" | Supplies a project-owned goal/due-date so risk/forecast has a real deadline, no Jig dependency. |
| `src/derive.mjs` history-derived layer | [ADR-0006](../decisions/adr-0006-two-layer-derivation.md) | The single home that folds `readObservationHistory()` into derived signals, extractable later. |
| Observed pace / progress trend | Landed execution history | Buildable now over existing `execution.progress`; no policy gate. |
| Confidence-aware categorical risk | refinement-todo "Forecast confidence" → new ADR | Honest `on_track`/`at_risk`/`unknown` from goal + history, never coerced. |
| Cross-project attention queue | refinement-todo "Cross-project attention overlay" → new ADR | Explainable deterministic ordering across projects, advisory only. |
| Extend `npm run scan` with derived sections | Owner shaping decision (terminal surface) | Raw terminal surface for the whole loop without new UI scope. |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Nice web-based analytics UI, evolution graphs | Owner shaping decision | Presentation follows a proven raw derivation layer; current-state card UI already ships. |
| Automated daily scheduling | refinement-todo "Daily collection" | Separately gated; manual collection suffices to accrue history for the MVP. |
| Multi-source (Shaper/Servo) signals | [multi-source-portfolio](multi-source-portfolio.md) | Analytics is proven on GitHub+Jig evidence before widening sources. |
| Hosted access, multi-repo, concurrent goals | Long-term vision / [secure-small-team-hosting](secure-small-team-hosting.md) | Out of the single-user local topology. |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Goal/deadline adapter | One adapter spec | GitHub milestone → `goal@1` is independent of the derivation math. |
| Forecast-confidence policy | One ADR + one derivation slice | The minimum-evidence rule is a hard-to-reverse policy; keep it separately testable. |
| Attention-overlay policy | One ADR + one queue slice | Portfolio-intent policy is distinct from per-project risk. |
| Terminal rendering | One `cli.mjs` slice | Presentation is separable from derivation and adds no source access. |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Prove source-owned goal/date on three real projects | ADR-0003 release gate | Do not design forecasting around hypothetical signals. |
| Settle the forecast-confidence rule against real observations first | refinement-todo trigger | Prevent false precision before writing the risk slice. |
| Keep the attention queue categorical/advisory | ADR-0003 kill criterion | Avoid becoming a second prioritization authority. |
| Hold the `src/derive.mjs` import boundary | ADR-0006 | Keep the layer extractable and status/analytics unconflated. |
| Keep GitHub credentials read-only and out of snapshots | MVP security boundary | Goal adapter must not leak secrets into central history. |

## JIG Handoff

- Resolve two `refinement-todo.md` items through ADRs before their slices:
  **Forecast confidence** (minimum date/history evidence for `on_track`/`at_risk`)
  and **Cross-project attention overlay** (smallest central policy). Both declare
  `dependencies: [adr-0006]`.
- Draft the generic GitHub milestone **goal-adapter** spec (`goal@1`), resolving the
  "Generic goal and deadline source" item.
- Draft the **derivation** spec against ADR-0006: `src/derive.mjs` reading
  `readObservationHistory()` for pace, risk, and the attention queue, with a
  terminal-rendering slice extending `src/cli.mjs`. Every slice must touch the
  terminal surface (anti-horizontal-phasing) and keep the derivation import
  boundary.
- Sequence risk-first: goal adapter and pace (buildable now) before the gated
  risk/attention policies.

## Release-Check Criteria

- Across at least three real configured projects, each with one source-owned
  goal/deadline, `npm run scan` shows observed pace, confidence-aware risk
  (missing dates render `unknown`, never `on_track`/`at_risk`), and an explained
  cross-project attention ordering — all derived from central history plus goal
  signals, with no source-repository writes.
- Forecast confidence uses an evidenced rule tested against the real observation
  set; below the threshold the result is `unknown`.
- The attention queue explains its deterministic ordering without requiring
  comparable slice/issue sizes and stays advisory.
- `src/derive.mjs` imports only the history reader and observation-contract helpers
  (ADR-0006 boundary); no secrets enter snapshots; the full test suite is green.

_Last shaped: 2026-08-02_
