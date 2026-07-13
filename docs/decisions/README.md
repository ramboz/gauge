# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for project-dashboard. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: (untitled)](adr-0001-runtime-zero-deps.md) — The dashboard is a local, single-user tool that must outlive framework churn and never block on a broken install. ((unknown))
- [ADR-0002: (untitled)](adr-0002-compass-snapshot-contract.md) — Compass is deliberately read-only: it reports in chat and persists nothing, so "what did compass say last" has no data source. ((unknown))
- [ADR-0003: Reframe project-dashboard onto Gauge portfolio product](adr-0003-reframe-onto-gauge-portfolio-product.md) — The fork began as `project-dashboard`: a local, zero-dependency viewer over Jig-managed projects. (2026-07-13, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
