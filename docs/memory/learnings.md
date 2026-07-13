# Learnings

> Status: Draft (wizard-generated)
>
> Dead ends, failed approaches, and "we tried X and here's why it didn't work."
> The institutional memory that ADRs don't capture — these are not decisions,
> they're anti-patterns and gotchas discovered in practice.
>
> Update via `/jig:memory-sync` during reconciliation.

<!-- Learnings below. Format: ## Title, followed by what happened and what to do instead. -->

## Ignored runtime-state fixtures need explicit exceptions (Bug 001)

The worktree-warning regression test expected a synthetic document below a
fixture `.claude/` directory, but the repository-wide production ignore kept
that document out of Git. The test therefore passed only when equivalent local
state happened to exist. Preserve the broad runtime-state ignore and add a
narrow fixture-path exception; use `git check-ignore` plus `git ls-tree` to
verify that the intended fixture is actually versioned.
