# Legacy Compass snapshot migration

ADR-0002's project-local `docs/status/compass-history.jsonl` contract is
superseded by
[ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md).
Gauge history belongs in the private central instance; new integrations must
not add writers to surveyed source repositories.

## Current POC behavior

Until [spec 004](specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md)
lands, the inherited scanner can still read the latest valid line from a
project-local Compass history file, and `scripts/snapshot.mjs` can still append
one. Treat both as compatibility behavior for existing POC users, not as the
Gauge integration contract.

Do not wire new Compass or scheduled jobs to write these files. Existing files
may remain read-only legacy adapter inputs during migration.

## Gauge target

The normalized observation/history ADR must define:

- the versioned central observation shape;
- provenance, freshness, error, and schema-evolution semantics;
- how optional narrative signals enter through adapters;
- retention and secret-safety rules;
- an instance-state writer that never targets source projects.

Spec 004 will then remove, disable, or convert `scripts/snapshot.mjs` into a
Gauge-instance writer and provide deterministic migration behavior for legacy
history.
