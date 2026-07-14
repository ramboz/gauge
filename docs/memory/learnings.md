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

## Containment is directional at the write boundary

Symmetric source/state overlap detection is necessary but not sufficient for a
write destination. Every created state component and concrete temporary/final
record path must also prove directional containment beneath the state root, and
the actual record directory—not only its ancestor—must pass the filesystem
capability probe.

## Schema runtime and reader gates move together

A canonical schema alone does not keep callers safe. Runtime validation must
derive shared constraints from it, adapters must isolate malformed or non-JSON
values, composition must preserve capability versions, and each reader must
gate on the exact type/version it understands. Add adversarial parity tests at
all four boundaries.
