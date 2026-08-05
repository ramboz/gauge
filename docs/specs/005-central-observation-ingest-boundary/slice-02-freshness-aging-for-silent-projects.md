---
status: DEFERRED
dependencies: [adr-0006, adr-0008, 005-01]
last_verified: 2026-08-03
frame_review: true
arch_review: true
---

## Slice 005-02 — Freshness aging for silent projects

**Goal:** A project that stops pushing decays on the dashboard from `fresh` to
`stale` to `unknown` on central's own clock, so silence never renders as healthy —
closing the freshness gap the push model introduces relative to pull.

**DoR:**
- Slice 005-01 is DONE: pushed records store an ingest-attribution with
  `receivedAt` (server clock).
- [ADR-0008](../../decisions/adr-0008-ingest-identity-attestation-freshness.md)
  freshness decision (degrade-only aging, homed in the current-state read layer)
  is accepted.
- The current-state read layer (`observeAll`, ADR-0006) is the placement target;
  this slice does not touch adapters, `scripts/snapshot.mjs`, or the
  history-derived layer.

**Acceptance Criteria:**

1. **Central aging derivation.** The current-state read layer derives an effective
   freshness for each project from `receivedAt` vs. now against a configured
   last-seen window, independent of what the producer claimed.
2. **Degrade-only.** Central aging may only lower freshness
   (`fresh`→`stale`→`unknown`), never raise it. The rendered card takes the worse
   of producer freshness (source-vs-collection) and central aging
   (collection-vs-now); neither is discarded.
3. **Never healthy from silence.** A project with no record inside the window
   renders `stale`, and one well beyond it renders `unknown` — never `fresh`,
   `on_track`, or zero. Missing `receivedAt` (e.g. pre-005-01 pulled records)
   degrades safely rather than assuming freshness.
4. **Explained.** The aged freshness states a machine-readable reason
   (`receivedAt` and the window it fell outside) consistent with the schema's
   `freshness.reason` requirement for non-`fresh` states.
5. **Pull unaffected in spirit.** Pulled records (no push cadence) age by the same
   collection-time rule; the fallback path keeps producing renderable cards.
6. **Verification.** `node --test` covers fresh/stale/unknown transitions across
   the window boundary using injected clock/`receivedAt` fixtures (respecting the
   determinism rules — time is injected, not read from the wall clock), the
   worse-of-two rule, the missing-`receivedAt` safe degrade, and the
   never-upgraded invariant. The pre-existing suite stays green.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Aging is deterministic and unit-tested with injected time, not wall-clock.
- [ ] Compliance and craft reviews pass.
- [ ] Architecture review passes (`arch_review: true` — read-layer freshness
      semantics).
- [ ] Deviation log and reconciliation sweep complete; architecture doc records
      the aging policy home; refinement-todo and status board updated.

**Anti-horizontal-phasing check:** after this slice the user watches a project's
card visibly decay to stale then unknown when its client stops reporting — the
honesty guarantee is user-visible, not an internal timestamp.

**Resolution trigger:** when hosted auth / GitHub-push collection is tackled. The
committed MVP stays on central pull; freshness aging for the push path re-opens with
that follow-up. (Pull-model freshness is handled independently in spec 009.)
