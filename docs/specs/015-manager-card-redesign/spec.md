---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 015: Manager-card redesign

> Reserved on 2026-08-19 via `workflow.py new`.

## Overview

The manager dashboard's per-project cards render every derived signal in a
stacked column of full-width text blocks with **no layout discipline and no
content curation**. The result, observed in a 2026-08-19 dogfood run, is
"broken": content overflows the card box, each card is a tall column, and the
same releases render twice. Spec 011 added the milestone lead *on top of* the
pre-existing maximal dump instead of replacing it, so the card accreted rather
than tightened.

This spec rebuilds the card to the frozen design reference at
[`docs/specs/012-portfolio-manager-analytics/design/manager-dashboard-mockup.html`](../012-portfolio-manager-analytics/design/manager-dashboard-mockup.html):
a RAG-tinted **callout band**, a **compact single milestone line**, a **flex row
of stat tiles**, **SVG sparklines** (replacing the unicode-block sparklines), and
real **CSS overflow discipline**. It folds in two known defects surfaced in the
same run:

- **#1 (render half) — scope-ambiguous progress.** The progress bar can be
  milestone-scoped while the forecast is project-wide, rendered adjacent with no
  label ([`public/index.html:531`](../../../public/index.html), `barProgress =
  milestoneProgress || progress`, beside the forecast chip at `:544`). The
  *data* half (a stale `committed` release chosen as active milestone) was fixed
  in `docs/releases/local-portfolio-loop.md`; this spec fixes the *render* half
  by labeling the bar's scope.
- **#2 — the workstream dump.** `streams = [...items, ...discoveredItems]`
  ([`public/index.html:501`](../../../public/index.html)) renders every release
  plan as a row (`:587`), and the milestone line *also* lists them in a `Next:`
  clause (`:514`) — releases render twice and all of them dump regardless of
  relevance.

The design-fidelity target is enforced, not eyeballed: each visual slice
extracts the mockup's concrete design values into acceptance criteria and gates
its `DONE` on a **servo `design-eval`** fidelity score against the mockup
(`design_review: true`). This is the "use jig + servo to reach the mocks" loop.

## Assumptions

- **A1 — servo is not yet scaffolded on Gauge.** Probed 2026-08-19: no `.servo/`
  directory and no `oracle.sh` at the repo root. The servo `design-eval` gate
  therefore requires `/servo:scaffold-init` (to install `oracle.sh` + `.servo/`)
  **and** `/servo:design-eval` (to author the frozen fidelity eval against the
  mockup and install a `score_design_fidelity` component) as a prerequisite of
  the first visual slice. This is DoR for 015-01, not in-scope card work.
- **A2 — the mockup is the frozen reference.** `manager-dashboard-mockup.html`
  is treated as the authoritative target composition and design-value source. It
  is illustrative data (its note says so); only its *layout, structure, and CSS
  values* are the contract, never its fabricated figures.
- **A3 — zero runtime dependencies hold (ADR-0001).** The redesign stays
  dependency-free: SVG sparklines are hand-emitted markup, not a charting lib;
  all styling stays inline in `public/index.html`'s `<style>`.
- **A4 — the read layer is unchanged.** This is a pure presentation redesign of
  `public/index.html`. `/api/data`, `src/derive.mjs`, `src/milestone.mjs`, and
  the observation contract are **not** modified. No new data is required — every
  value the new card shows is already on the current `/api/data` payload
  (verified against the live response: `forecast`, `milestone.{active,next}`,
  `velocity`, `tokenCost`, `team`, `velocityTrend`, `costTrend`, execution
  `progress`).

## Decomposition

**SPIDR axis: Interface (I).** This is a single-surface UI redesign
(`public/index.html`); the natural split is by UI increment — minimal
structural foundation first, visual polish later — where **each slice ships a
visibly tighter, still-correct card end-to-end**. No Spike: the mockup is
concrete and the current code is fully read, so nothing is unknown enough to
research first (Spike is the last resort). No Data/Rules split: the data is
fixed and there are no new business rules, only presentation.

Anti-horizontal-phasing: every slice below changes the rendered card a user
sees on `localhost:5111` — none is "wiring for the next slice."

| Slice | Interface increment | Folds |
|-------|--------------------|-------|
| 015-01 | Card shell + overflow discipline + drop the workstream dump | #2 |
| 015-02 | Compact milestone line + progress-scope label | #1 (render) |
| 015-03 | Stat-tile row (velocity · cost · team) | — |
| 015-04 | SVG sparklines replace unicode-block sparklines | — |

Each visual slice carries `design_review: true` and gates on the shared servo
`design-eval` (stood up in 015-01's DoR) — fidelity must not regress slice over
slice.

## Slices

- [015-01 — card shell, overflow discipline, drop the workstream dump](slice-01-card-shell.md)
- [015-02 — compact milestone line + progress-scope label](slice-02-milestone-line.md)
- [015-03 — stat-tile row](slice-03-stat-tiles.md)
- [015-04 — SVG sparklines](slice-04-svg-sparklines.md)
