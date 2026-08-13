---
slice: 013-02 — neutral date-free pace (advancing/stalled)
pass: craft
verdict: pass
reviewer: general-purpose (independent, pr-review rubric)
reviewed_at: 2026-08-13T23:18:33Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

## Craft (pr-review) pass — PASS (no blockers)

deriveForecast restructure is clean: deadline demoted to a post-gate discriminator,
observedPace computed once and shared, single `if (deadlineAt === null)` tier split —
result-tier is obvious. index.html neutral-callout (drop ⚠, keep copy) mirrors green's
treatment. Tests thorough incl. adversarial-id attention ordering. Zero deps.

Nits → reconciliation-log:
1. deadline-unknown branches in tierOf/tierReason now only reachable via standalone
   attentionQueue — add a src comment marking them standalone-only (fixed in reconcile).
2. naming asymmetry advancing/`progressing-no-deadline` — spec-mandated (AC1), noted.
3. neutral-state predicate {advancing,stalled} open-coded in 3 sites across the
   server/client split — accepted (a shared helper is awkward across the boundary).
