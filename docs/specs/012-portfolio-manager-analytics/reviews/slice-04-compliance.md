---
slice: 012-04 — token cost: by-activity + by-skill
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T20:17:36Z
prompt_source: review.py implementation .../spec.md 012-04 <deliverables>
---

Compliance review of 012-04 — token cost by-activity + by-skill. VERDICT: pass; 388/388 green.
AC1 by-activity: most-recent-preceding [jig:phase=] tag per session (string + content-block shapes), untagged → explicit unattributed. AC2 by-skill: session→skill join from skill-usage.jsonl, no signal → unattributed. AC3 detail-tier <details>, card face unchanged (labels don't leak above the details boundary; esc'd). AC4 (load-bearing) buckets-sum-to-total: both cuts partition the SAME deduped set + re-price via reused costFromRecords → sum == total (tests, incl mixed known/unknown-model). AC5 unknown → unattributed, never zero.
Reconciliation: architecture.md /api/data updated with tokenCostBreakdown join. 3× transcript read consolidated into projectCostBundle (single read/dedupe, fans out). Import test loosened.
