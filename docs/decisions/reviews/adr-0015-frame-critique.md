---
adr: 0015
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T21:27:18Z
prompt_source: review.py frame-critique docs/decisions/adr-0015-worktree-lifecycle-state-local-pr-proxy.md
---

VERDICT: pass

Initial critique: applying recency only to non-pushed worktrees meant the
"forgotten/cleanup" bucket could structurally only catch never-pushed work,
while a pushed-then-abandoned worktree (remote ref lingering after a merged/
closed PR) masqueraded as an open PR. Resolved: worktreeRecency now computes
active/stale/unknown for every doc-bearing worktree with no pushed short-circuit,
and each doc carries an orthogonal {state, pushed}; a pushed-then-abandoned
worktree yields {state:'stale', pushed:true} (asserted in the "orthogonal pushed
flag" test) and the UI routes it to the top-ranked "pushed but quiet — likely a
merged/closed PR" group. The ADR's 2x2 table and the honest residual note (a
recent pushed-but-never-PR'd branch still reads "in review") faithfully describe
the implementation; that residual is the disclosed, irreducible cost of staying
offline, not the cleanup blind spot originally flagged.
