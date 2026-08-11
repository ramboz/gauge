---
slice: 012-02 — git velocity on the card
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T19:25:06Z
prompt_source: review.py implementation .../spec.md 012-02 <deliverables>
---

Compliance review of 012-02 — git velocity on the card. VERDICT: pass; 337/337 green.
AC1 pure velocityFromTimestamps(timestamps, nowMs, windowWeeks) + git wrapper gitVelocity + attachVelocity join. AC2 headline "≈ N commits/wk". AC3 unicode sparkline degrades to '' on empty, no crash. AC4 unknown explicit (null → gray "velocity unknown", never 0-as-healthy). AC5 deterministic given injected nowMs (no bare Date.now() in pure code). AC6 read-only git, timestamps only (no messages/authors).
Reconciliation fixes applied: AC4 unknown test scoped to velocity block (red-on-stub confirmed); empty-sparkline test strengthened; sub-0.1 display honesty ("< 0.1 commits/wk" when non-null perWeek rounds to 0). architecture.md /api/data updated with velocity join.
