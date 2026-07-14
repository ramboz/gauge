---
status: RECONCILED
dependencies: [adr-0003, adr-0005]
last_verified: 2026-07-13
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
  [ADR-0005](../../decisions/adr-0005-symmetric-source-state-isolation.md)
  after frame critique; ADR-0005 retains and corrects ADR-0004's contract.
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
- [x] All ACs pass; full test suite green.
- [x] Implementer tests exercise every AC and the no-source-write invariant with
      read-only fixtures or before/after tree comparison.
- [x] Compliance and craft reviews pass.
- [x] Architecture review passes (`arch_review: true`).
- [x] Deviation log and reconciliation sweep are complete.
- [x] Reconciliation review passes.
- [x] `docs/refinement-todo.md`, product vision, architecture, README, primer,
      and status board reflect the landed Gauge boundary.

**Anti-horizontal-phasing check:** after this slice, the user opens the local
Gauge page and sees real project cards produced through the new adapter and
central-state boundary; the retrofit is visible end to end rather than an unused
internal abstraction.

### Deviation log (after reconciliation)

- Retained the `scripts/snapshot.mjs` filename as a compatibility entrypoint,
  but removed every source-writing flag and converted it to the explicit central
  Gauge collector.
- Tightened canonical version-1 configuration beyond the POC: project ids are
  mandatory and stable; only legacy `dashboard.config.json` migration derives
  ids.
- Implemented the accepted ADR contract's deterministic candidate resolution,
  version-safe merging, typed v1 capability values, and exact reader-version
  gates in this slice because the API and browser could not honestly claim a
  source-neutral boundary without them.
- Restricted durable collection to the Darwin/APFS environment qualified by
  ADR-0005. Other environments remain scan-only and fail closed instead of
  receiving an unproven atomicity claim.
- Grew the regression suite from the 29-test repaired baseline to 64 tests after
  four independent-review fix cycles exposed containment, schema parity,
  adapter isolation, versioning, and serialization edge cases.
- Reconciliation removed the remaining pre-implementation POC framing from the
  primer, architecture header, and active release handoff after the independent
  reconciliation review identified it as contradictory live guidance.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|---|---|---|
| `README.md` | `updated` | Gauge is the runtime front door; commands, migration, and state constraints are documented. |
| `docs/specs/README.md` | `updated` | Regenerate after lifecycle transitions. |
| `docs/product-vision.md` | `updated` | Remove the resolved observation contract from the open product questions. |
| `docs/architecture.md` | `updated` | Describe the landed modules, contracts, resolution rules, and state boundary. |
| `CLAUDE.md` | `updated` | Replace the blocked-draft framing with the landed runtime foundation. |
| `docs/compass-integration.md` | `updated` | Document optional legacy reads and the converted central collector. |
| `docs/refinement-todo.md` | `updated` | Move observation/history into resolved foundations and retain triggered follow-ups. |
| `docs/memory/**` | `updated` | Define the exact observation/capability boundary and containment learnings. |
| `docs/decisions/README.md` | `verified` | ADR-0005 already indexes the accepted corrected contract; no new decision was added. |
| `docs/releases/local-portfolio-loop.md` | `updated` | Record the landed retrofit foundation and narrow the remaining JIG handoff. |
