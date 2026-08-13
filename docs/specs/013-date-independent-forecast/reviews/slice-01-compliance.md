---
slice: 013-01 — git-backfill seed lights the deadline forecast
pass: compliance
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-13T22:52:16Z
prompt_source: review.py implementation
---

## Compliance (implementation) review — PASS

All five ACs met by src/backfill.mjs + scripts/backfill.mjs, exercised by non-vacuous
tests against a real fixture git repo (443/443 green). Key invariants confirmed by the
reviewer: deriveForecast/lib.mjs/state.mjs/observation.mjs/schema byte-identical to main
(slice adds only new files + a package.json script); backfill observations validate
against observation-v1 and are honestly marked (adapterId 'git-backfill', freshness.reason
'reconstructed-from-git', state via unmodified gitFreshness); git access read-only;
churning denom → unknown('scope-changed'); idempotent (deterministic UUID-v4-from-sha,
EEXIST→created:false); zero new runtime deps.

Reconciliation notes (not blockers):
- Reconstruction sources status via whole-file `^status:` grep, not a frontmatter parse —
  mirrors progressOf/normStatus vocabulary but could diverge if a spec BODY ever carried a
  line-start `status:` (verified absent in current corpus). Known limitation.
- AC3 verified at the deriveForecast layer with fixture observations, not through a live
  /api/data render; owner-facing check remains the manual "open the dashboard" step.
- Idempotency key is per-sha, not per-calendar-day (intended).
