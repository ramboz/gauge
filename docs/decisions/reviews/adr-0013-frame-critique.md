---
adr: 0013
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2nd pass)
reviewed_at: 2026-08-05T18:27:54Z
prompt_source: review.py frame-critique docs/decisions/adr-0013-*.md
---

VERDICT: pass (2nd pass)
First pass needs-changes: (1) tier 2 mis-grounded stale freshness as "collection lapsed" when it is
gitFreshness (source-repo-quiet, a repo-activity proxy); (2) five tiers didn't partition ADR-0012's
reason set (execution-unknown fell through).
Resolved: tiers now key on ADR-0012's DERIVED forecast reason set (per ADR-0006). Tier 2 = forecast
unknown reason `stale-evidence` (source repo quiet -> status old) OR explicit blocker, remedy reframed
to "verify / human look", NOT "re-collect". Context discloses freshness = gitFreshness = repo-activity
proxy, not a collection-lapse signal. Full partition: at_risk->1, stale-evidence->2,
deadline-unknown/scope-changed->3, insufficient-history/execution-unknown->4, on_track->5;
most-urgent-tier-wins first-match. Authority-model + no-false-comparability hold (attention-need tiers,
within-tier by deadline proximity, no owner-ranking input).
Residual (non-blocking, delegated to 009-03): stale-evidence also covers a supported reading with
unknown freshness (missing git metadata), not only a quiet repo; tier semantics hold either way.
