---
slice: 011-05 — map worktrees/PRs to their milestone
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T18:44:06Z
prompt_source: review.py reconciliation .../spec.md 011-05
---

Reconciliation review of 011-05 (closes spec 011). VERDICT: pass. Deviation log faithful on every checked point: extraction regexes (token-anchored, multi-spec chaining, slice-suffix normalize), dir-name-vs-branch realization (safe false-miss), set-valued join, and all three reconciliation fixes (canonicalSpecId + red-on-revert test; fixture re-basing; Array.from trim kept where cross-realm deepEqual needs it). CLAUDE.md Hot Cache spec-close hygiene accurate (011 DONE + milestone-card model + src/milestone.mjs join; 012-01 spike DONE, 012-02..06 drafted). 320/320 green.
One suggestion applied post-review: architecture.md /api/data line now names the new referencedSpecs read-layer member (011-05); sweep disposition corrected from no-op → updated (referencedSpecs is new this slice, distinct from 011-02's specProgress).
