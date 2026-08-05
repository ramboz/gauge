---
slice: 009-02 — Forecast/risk derivation
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2nd pass)
reviewed_at: 2026-08-05T18:29:07Z
prompt_source: review.py frame-critique docs/specs/009-complete-local-portfolio-loop/spec.md 009-02 <slice>
---

VERDICT: pass (2nd pass)
First pass needs-changes: (1) pace-window mandated by ADR-0012 was checked in DoR but never stated;
(2) deadline must be a caller-passed parameter to derive.mjs, not read by it (import boundary).
Resolved: (1) DoR/AC2a/Assumptions state the trailing stable-scope window (deterministic; recorded as
resolving ADR-0012's open question); brittle edges err toward unknown; (2) deadline is a caller-supplied
argument, derive.mjs imports no config/profile — grounded against joinProjectProfileFields.
Non-blocking notes folded in: edge reason precedence stated (scope-move-at-latest -> scope-changed;
insufficient-history reserved for genuinely <2 supported obs or <1-day trailing run); the redundant
stale open-question DoR bullet removed.
