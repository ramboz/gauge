---
slice: 012-02 — git velocity on the card
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T19:28:27Z
prompt_source: review.py reconciliation .../spec.md 012-02
---

Reconciliation review of 012-02. VERDICT: pass, no issues. Deviation log faithful to landed code (velocityFromTimestamps/gitVelocity/attachVelocity; +1wk --since margin; Math.min off-by-one clamp; single shared nowMs). All three reconciliation fixes real: AC4 test scoped to velocity block (red-on-stub), empty-sparkline strengthened, velocityHeadline shows "< 0.1 commits/wk" for non-null near-zero (pure + card tests). architecture.md /api/data velocity join accurate. Sweep dispositions credible. 337/337 green.
