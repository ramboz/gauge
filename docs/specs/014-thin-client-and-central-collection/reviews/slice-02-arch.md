---
slice: 014-02 — capture-validity hardening: honest RAG on captured history
pass: arch
verdict: pass
reviewer: general-purpose (arch)
reviewed_at: 2026-08-19T03:31:04Z
prompt_source: review.py arch-review
substrate: not-shown
applied_skill: none
---

PASS. ADR-0006 two-layer boundary respected cleanly: deriveForecast stays a pure now-free fold; the "now" clock enters only via the read layer (observeAll stamps collectedAt; server.mjs splices the live obs as the tail). spliceLiveObservation and sameCaptureState are pure; the only I/O deletion is in state.mjs. coalesce is opt-in (default-off), touches only Gauge's own state under stateDir/observations, leaves snapshot/backfill unaffected (ADR-0005 disjointness re-asserted). ADR-0001 respected (dependency-free). Nit (addressed): clock-skew coalesce guard. Forward notes: 014-03 must not read observation record COUNT as a trend signal (coalescing collapses flat runs but preserves every genuine change point); 014-04 must compose with the live-tail splice, not double-append a now endpoint.
