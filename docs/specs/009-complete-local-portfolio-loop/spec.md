---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 009: Complete the local portfolio loop (pull)

> Reserved on 2026-08-05 via `workflow.py new`.

## Overview

The runtime foundation (spec 004), project-shape profiles (spec 007), and the
generic-doc adapter (spec 008) shipped a working **collect → history → basic
card** pipeline on the central-pull model: `npm run collect` observes each
configured project read-only, normalizes to observation-v1, and writes it with
history into central state; `npm start` renders per-project cards. What is still
missing to close the committed MVP's daily portfolio loop
([local-portfolio-loop](../releases/local-portfolio-loop.md)) is everything
*downstream of a raw observation*: a project **goal + deadline**, a
**forecast/risk** read, and a **cross-project attention queue** — none of which
exist yet.

This spec completes that loop **on the pull model**. Specs 005 (authenticated
ingest) and 006 (edge push) — the eventual push topology behind ADR-0007/0008 —
are **DEFERRED** until a hosting/auth trust boundary is warranted; the committed
MVP stays on central pull. Daily scheduling is intentionally **out of scope**:
collection stays manual (`npm run collect`), and automation is a thin follow-up
(the "Daily collection" refinement-todo item).

Two accepted decisions anchor the work:

- **[ADR-0011](../../decisions/adr-0011-goal-deadline-source-strategy.md)** — goal
  and deadline are authored into the per-project profile by a **human-curated
  onboarding step** (surfacing vision/release/README as hints); the zero-dep
  runtime reads only the literal values. GitHub milestone deferred with the
  push/auth work.
- **[ADR-0006](../../decisions/adr-0006-two-layer-derivation.md)** — forecast,
  risk, and the attention queue live in a **history-derived layer**
  (`src/derive.mjs`) that imports only `readObservationHistory()` + observation
  helpers, never the adapters or `src/scan.mjs`, and never writes.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The profile is the goal/deadline home, and it is additive.**
  `schemas/project-profile-v1.schema.json` (verified) declares
  `additionalProperties: false` with no goal/deadline fields today; 009-01
  extends it. ADR-0009's profile is gauge-side instance state, so authoring
  goal/deadline there does not cross the ADR-0005 source/state boundary.
- **History exists but has no runtime consumer.**
  `readObservationHistory(stateDir, projectId)` in `src/state.mjs` (verified)
  returns the per-project observation series sorted by `collectedAt`; ADR-0006
  confirms no runtime code reads it yet. Observed pace therefore needs ≥2
  observations — with fewer, pace (and any forecast depending on it) is
  `unknown`, not a coerced value.
- **Goal/deadline are not in the observation.** The observation-v1 capability
  signals (`repository`, `execution`, `workstreams`, `hygiene`, `narrative` —
  verified in `src/observation.mjs`) carry no goal or deadline; the current-state
  read path (`observeAll` → `/api/data` → `public/index.html`) must join the
  profile's goal/deadline for the card, and the derive layer reads them as input.
- **Two owner-decisions are still open and gate two slices** (see Decomposition):
  the forecast minimum-evidence rule (009-02) and the cross-project
  attention-overlay policy (009-03), both parked in
  [refinement-todo.md](../../refinement-todo.md). Neither blocks 009-01.

## Decomposition

SPIDR analysis. **Not a spike** — ADR-0006 fixes the derivation home and import
rule, ADR-0011 fixes the goal/deadline source; the unknowns are policy calls
(named below), not "how does this work."

The split is **Data → Rules**: 009-01 supplies the missing *input data*
(goal/deadline) end to end; 009-02 and 009-03 layer progressively richer
*derivation rules* (a per-project forecast/risk rule, then a cross-project
ranking rule) over history + goal/deadline. Each slice is vertical and renders
its **own** new signal on the dashboard.

**Presentation is deliberately folded into each slice, not split out.** A
separate "render the dashboard" slice would touch only the interface layer with
no new logic — horizontal phasing, which SPIDR forbids. So 009-01 shows
goal/deadline on the card, 009-02 shows the forecast/risk read, and 009-03 shows
the ranked attention queue. Cohesive layout polish, if it proves warranted after
the three signals land, is a later Interface-axis follow-up — not a precondition.

- **009-01 — Goal/deadline onboarding authoring** (Data). Extend the profile
  schema with goal/deadline + provenance; the onboarding step authors literal
  values (surfacing vision → release → README as hints); the card shows them.
- **009-02 — Forecast/risk derivation** (Rules). New `src/derive.mjs` folds
  history + progress + deadline into `on_track` / `at_risk` / `unknown`
  (conservative, evidence-gated); the card shows the read. *Gated on the
  forecast minimum-evidence decision.*
- **009-03 — Global attention queue** (Rules). Deterministic, explained
  cross-project ordering downstream of forecast/risk in `src/derive.mjs`; the
  dashboard shows the ranked queue. *Gated on the attention-overlay policy
  decision.*

## Slices

- [009-01 — Goal/deadline onboarding authoring](slice-01-goal-deadline-onboarding.md)
- [009-02 — Forecast/risk derivation](slice-02-forecast-risk-derivation.md)
- [009-03 — Global attention queue](slice-03-global-attention-queue.md)
