---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 013: Date-independent forecast

> Implements [ADR-0018: Date-independent forecast for appetite-shaped work](../../decisions/adr-0018-date-independent-forecast.md)
> (Accepted 2026-08-13).

## Overview

The portfolio is **appetite-shaped, not date-driven**, so ADR-0012's deadline
gate collapses every card to grey `unknown (deadline-unknown)`. ADR-0018 decided a
**tiered forecast-confidence model** to fix this honestly, and this spec builds it.

Two things must land, in order:

1. **History exists.** A live snapshot has one observation per project, so even a
   deadline-bearing project (gauge, deadline 2026-08-28) reads
   `unknown (insufficient-history)`. But `progress(t)` is fully reconstructable
   from git — the **git-backfill seed**. Once it runs, the existing deadline
   forecast (tier 1) lights up on real history with **no forecast-logic change**.
2. **The dateless tiers.** On that history, add the two ADR-0018 states that need
   no concrete deadline: the **neutral date-free pace** floor (tier 3:
   `advancing`/`stalled`, no colour, no attention re-tiering) and the **curated
   soft appetite-window** (tier 2: a user-authored absolute soft target →
   green/amber `over-appetite`, curated at onboarding so the runtime never parses
   prose).

Honesty invariants carried from ADR-0018 (each a slice-level AC):
- A **hard** green/red requires a committed deadline (tier 1 stays the sole source).
- A **soft** green/amber requires a committed appetite-window (tier 2).
- With no committed target, the read is neutral (motion only) or `unknown` — never
  a coerced colour, never a coerced attention rank.
- **No tier parses source prose at runtime** (ADR-0011). Appetite comprehension is
  author-time only.

## Assumptions

<!-- Risk-gated per ADR-0020 §1–§2. -->

- **`progress(t)` is reconstructable from git for a jig project** — verified: an
  uncommitted throwaway reconstruction (spec-level `progressOf` over
  `docs/specs/*/spec.md` `status:` frontmatter, one commit per day) produced usable
  series for jig/gauge/servo/shaper (see ADR-0018 Context table). Slice 01 makes
  this a tested, in-repo deliverable that must reproduce the shape (history gate
  dissolves; 31–71% pace-eligible; gauge naive −0.60 vs in-window +3.73 pct/day).
- **`forecastToRag` renders any unrecognized state gray** (`public/index.html`
  ~386–390, verified in ADR-0018) — so the neutral tier-3 states need no RAG change,
  and `over-appetite` needs only a `RAG_YELLOW_REASONS` entry for amber.
- **`deriveForecast` gate order and stable-window logic** are as ADR-0018 probed
  (`src/derive.mjs`: Gate 1 at 81–83, pace history-only at 137–142, Gate 4
  `DENOM_TOLERANCE=0` at 98–115).
- **Observation-v1 can carry a backfilled snapshot** with honest provenance/freshness
  marking it reconstructed-from-git, not live-collected — to be verified against
  `schemas/observation-v1.schema.json` and `src/state.mjs` write path in slice 01.

## Decomposition

**SPIDR — split by Data then Rules; the backfill is the Data enabler, made
vertical by lighting tier-1 RAG on its own.** No Spike: ADR-0018's feasibility
spike already ran (the reconstruction), so each slice ships behavior, not research.

- **013-01 (Data):** git-backfill seed → deadline forecast/RAG lights on real
  history. Vertical: a deadline-bearing card goes from `unknown` to a real
  `on_track`/`at_risk`.
- **013-02 (Rules):** neutral date-free pace (tier 3) → dateless cards show a
  neutral `advancing`/`stalled` annotation; no colour, no attention re-tiering.
- **013-03 (Rules + Data):** curated soft appetite-window (tier 2) → a project with
  an authored soft target shows green/amber; onboarding curates it (no runtime
  prose parsing).

Each slice is end-to-end (reconstruction/derivation → `/api/data` join → card),
mirrors the existing read-layer-join shape (`attachForecasts`/`attachMilestones`),
and adds tests.

## Slices

- [013-01 — git-backfill seed lights the deadline forecast](slice-01-git-backfill-seed.md)
- [013-02 — neutral date-free pace (advancing/stalled)](slice-02-neutral-date-free-pace.md)
- [013-03 — curated soft appetite-window (green/amber)](slice-03-curated-appetite-window.md)
