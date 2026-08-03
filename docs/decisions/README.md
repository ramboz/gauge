# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for Gauge. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: Runtime — Node >= 18, ESM, zero runtime dependencies](adr-0001-runtime-zero-deps.md) — Accepted 2026-07-13; reaffirmed by ADR-0003.
- [ADR-0002: Compass snapshot contract](adr-0002-compass-snapshot-contract.md) — Superseded by ADR-0003 on 2026-07-13; retained as POC history and migration context.
- [ADR-0003: Reframe project-dashboard onto Gauge portfolio product](adr-0003-reframe-onto-gauge-portfolio-product.md) — The fork began as `project-dashboard`: a local, zero-dependency viewer over Jig-managed projects. (2026-07-13, Accepted)
- [ADR-0004: Central observation and history contract](adr-0004-central-observation-history-contract.md) — Gauge must separate source-owned project state from the private portfolio history it derives. (2026-07-13, Superseded)
- [ADR-0005: Symmetric source and state isolation](adr-0005-symmetric-source-state-isolation.md) — Accepted ADR-0004 requires Gauge to reject a `stateDir` nested inside a configured source project, but its rule is one-directional. (2026-07-13, Accepted)
- [ADR-0006: Single instance, two-layer derivation](adr-0006-two-layer-derivation.md) — Status/progress reporting and cross-project analytics are two read layers (current-state and history-derived) over one shared observation/history substrate, not two products. (2026-08-02, Accepted)
- [ADR-0007: Invert collection from central pull to edge push for the team tier](adr-0007-invert-collection-central-pull-to-edge-push.md) — The single-user MVP collects by central pull; the team tier inverts to edge-push clients that emit observation-v1 to an authenticated ingest, keeping the observation contract as the invariant seam and derivation central. (2026-08-02, Accepted 2026-08-03)
- [ADR-0008: Ingest identity, attestation, and freshness-aging contract for pushed observations](adr-0008-ingest-identity-attestation-freshness.md) — Resolves ADR-0007's open push-path questions: per-project bearer-token identity behind a verifier seam, a central ingest-attribution sidecar that keeps records immutable and provenance attested-not-verified, and degrade-only server-side freshness aging homed in the current-state read layer. Owner confirmed the token baseline. (2026-08-03, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
