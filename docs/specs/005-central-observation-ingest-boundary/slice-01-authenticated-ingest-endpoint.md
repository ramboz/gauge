---
status: DEFERRED
dependencies: [adr-0007, adr-0008]
last_verified: 2026-08-03
frame_review: true
arch_review: true
---

## Slice 005-01 — Authenticated observation ingest endpoint

**Goal:** An authorized edge client POSTs a normalized observation for its project
to central; central authenticates it, validates it against observation-v1, stores
the record immutably with a central-owned attribution, and the project's card
reflects the pushed data — with no source-repository access by central.

**DoR:**
- [ADR-0007](../../decisions/adr-0007-invert-collection-central-pull-to-edge-push.md)
  (topology) is accepted after frame critique.
- [ADR-0008](../../decisions/adr-0008-ingest-identity-attestation-freshness.md)
  (identity, attestation, freshness) is accepted after frame critique; the
  baseline credential model (per-project bearer token) and the ingest-attribution
  sidecar shape are fixed.
- The existing `src/state.mjs` immutable-write contract (ADR-0004/0005) and
  `schemas/observation-v1.schema.json` validator are the reuse targets.

**Acceptance Criteria:**

1. **Authenticated ingress.** `POST /api/observations` on the existing server
   accepts a body only from a caller presenting a valid per-project credential
   bound to the target project id; a missing, malformed, or wrong-project
   credential is rejected with a non-revealing error and writes nothing.
2. **Credential behind a verifier seam.** Credential checking is isolated behind a
   small verifier interface (ADR-0008) so CI-provider OIDC or the GitHub App
   identity can replace the baseline token later without changing storage or the
   endpoint contract.
3. **Envelope-level validation only.** The body is validated against
   observation-v1; schema-invalid bodies, unknown project ids, and project/id
   mismatches are rejected. Unknown capability signal types or versions inside a
   valid envelope are stored but uninterpreted (ADR-0007), never a rejection
   reason.
4. **Immutable store, unchanged record.** The accepted observation-v1 record is
   written through the existing central state writer, unmodified — central does not
   inject timing or trust metadata into the producer's record (ADR-0008 option E).
5. **Central ingest-attribution.** A separate central-owned attribution record
   keyed by `recordId` is written alongside, carrying `receivedAt` (server clock),
   `reportedBy` (authenticated project identity), transport, and a hash of the raw
   body. Client-supplied provenance is retained and labelled **attested**, never
   **verified**.
6. **No source access.** Ingest performs no read or write against any source
   repository; the only writes are the observation record and its attribution
   beneath the instance `stateDir`. The pull fallback (`scripts/snapshot.mjs`)
   still functions unchanged.
7. **Visible end to end.** After a successful POST, the project's card renders from
   the pushed record exactly as a pulled record would, with provenance shown as
   reported/attested.
8. **Verification.** `node --test` covers accept/reject on credential validity and
   project binding, envelope validation (valid, schema-invalid, unknown/mismatched
   project, unknown-signal-preserved), immutable unchanged storage, attribution
   contents, and the no-source-access invariant (read-only/before-after fixture).
   The pre-existing suite stays green.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Tests exercise the no-source-access invariant with read-only or
      before/after-tree fixtures.
- [ ] Compliance and craft reviews pass.
- [ ] Architecture review passes (`arch_review: true` — new external trust
      boundary).
- [ ] Security review of the auth path and error surface (no credential or
      portfolio-data leakage in responses, logs, or errors).
- [ ] Deviation log and reconciliation sweep complete; architecture doc gains the
      ingress channel; refinement-todo and status board updated.

**Anti-horizontal-phasing check:** after this slice a real client (or a curl
fixture standing in for one) pushes an observation and the user sees that project's
card update on the dashboard — the ingress is visible end to end, not an unused
endpoint.

**Resolution trigger:** when hosted auth / GitHub-push collection is tackled (the
trust boundary ADR-0007/0008 describe). The committed MVP stays on central pull;
this slice re-opens with that follow-up. See [ADR-0011](../../decisions/adr-0011-goal-deadline-source-strategy.md)
for the pull-model goal/deadline decision that supersedes the near-term need.
