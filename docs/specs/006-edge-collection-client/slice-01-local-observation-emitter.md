---
status: DRAFT
dependencies: [adr-0007]
last_verified: 2026-08-03
frame_review: true
---

## Slice 006-01 — Local observation emitter

**Goal:** Run a thin, dependency-light client inside a project's own environment
and get a valid observation-v1 record for that project on stdout (or a file) —
proving the adapter logic runs at the edge and produces exactly the central
contract, before any network is involved.

**DoR:**
- [ADR-0007](../../decisions/adr-0007-invert-collection-central-pull-to-edge-push.md)
  is accepted; the client is dumb-by-contract (collect + emit, no derivation).
- The edge client may reuse the existing adapter/observation code
  (`src/observation.mjs`) as a library or a vendored equivalent, but must stay
  dependency-light per ADR-0001's spirit.
- `schemas/observation-v1.schema.json` is the emitted contract.

**Acceptance Criteria:**

1. **Edge production.** A single command run in a project directory produces one
   observation-v1 record for that project by running the adapters at the edge over
   the local source, with no call to central.
2. **Contract-valid.** The emitted record validates against
   `schemas/observation-v1.schema.json`, including required provenance and
   per-signal freshness, and carries the configured stable project id.
3. **Minimal and targeted.** The emitter collects only the signals the card needs
   (progress, blockers, repository head, and — later, 006-03 — the declared goal);
   it does not embed raw repository contents.
4. **Dumb by contract.** The client computes no forecast, risk, or attention; a
   test asserts the emitted record contains only collected signals, not derived
   portfolio verdicts.
5. **Read-only source.** Emitting writes nothing to the project repository
   (verified by read-only or before/after-tree fixture) and needs no central
   credential.
6. **Graceful degradation.** A project with no optional adapter artifacts still
   emits a valid record with explicit unsupported/unknown signals rather than
   failing.
7. **Dependency-light.** The client adds no runtime dependency, or its footprint is
   explicitly justified and recorded against ADR-0001's spirit.
8. **Verification.** `node --test` covers a valid emit, schema validity, the
   no-derivation assertion, the no-source-write invariant, and the
   no-artifacts/unknown-signal path.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] No-source-write invariant tested with read-only/before-after fixtures.
- [ ] Compliance and craft reviews pass.
- [ ] Deviation log and reconciliation sweep complete; architecture doc records the
      edge emitter and the adapter relocation; status board updated.

**Anti-horizontal-phasing check:** after this slice a user runs the client in a
real repo and sees a complete, valid Gauge observation printed — the edge producer
is real and inspectable, even before it is wired to central.
