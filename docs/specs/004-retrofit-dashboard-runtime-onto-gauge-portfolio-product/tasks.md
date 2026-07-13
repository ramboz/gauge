# Tasks: Spec 004 runtime retrofit

- [x] Record the observation/history contract, accept its symmetric-isolation
      correction as ADR-0005, and pass both ADR frame critiques.
- [ ] Add `schemas/observation-v1.schema.json` and matching runtime validation.
- [ ] Normalize `gauge.config.json` plus legacy `dashboard.config.json`.
- [ ] Add safe id, state containment, and source-overlap checks.
- [ ] Introduce source-neutral observation/capability modules and Jig adapter.
- [ ] Preserve Jig progress, workstreams, pins, worktree warnings, and Compass
      legacy reads behind canonical signals.
- [ ] Make non-Jig projects render as valid Gauge observations.
- [ ] Convert `scripts/snapshot.mjs` to central atomic Gauge collection.
- [ ] Update server/API/browser/package/example configuration to Gauge.
- [ ] Exercise every AC and no-source-write behavior through TDD.
- [ ] Pass compliance, craft, and architecture reviews.
- [ ] Reconcile docs, memory, deviations, and status board.
- [ ] Pass reconciliation review and land the slice as DONE.
