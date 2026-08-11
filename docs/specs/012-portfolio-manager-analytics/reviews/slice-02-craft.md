---
slice: 012-02 — git velocity on the card
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T19:25:07Z
prompt_source: review.py pr-review .../spec.md 012-02 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 012-02. VERDICT: pass. Bucket math correct (Math.min(windowWeeks-1,weeksAgo) boundary clamp); sparkline XSS-safe (fixed block-glyph alphabet + esc); git-fetch failure → null via no-shell execFileSync; clean pure/IO separation mirroring milestone.mjs/derive.mjs; injected-clock determinism.
SPECIFIC ISSUES (addressed/logged):
- [nit][impl] AC4 unknown card test partially vacuous — FIXED (scoped to velocity block, red-on-stub).
- [nit][impl] empty-sparkline test only doesNotThrow — FIXED (asserts headline + empty spark).
- [nit][impl] perWeek rounds to 0.0 at large windows (0-as-healthy shape) — FIXED (velocityHeadline shows "< 0.1 commits/wk" for non-null near-zero; test added).
- [nit][impl] sync execFileSync git per /api/data request — accepted (consistent with attachForecasts pattern); maxBuffer edge → unknown noted.
- [nit][impl] sparkline span aria-hidden so title dead for AT — minor (numeric headline carries the signal).
- [strength][impl] --since +1wk margin + authoritative fold; double-safe sparkline; single shared nowMs.
