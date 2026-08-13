---
slice: 013-03 — curated soft appetite-window (green/amber)
pass: compliance
verdict: pass
reviewer: general-purpose (independent, re-review)
reviewed_at: 2026-08-13T23:48:26Z
prompt_source: review.py implementation
---

## Compliance review (re-review after fix) — PASS

Prior needs-changes blocker (soft over-appetite ranked into attention tier 1 as a hard
alarm) is genuinely resolved: tierOf now returns tier 2 for at_risk+over-appetite BEFORE
the generic at_risk→1 rule; ordering test asserts [hard-miss, soft-appetite, neutral] →
[1,2,3]. Hard at_risk still tier 1; within-appetite still tier 5 (regression-tested).
tierReason emits "over appetite — cutline due", never "deadline unknown". All six ACs hold
(schema $ref'd appetiteWindow; onboarding path-pointer only; within/over-appetite; amber
never red; deadline>appetite>neutral precedence via appetiteAt guard; on-disk-release-doc
no-prose-parse guard). New tests non-vacuous. 496/496 green.
