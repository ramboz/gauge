---
slice: 012-06 — RAG health chip (deadline-gated)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T21:05:39Z
prompt_source: review.py implementation .../spec.md 012-06 public/index.html test/runtime.test.mjs (re-review after gating fix)
---

Compliance review of 012-06 — RAG health chip (RE-REVIEW after the gating fix). VERDICT: pass; 431/431 green.
Prior needs-changes (unconditional ⚠ on green cards) is RESOLVED: forecastCallout gates the ⚠ on band !== 'green' — green renders border + headline only; yellow/red/gray keep ⚠ + reason tooltip. Restores AC3 (⚠ = risk carrier) and 011-04's conditional-⚠ convention. Decisive tests non-vacuous (green→no rag-flag; non-green→has rag-flag; ragCalloutMarkup scopes to the callout).
All 6 ACs hold: AC1 forecastToRag reuses p.forecast (all 10 deriveForecast reasons banded; at_risk yellow/red split documented; unknown/absent→gray never green). AC2 deadline-unknown→gray "needs a deadline set". AC5 ragSortKey on forecastToRag, stable red<yellow<gray<green. AC6 fixture→real deriveForecast→green end-to-end (no fabricated deadline committed). XSS esc'd.
Reconciliation note: 011-04 clean-project test amended (gray = something to report) — intentional convention refinement, log it.
