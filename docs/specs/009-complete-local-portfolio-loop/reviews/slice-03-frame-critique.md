---
slice: 009-03 — Global attention queue
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique)
reviewed_at: 2026-08-05T19:06:11Z
prompt_source: review.py frame-critique docs/specs/009-complete-local-portfolio-loop/spec.md 009-03 <slice>
---

VERDICT: pass (1st round)
Load-bearing assumption verified TRUE against landed 009-02: attachForecasts attaches .forecast={state,
reason} onto each project entry that already carries project.deadline.value + narrative blocker, so a
pure sort added to derive.mjs reaches all three inputs importing nothing (ADR-0006 boundary holds). Tier
partition total against the real deriveForecast reason set. The sparse-collection "everything unknown"
objection is exactly what tiering by WHY-unknown mitigates.
Non-blocking notes folded into the slice pre-implementation: (1) AC1 wording tightened — "does not
re-derive from raw progress/freshness"; blocker is the one ADR-0013-admitted raw field; (2) handle an
entirely-omitted deadline field as unknown (sorts last); (3) blocker path near-vestigial (Compass
retired) so tier 2 rests on stale-evidence for modern jig projects, DoD tier coverage is fixture-driven;
(4) known inherited edge: execution-unknown overloads the denom===0 all-abandoned case into tier 4
(fix = deferred no-measurable-scope reason). Implement current reason set as-is.
