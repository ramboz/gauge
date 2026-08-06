---
slice: 010-01 — entry-level goal/deadline
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T16:57:47Z
prompt_source: review.py pr-review
---

VERDICT: pass

Tightly scoped to the three declared seams; no read/derive-layer change. Single-sourcing is real (validator reads PROFILE_SCHEMA.$defs.*; expandEntries mirrors the existing specsDir/decisionsDir/specLayout entry→profile fallback). Tests non-vacuous; AC4 drives the real join/forecast/attention chain with a time-stable 2099 deadline.

STRENGTHS:
- test/profile.test.mjs:346-359 — single-source test pins $ref wiring from both top-level AND entries[], plus required/pattern parity on $defs objects; closes drift risk.
- src/config.mjs:119-122 — entry→parent fallback uses explicit !== undefined (correct for object fields; the || chain would be wrong) and defers own-property omission to resolvedSingleProfile.
NITS (non-blocking):
- src/profile.mjs:99 — validateGoalOrDeadline(field, entry, …): `entry` param is the goal/deadline object, not an entries[] item; name collides with multi-entry vocabulary. Cosmetic.
- test/config.test.mjs:443-459 — "neither declares" case is a backward-compat identity guard, not a feature test (labeling observation only).

The flagged judgment call (rewriting three 009-01 assertions to schema.$defs.*) is the correct, lossless consequence of single-sourcing; worth a one-line deviation-log note. No coverage lost.
