# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for Gauge. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: Runtime — Node >= 18, ESM, zero runtime dependencies](adr-0001-runtime-zero-deps.md) — Accepted 2026-07-13; reaffirmed by ADR-0003.
- [ADR-0002: Compass snapshot contract](adr-0002-compass-snapshot-contract.md) — Superseded by ADR-0003 on 2026-07-13; retained as POC history and migration context.
- [ADR-0003: Reframe project-dashboard onto Gauge portfolio product](adr-0003-reframe-onto-gauge-portfolio-product.md) — The fork began as `project-dashboard`: a local, zero-dependency viewer over Jig-managed projects. (2026-07-13, Accepted)
- [ADR-0004: Central observation and history contract](adr-0004-central-observation-history-contract.md) — Gauge must separate source-owned project state from the private portfolio history it derives. (2026-07-13, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
