---
slice: 011-05 — map worktrees/PRs to their milestone
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T18:38:41Z
prompt_source: review.py implementation .../spec.md 011-05 <deliverables>
---

Compliance review of 011-05 — worktree→milestone mapping. VERDICT: pass; 320/320 green (frame-critique-hardened slice).
AC1 two-hop, both hops can miss; set-valued spec→milestone join (one spec → multiple milestone badges). AC2 multi-spec spec-018-019 → both ids, no truncation. False-3-digit-match guard: token-anchored \bspec/\bslice (respec-042, mystifying-poincare-604 don't match). AC5 unassociated bucket shows the encoded spec id on hop-2 miss. AC6 no file paths.
Accepted realization (→ deviation log): hop 1 reads the worktree DIRECTORY NAME (the only field scanWorktreeOnlyDocs exposes), not the branch/PR head ref AC1 names; failure mode is safe (false hop-1 miss → unassociated, never mis-attribution) and matches the live corpus. Reconciliation fixes applied: digit normalization across the join (canonicalSpecId, red-on-revert test); test fixtures re-based to real dir basenames.
