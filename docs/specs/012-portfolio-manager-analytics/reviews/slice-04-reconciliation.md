---
slice: 012-04 — token cost: by-activity + by-skill
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T20:20:52Z
prompt_source: review.py reconciliation .../spec.md 012-04
---

Reconciliation review of 012-04. VERDICT: pass. Deviation log faithful: projectCostBundle reads/dedupes transcripts once + reads skill-usage once, fans to the three folds; server.mjs calls it once per project (regression-guard test that the 3 old combinators no longer appear in server.mjs); reconciliation invariant holds post-refactor (both cuts sum to tokenCost.totalUsd); import assertions loosened to presence-based; detail-tier <details> render, card face unchanged, labels esc'd. architecture.md /api/data tokenCostBreakdown join accurate. Sweep dispositions credible. 388/388 green.
