---
status: DRAFT
dependencies: [adr-0003, adr-0004]
last_verified:
frame_review: true
arch_review: true
---

## Slice 004-01 — Gauge core and central state

**Goal:** A user runs Gauge locally and sees the existing useful Jig-backed
project cards through a normalized, adapter-driven Gauge core whose observations
and history live only in the private Gauge instance—not in surveyed projects.

**DoR:**
- ADR-0003 is accepted after frame critique.
- The central observation/history contract and its schema/versioning semantics
  are accepted in
  [ADR-0004](../../decisions/adr-0004-central-observation-history-contract.md)
  after frame critique.
- POC reuse/redistribution permission is recorded through the repository's MIT
  license and preserved upstream attribution.

**Acceptance Criteria:**

1. **Gauge identity.** `package.json`, example configuration, server output,
   browser title/copy, and runtime-facing names use `Gauge`; the page no longer
   presents the product as `project-dashboard` or as inherently Jig-managed.
2. **Normalized observation boundary.** The scan pipeline exposes a versioned
   project observation shape independent of any source convention. The existing
   Jig parsing is reachable through an optional Jig adapter; a project with no
   Jig artifacts remains a valid project with explicit unsupported/unknown
   signals rather than a “not Jig-managed” product-level rejection.
3. **Central instance state.** Configuration and durable observations/history
   resolve beneath an explicit Gauge instance-state location. Product code and
   instance state may share the private MVP repository, but modules do not assume
   they must share a repository.
4. **No source-project writes.** Normal scans, local refreshes, and scheduled
   collection write nothing to configured project repositories. The shipped
   `scripts/snapshot.mjs` source-repo writer is removed, disabled, or converted
   into a Gauge-instance writer under the accepted central observation contract.
5. **POC value preserved.** Through the Jig adapter, the local page continues to
   show honest spec progress, workstreams, pinned/hidden documents, and
   worktree-only warnings with the existing tolerant failure behavior.
6. **Freshness and provenance.** Every normalized observation carries source,
   source revision or collection time, and freshness/error state so unavailable
   data cannot render as zero or healthy.
7. **Compatibility and migration.** The old `dashboard.config.json` shape either
   migrates deterministically to the Gauge registry or fails with one actionable
   migration message. The old `docs/status/compass-history.jsonl` input may be
   read as an optional legacy signal during migration but is never required or
   written by Gauge.
8. **Verification.** `node --test` covers the normalized contract, Jig adapter,
   non-Jig/unknown path, state-location separation, no-source-write invariant,
   migration behavior, and preserved POC behaviors. The full pre-existing suite
   stays green or each intentional contract change is replaced by a Gauge-shaped
   assertion.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Implementer tests exercise every AC and the no-source-write invariant with
      read-only fixtures or before/after tree comparison.
- [ ] Compliance and craft reviews pass.
- [ ] Architecture review passes (`arch_review: true`).
- [ ] Deviation log and reconciliation sweep are complete.
- [ ] Reconciliation review passes.
- [ ] `docs/refinement-todo.md`, product vision, architecture, README, primer,
      and status board reflect the landed Gauge boundary.

**Anti-horizontal-phasing check:** after this slice, the user opens the local
Gauge page and sees real project cards produced through the new adapter and
central-state boundary; the retrofit is visible end to end rather than an unused
internal abstraction.

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|---|---|---|
| `README.md` | `updated` | Make Gauge the front door and document migration. |
| `docs/specs/README.md` | `updated` | Regenerate after lifecycle transitions. |
| `docs/product-vision.md` | `updated` | Execute ADR-0003's rewrite disposition. |
| `docs/architecture.md` | `updated` | Record adapters, normalized observations, and instance-state boundary. |
| `CLAUDE.md` | `updated` | Replace the old codename and active-work framing. |
| `docs/compass-integration.md` | `updated` | Replace mandatory source-repo writes with legacy/optional guidance. |
| `docs/refinement-todo.md` | `updated` | Record remaining emergent decisions and triggers. |
| `docs/memory/**` | `updated` | Add Gauge vocabulary and durable learnings. |
| `docs/decisions/README.md` | `updated` | Regenerate ADR index. |
