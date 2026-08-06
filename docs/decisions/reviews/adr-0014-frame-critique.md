---
adr: 0014
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T19:37:10Z
prompt_source: review.py frame-critique docs/decisions/adr-0014-worktree-hygiene-artifactroot-scoping.md
---

VERDICT: pass

The initial critique flagged that a wholesale merged-worktree skip discarded
untracked at-risk drafts — the exact "would be lost if the worktree is deleted"
files the signal targets. The fix resolves this honestly: scanWorktreeOnlyDocs
no longer blanket-skips merged worktrees; untrackedMdPaths lists untracked .md
files (git status --porcelain --untracked-files=all) and the
`if (wtMerged && !untracked.has(relKey)) continue` guard narrows a merged
worktree to exactly its untracked drafts, while committed docs (recoverable from
mainline history) are skipped. The ADR drops the false "nothing at risk
regardless" claim, states the committed-skip/untracked-surface split plainly,
and concedes the residual limit (committed-but-unmerged content edits are not
caught — path-existence only, AC 002-02), an honest bounding rather than a
hidden gap. Verified against a witnessed red→green regression test.
