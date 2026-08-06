---
status: Accepted
dependencies: []
last_verified: 2026-08-06
frame_review: true
---

# ADR-0014: Per-project worktree-hygiene scoping

## Status

Accepted (2026-08-06)

## Context

Worktree hygiene (`scanWorktreeOnlyDocs` in `src/scan.mjs`) surfaces documents
that exist only inside an abandoned `.claude/worktrees/*` checkout and would be
lost if the worktree were deleted. Spec 007-01 (reconciliation blocker 1)
deliberately made this signal **repo-root-scoped** rather than
artifactRoot-scoped, on the reasoning that lost-worktree docs are a whole-git-repo
hygiene concern, not a per-sub-project one.

That choice produced misleading output for multi-entry repos (ADR-0009 "Pattern
C", where one config project's `profile.entries` expand into N cards sharing one
repository). Because the same repo-wide list was attached to every entry, the
mystique repo showed an identical worktree-doc warning on both its CWV and
Superpowers cards, and the personalization repo showed the same list on all three
`tracks/*` cards. The owner flagged this as wrong: a worktree should be
attributed to the project it actually touches.

Investigation of the live portfolio also exposed two over-counting classes the
signal had, independent of scoping. First, the comparison baseline was the
primary checkout's *working tree*; when that checkout is parked on a feature
branch, already-merged docs missing from that branch were mislabeled
"worktree-only" (fixed earlier in commit `c6eac77` by comparing against mainline
refs). Second, a fully-merged worktree — one whose HEAD is an ancestor of a
mainline ref — still contributed docs it had merged and that mainline later
deleted or moved (e.g. mystique `strange-zhukovsky`: merged, 0 commits ahead, yet
125 docs flagged), because the mainline *current tree* no longer held them.

## Decision Options Considered

### Option A: Keep repo-root scoping (status quo, per spec 007-01)
- **Pros:** No change; matches the original "whole-repo hygiene" framing.
- **Cons:** Every entry card of a multi-entry repo shows the same list; the owner
  judged this actively misleading. Does not address merged-worktree over-counting.

### Option B: Scope per artifactRoot, drop docs under no entry's root
- **Pros:** Each card lists only worktree docs under its own `artifactRoot`, so a
  worktree appears on a project only when it touches that project. Matches the
  owner's mental model ("list worktrees that touch this one project"). Falls out
  naturally from walking the entry's subtree and restricting the mainline
  baseline to it.
- **Cons:** Docs under no entry's artifactRoot (repo-level `docs/blackboard/…` in
  a `tracks/`-based repo) appear on no card and become invisible.

### Option C: Scope per artifactRoot, but keep unscoped docs on every entry card
- **Pros:** Nothing at-risk is hidden.
- **Cons:** Reintroduces the exact duplication the owner objected to, for the
  unscoped remainder.

### Option D: Scope per artifactRoot, attribute unscoped docs to the first entry
- **Pros:** Nothing hidden; each unscoped doc surfaces exactly once.
- **Cons:** The attribution is arbitrary — a doc unrelated to the first entry
  shows up under it, which is its own kind of misleading.

## Recommended Decision

Adopt **Option B**. `scanWorktreeOnlyDocs` is scoped to the project's
`artifactRoot`: it walks only that subtree inside each worktree checkout, and
compares against a mainline baseline restricted to the same subtree. A doc is
listed only on the card whose `artifactRoot` prefix contains it; docs under no
entry's root are dropped (the owner accepted their invisibility as the price of
removing the duplication). This **reverses spec 007-01's repo-root exception**.

Bundled with it, correctness rules keep the list to genuinely at-risk docs. A
**fully-merged worktree's committed docs are skipped** — its HEAD is already an
ancestor of a mainline ref, so those docs are recoverable from mainline history
even if mainline later deleted them — **but its untracked drafts are still
surfaced**, because a `.md` file that was never committed exists nowhere in git
and is genuinely lost if the worktree is removed (the merge check inspects HEAD,
which says nothing about untracked files). The mainline baseline is the union of
local + remote default branches (`main`/`master`/`origin/*` plus whatever
`origin/HEAD` targets). A `rev-parse --show-toplevel` guard limits all of this to
a project that is itself a git repo's top level, so a project nested inside
another repo (and the test fixtures) degrade to a working-tree-only comparison
instead of resolving the outer repo.

The core scoping + merged-skip landed in commit `128e351` (`fix(scan): scope
worktree hygiene per artifactRoot and skip merged worktrees`), building on
`c6eac77` (mainline-ref baseline) and `e5d2bb8` (the worktree-grouped UI). The
untracked-draft refinement above lands in the commit that carries this ADR.

## Consequences

**Becomes easier:**
- Multi-entry repos read honestly: each project card shows only the worktree
  docs it owns. Real-world effect — mystique CWV 149→13, Superpowers →0;
  personalization `tracks/*` →0 (their at-risk docs live under `docs/`, outside
  any `tracks/` root); jig unchanged at 22.
- Counts reflect genuinely at-risk docs: stale, already-merged worktrees no
  longer inflate any card.

**Becomes harder:**
- Repo-level docs under no entry's `artifactRoot` are no longer surfaced
  anywhere. A multi-entry repo that keeps at-risk docs outside every entry root
  will not warn about them. Revisit (Option C/D, or a repo-level bucket card) if
  that blind spot bites.
- The signal now issues a few `git` calls per worktree (HEAD resolution,
  ancestor check, and — for merged worktrees — an untracked-file listing);
  negligible at portfolio scale but no longer pure filesystem.
- Merged-worktree coverage is limited to *untracked* drafts. A committed-but-
  unmerged modification to a doc that already exists on mainline is not
  surfaced, since the signal is path-existence only, never content diffing
  (AC 002-02).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- The real-world counts (mystique CWV 149→13, Superpowers/tracks →0) were
  produced by running the landed `scanProject` against the actual repos, not
  estimated.
- Verified against `src/scan.mjs` at commit `128e351` and its regression tests
  in `test/scan.test.mjs` (merged-skip and artifactRoot-scoping cases, each
  witnessed red→green).

## Kill criteria

- If dropping unscoped repo-level docs causes a real at-risk doc to be lost
  unnoticed in a multi-entry repo, revert to Option C (keep unscoped docs on
  every card) or add a repo-level bucket.
- If the per-worktree `git` calls become a measurable cost at larger portfolio
  scale, cache mainline refs / ancestor results per repo across entries.

## Open questions

None.
