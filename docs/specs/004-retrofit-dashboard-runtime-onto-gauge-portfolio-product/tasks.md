# Tasks: Spec 004 runtime retrofit

- [x] Record the observation/history contract, accept its symmetric-isolation
      correction as ADR-0005, and pass both ADR frame critiques.
- [x] Add `schemas/observation-v1.schema.json` and matching runtime validation.
- [x] Normalize `gauge.config.json` plus legacy `dashboard.config.json`.
- [x] Add safe id, state containment, and source-overlap checks.
- [x] Introduce source-neutral observation/capability modules and Jig adapter.
- [x] Preserve Jig progress, workstreams, pins, worktree warnings, and Compass
      legacy reads behind canonical signals.
- [x] Make non-Jig projects render as valid Gauge observations.
- [x] Convert `scripts/snapshot.mjs` to central atomic Gauge collection.
- [x] Update server/API/browser/package/example configuration to Gauge.
- [x] Exercise every AC and no-source-write behavior through TDD.
- [x] Pass compliance, craft, and architecture reviews.
- [x] Reconcile docs, memory, deviations, and status board.
- [x] Pass reconciliation review.
- [ ] Land the slice as DONE.
