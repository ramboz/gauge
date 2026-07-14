# Legacy Compass snapshot migration

ADR-0002's project-local `docs/status/compass-history.jsonl` contract is
superseded by
[ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md).
Gauge history belongs in the private central instance; new integrations must
not add writers to surveyed source repositories.

## Landed compatibility behavior

The optional Jig adapter may read the latest valid line from a project-local
Compass history file as a legacy `narrative@1` candidate. Missing, stale, or
malformed history remains explicit in freshness/errors and never becomes a
healthy default.

`scripts/snapshot.mjs` retains its compatibility filename but is now the
explicit Gauge collector. It rejects the old source-writing flags and writes
validated immutable observations only beneath the configured `stateDir`.
Existing Compass files remain read-only legacy inputs during migration.

## Gauge contract

- `schemas/observation-v1.schema.json` defines the versioned central shape.
- Adapter, signal, candidate, freshness, provenance, and error semantics follow
  ADR-0004 as corrected by ADR-0005.
- Central records live at
  `<stateDir>/observations/<project-id>/<utc-timestamp>-<record-id>.json`.
- Collection refuses unverifiable or overlapping sources and unqualified state
  filesystems before a durable write.
- No Gauge command writes `docs/status/compass-history.jsonl`.

New narrative integrations should implement an adapter candidate rather than
extending the legacy Compass file.
