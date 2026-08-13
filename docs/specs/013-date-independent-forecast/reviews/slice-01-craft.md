---
slice: 013-01 — git-backfill seed lights the deadline forecast
pass: craft
verdict: pass
reviewer: general-purpose (independent, pr-review rubric)
reviewed_at: 2026-08-13T22:52:16Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

## Craft (pr-review) pass — PASS (no blockers)

Well-crafted and idiomatic: pure reconstruction fold split from thin git I/O (mirrors
velocity.mjs); reuses progressOf/normStatus/gitFreshness verbatim (no vocabulary drift);
thorough honesty markers; read-only-against-sources airtight; deterministic
UUID-v4-from-sha idempotency; behavior-level tests (real pace path + churning-denom
abstention). No blockers.

Nits → reconciliation-log items:
1. DEFAULT_BACKFILL_CADENCE_DAYS exported+asserted but unwired (decorative "tunable").
2. "UTC day" comment inaccurate — bucketing is commit-local-offset day.
3. parseArgs + CLI scaffold now duplicated across snapshot/onboard/backfill — crosses the
   ADR-0002 third-caller threshold; extraction candidate.
4. gitOut swallows all errors to '' — misconfigured/non-repo path silently yields 0 points.
5. Idempotency coupled to state.mjs raw EEXIST bubbling up.
Plus: no dedicated end-to-end "stale latest ⇒ still unknown after backfill" test (Gate 2
covered in derive suite; single-observation stale case covered at test:144).
