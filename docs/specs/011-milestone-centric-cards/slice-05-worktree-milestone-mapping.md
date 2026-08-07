---
status: DRAFT
dependencies: [011-01, 011-04]
last_verified:
---

## Slice 011-05 — map worktrees/PRs to their milestone

**Goal:** Each worktree/PR is attributed to a **specific milestone** rather than
sitting card-level: an open PR shows as a badge on its milestone, cleanup-worthy
worktrees fold into the ⚠ tooltip, and anything that can't be mapped lands in an
honest "unassociated" bucket — with no file paths anywhere.

**DoR:**
- ✅ 011-01 (milestones exist) and 011-04 (⚠ tooltip is the cleanup home) landed.
- ✅ `scanWorktreeOnlyDocs` already yields per-worktree lifecycle state + `pr`
  (ADR-0015/0016).

**Acceptance Criteria:**

1. **Mapping rule.** A worktree maps to a milestone via
   worktree-branch/resolved-PR → the **spec id(s)** it encodes → the milestone
   whose release references that spec (reusing 011-02's parse). The extraction
   rule (which branch/PR shapes yield a spec id) is documented in the deviation
   log.
2. **Open PR on its milestone.** An in-review worktree with a resolved open PR
   (ADR-0016) renders as a compact PR badge on the milestone it maps to (active
   or a "next" one), not at card level.
3. **Cleanup folds into ⚠.** Stale/forgotten (cleanup-worthy) worktrees appear
   only in the ⚠ tooltip (011-04), attributed to their milestone when mapped.
4. **Unassociated bucket.** A worktree that maps to no milestone (codename
   branch, bug/review checkout, or a repo with no release plan) is surfaced in a
   clearly-labelled "unassociated" affordance — never silently dropped, never
   mis-attributed.
5. **No paths.** No worktree file paths appear anywhere on the card; the worktree
   is identified by its name and (when mapped) its milestone.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Tests cover: branch→spec→milestone happy path, PR-based mapping,
      unmappable → unassociated, cleanup-worthy → ⚠ tooltip, and a fallback
      (no-release-plan) project where everything is unassociated.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] `frame_review` set per `workflow.py frame-review-needed` (this slice
      carries the load-bearing mapping-heuristic assumption).
- [ ] Reviewed (compliance + craft). Deviation log + reconciliation sweep.

### Open question

- The branch→spec extraction rule is deliberately unspecified here beyond "encode
  a spec id"; real branch names vary (`spec-096-…`, `claude/spec-018-019-…`,
  `github-issue-124-…`, codenames). Slice authoring should enumerate the observed
  shapes in the live portfolio and pick the smallest rule that maps the majority,
  leaving the rest unassociated rather than guessing.
