---
slice: 011-05 — map worktrees/PRs to their milestone
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T18:38:41Z
prompt_source: review.py pr-review .../spec.md 011-05 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 011-05. VERDICT: pass. Two-hop join clean + correct; extractBranchSpecIds token-anchored + multi-spec chaining, no truncation; all render paths esc()'d, no path leaks; worktreeMilestoneMap is one pure DOM-free join reused by worktreeInfo + cleanupWarningLines (collapses a prior slice's duplicated grouping).
SPECIFIC ISSUES (nits → addressed/logged):
- [nit][impl] \d{3} (hop1) vs \d+ (hop2) join asymmetry — latent badge-drop if a release wrote unpadded ids. FIXED in reconciliation: canonicalSpecId normalizes both sides at the comparison; unpadded-join test added (red-on-revert confirmed).
- [nit][impl] claude/-prefixed slash-bearing test fixtures didn't match the real slashless dir-basename shape. FIXED: fixtures re-based.
- [nit][impl] redundant Array.from wrappers. FIXED where safe (kept where cross-realm deepEqual needs it).
- [nit][impl] set-valued cleanup → one ⚠ line per milestone (density) — accepted as "badge on each", logged.
- [strength][impl] hop-2 reuses server-attached referencedSpecs (single source of truth across trust boundary); token-anchored false-match guard pinned by negative tests.
