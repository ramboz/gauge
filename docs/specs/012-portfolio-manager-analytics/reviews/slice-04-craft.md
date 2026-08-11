---
slice: 012-04 — token cost: by-activity + by-skill
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T20:17:36Z
prompt_source: review.py pr-review .../spec.md 012-04 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 012-04. VERDICT: pass. Phase state machine correct (per-session ordering, mid-session switch, before-tag unattributed, content-block shape); reconciliation invariant holds by construction (dedupe-once-partition-reprice, linear pricing); detail-tier XSS-safe (labels esc'd). Non-vacuous branch-specific fixtures.
SPECIFIC ISSUES:
- [nit][impl] 3× transcript read/parse/dedup per request — FIXED: projectCostBundle reads/dedupes once + fans to the three folds; server calls it once per project (regression-guard test that the 3 combinators no longer appear in server.mjs).
- [nit][impl] brittle exact-order import assertion — FIXED (presence-based, consistent with 012-03).
- [nit][impl] null-sessionId records share one bucket key — logged (theoretical; real transcripts carry sessionId).
- [nit][impl] transcript sessionId ↔ skill-log session_id join equivalence untested vs real corpus — logged; safe failure (unattributed) if fields ever diverge.
- [strength][impl] dedupe-once-partition-reprice reuse of dedupeRecords/costFromRecords making the invariant hold by construction; branch-specific non-vacuous fixtures + detail-tier boundary tests.
