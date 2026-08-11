---
slice: 012-06 — RAG health chip (deadline-gated)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T21:05:39Z
prompt_source: review.py pr-review .../spec.md 012-06 public/index.html test/runtime.test.mjs --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 012-06. VERDICT: pass. Mapping complete + honest against deriveForecast's full 10-reason set (no at_risk fall-through; unknown/future→red safer default); single source of truth (ragSortKey builds on forecastToRag; headline + tooltip share one reason phrase); XSS-safe (esc in headline/title/aria-label); not color-only (reason phrase carries meaning, ⚠ keyboard-reachable); AC6 test runs the real deriveForecast pipeline.
SPECIFIC ISSUES (nits → deviation log):
- [nit][impl] grid-level worst-first sort in load() has no rendered-order test (AC5 carve-out; ragSortKey itself unit-tested).
- [nit][impl] cleanProject fixture has no forecast → models a gray card; adding an on_track forecast would model the real green path.
- [nit][impl] ragCalloutMarkup test regex assumes no nested <div> in the callout — latent brittleness, documented.
- [strength][impl] complete/documented reason banding; single-source sort; real-pipeline AC6; green correctly omits ⚠.
