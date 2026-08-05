---
adr: 0012
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2nd pass)
reviewed_at: 2026-08-05T18:18:43Z
prompt_source: review.py frame-critique docs/decisions/adr-0012-*.md
---

VERDICT: pass (2nd pass)
First pass needs-changes: (1) primary — done/denom fraction not comparable point-to-point (moving
denominator; scope shaped/deferred/abandoned continuously), and the naive "regression => at_risk"
mitigation manufactured a false at_risk (a colour) for a healthy project that shaped specs, violating
the honesty rule; (2) secondary — gate-2 freshness is git-commit recency (gitFreshness), a
repository-activity proxy, not progress-evidence recency.
Resolved: added Gate 4 (stable comparability basis) routing a materially-changed denom to unknown
(scope-changed), never a colour; removed the wrong mitigation; computation notes observedPace<=0 =>
at_risk is only reached after Gate 4 excludes scope churn; scope-changed added to reasons; Context +
gate 2 now disclose freshness = repository-activity recency (rejects stale evidence, does not certify
progress changed; gates 3-4 supply delivery movement).
Residual (non-blocking, ADR owns it): full-window pace + Gate 4 makes colours reachable mainly for
frozen-scope windows, so active projects read unknown. Carried to 009-02 as the load-bearing
pace-window decision (full-series vs recent-window) — sharpened in Open Questions.
Deviation to log: revision added a fourth gate + a new reason string (shape change in response to
review, not a numbers tune).
