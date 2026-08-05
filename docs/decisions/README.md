# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for Gauge. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: (untitled)](adr-0001-runtime-zero-deps.md) — The dashboard is a local, single-user tool that must outlive framework churn and never block on a broken install. ((unknown))
- [ADR-0002: (untitled)](adr-0002-compass-snapshot-contract.md) — Compass is deliberately read-only: it reports in chat and persists nothing, so "what did compass say last" has no data source. ((unknown))
- [ADR-0003: Reframe project-dashboard onto Gauge portfolio product](adr-0003-reframe-onto-gauge-portfolio-product.md) — The fork began as `project-dashboard`: a local, zero-dependency viewer over Jig-managed projects. (2026-07-13, Accepted)
- [ADR-0004: Central observation and history contract](adr-0004-central-observation-history-contract.md) — Gauge must separate source-owned project state from the private portfolio history it derives. (2026-07-13, Superseded)
- [ADR-0005: Symmetric source and state isolation](adr-0005-symmetric-source-state-isolation.md) — Accepted ADR-0004 requires Gauge to reject a `stateDir` nested inside a configured source project, but its rule is one-directional. (2026-07-13, Accepted)
- [ADR-0006: Single instance, two-layer derivation (current-state and history-derived)](adr-0006-two-layer-derivation.md) — ADR-0003 places both per-project status/progress reporting and cross-project analytics (observed pace, deadline confidence, categorical risk, attention ranking) on Gauge's side of the authority boundary. (2026-08-02, Accepted)
- [ADR-0007: Invert collection from central pull to edge push for the team tier](adr-0007-invert-collection-central-pull-to-edge-push.md) — The shipped runtime collects by **central pull**. (2026-08-03, Accepted)
- [ADR-0008: Ingest identity, attestation, and freshness-aging contract for pushed observations](adr-0008-ingest-identity-attestation-freshness.md) — ADR-0007 fixes the push topology — edge clients push observation-v1 to an authenticated central ingest, pull remains the fallback, and derivation stays central — but leaves three decisions open that any ingest slice must settle before it can be built. (2026-08-03, Accepted)
- [ADR-0009: Project-shape profile contract — location, precedence, and one-repo→N-entries](adr-0009-project-shape-profile-contract.md) — Gauge's Jig adapter hardcodes the artifact layout to `<repoRoot>/docs/{specs,bugs,decisions,releases}` and assumes **one repository is one portfolio entry**. (2026-08-03, Accepted)
- [ADR-0010: Convention-generic doc adapter — jig layout becomes a preset](adr-0010-generic-doc-adapter.md) — Gauge's one adapter hardcodes jig's folder-per-spec convention as if it were the generic notion of a spec, so projects with a valid non-jig spec layout observe as blank. (2026-08-03, Accepted)
- [ADR-0011: Goal and deadline source strategy for the local pull loop](adr-0011-goal-deadline-source-strategy.md) — The local pull MVP still lacks the input every downstream layer depends on: a per-project **goal** and **deadline**. (2026-08-05, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
