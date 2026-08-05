---
slice: 009-02 — Forecast/risk derivation
pass: compliance
verdict: pass
reviewer: general-purpose (compliance, 2nd pass)
reviewed_at: 2026-08-05T18:54:22Z
prompt_source: review.py implementation docs/specs/009-complete-local-portfolio-loop/spec.md 009-02 <deliverables>
---

VERDICT: pass (2nd pass; first was needs-changes on the all-abandoned false-green)
ADR-0012's four gates + colour computation implemented verbatim (calendar-invalid deadline ->
deadline-unknown; scope-move-at-latest -> scope-changed; trailing stable-scope window; >= boundary).
BLOCKER fixed: new denom===0 evidence gate (src/derive.mjs:133) routes all-abandoned scope
(denom 0, done 0, status supported) to unknown/execution-unknown, closing the coerced-green; the whole
stable-scope window being 0 is covered by the single check, mixed denom -> scope-changed. All 195 tests
pass; non-vacuous (revert -> red). AC4 (envelope-not-evidence) and determinism hold.
Reconciliation: log (a) the denom===0 gate + honesty rationale; (b) fractionOf done/denom-over-pct
precision ordering. no-measurable-scope reason deferred to refinement-todo (done).
