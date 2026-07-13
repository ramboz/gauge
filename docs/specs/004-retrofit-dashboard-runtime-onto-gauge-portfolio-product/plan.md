# Plan: Spec 004 runtime retrofit

## Slice 004-01

1. Lock the versioned observation envelope and immutable instance-history
   contract in ADR-0004 and add a JSON Schema artifact.
2. Test-drive configuration normalization, safe project ids, explicit state
   roots, legacy migration warnings, and source/state overlap refusal.
3. Test-drive source-neutral observations plus repository, execution,
   workstream, hygiene, and narrative capabilities; keep Jig behind an adapter
   and make non-Jig projects first-class observations.
4. Test-drive atomic central history records and convert `snapshot.mjs` into an
   explicit Gauge collector that never writes to source projects.
5. Move the HTTP API and browser card to canonical signals, rename runtime
   identity to Gauge, and retain the POC's useful Jig behaviors.
6. Run the full suite and Jig compliance, craft, architecture, and
   reconciliation gates; reconcile live docs and memory before DONE.

## Risk order

- Prove no-source-write containment before enabling durable collection.
- Prove the non-Jig observation/card path before treating the adapter boundary
  as source-neutral.
- Prove the atomic record protocol on the runtime test filesystem before
  claiming central history.
