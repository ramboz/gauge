---
status: DEFERRED
dependencies: [adr-0008, 006-01, 005-01]
last_verified: 2026-08-03
frame_review: true
arch_review: true
---

## Slice 006-02 — Trigger and authenticated push

**Goal:** A project reports itself to central automatically: an existing hook fires
the client, which emits the observation (006-01) and POSTs it to the ingest
endpoint (005-01) with a per-project credential — so a commit or CI run makes the
project's card appear centrally, with central holding no source access.

**DoR:**
- Slice 006-01 (local emitter) and slice 005-01 (authenticated ingest) are DONE.
- [ADR-0008](../../decisions/adr-0008-ingest-identity-attestation-freshness.md)
  baseline credential model (per-project bearer token) and client-side secret
  handling are accepted.

**Acceptance Criteria:**

1. **Trigger.** The client can be wired to at least one real trigger — a git hook
   (`post-commit`/`post-merge`) or a CI job (`on: push` or scheduled) — documented
   with a copy-in example; the trigger mechanism is not hard-coded to a single
   provider.
2. **Authenticated push.** On trigger the client emits the record and POSTs it to
   `POST /api/observations` with its per-project credential; a successful push is
   confirmed and the project's card reflects it.
3. **Credential hygiene.** The credential is read from an injected secret (env var
   / CI secret), never committed, never logged, and never written into the emitted
   record.
4. **Bounded failure.** A failed push (network, auth, 4xx/5xx) fails visibly and
   locally without blocking the developer's git/CI action beyond a bounded timeout,
   and without writing to the source repository. Retry/backoff behavior is defined
   and tested.
5. **Idempotent enough.** Re-posting the same record is safe (central keys on
   `recordId`); duplicate triggers do not corrupt history.
6. **No source access by central.** The end-to-end path keeps all source reads on
   the edge; central still performs none (re-verified at the boundary).
7. **Verification.** `node --test` (and/or a scripted integration harness against a
   loopback ingest) covers a successful authenticated push, rejection on bad/absent
   credential, the bounded-failure/retry behavior, secret non-leakage, and
   duplicate-post safety.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Integration path exercised against a loopback ingest instance.
- [ ] Compliance and craft reviews pass.
- [ ] Architecture review passes (`arch_review: true` — cross-boundary transport).
- [ ] Security review: credential handling, failure surface, and log/redaction
      review.
- [ ] Deviation log and reconciliation sweep complete; onboarding docs, architecture
      doc, refinement-todo, and status board updated.

**Anti-horizontal-phasing check:** after this slice a developer commits in an
onboarded repo and, without any central scan, sees that project's card refresh on
the dashboard — the full push loop is visible end to end.

**Resolution trigger:** when hosted auth / GitHub-push collection is tackled (the
ADR-0007/0008 trust boundary). The committed MVP stays on central pull; the push
trigger re-opens with that follow-up.
