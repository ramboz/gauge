---
status: DRAFT
dependencies: [adr-0018]
last_verified:
# arch_review: true  # candidate — this slice adds a history-producing path
#                    # (git → observations in the state dir); flip on if the
#                    # write path touches the observation/state boundary.
---

<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable claims or mark them
     as assumptions in spec.md `## Assumptions`; never assert unverified. -->

## Slice 013-01 — git-backfill seed lights the deadline forecast

**Goal:** Reconstruct each jig project's `progress(t)` series from its own git
history and write it as backfilled observation snapshots into the Gauge state dir,
so the **existing** deadline forecast (ADR-0012, tier 1) computes a real
`on_track`/`at_risk` on real history — with no change to `deriveForecast`. A
deadline-bearing card (e.g. gauge, deadline 2026-08-28) goes from
`unknown (insufficient-history)` to a real RAG colour.

**DoR:**
- ✅ ADR-0018 Accepted (done).
- ✅ The reconstruction shape is proven (ADR-0018 Context table; the throwaway
  script).
- ✅ Observation-v1 write path (`src/state.mjs`) and schema
  (`schemas/observation-v1.schema.json`) confirmed to accept a snapshot with
  provenance/freshness marking it reconstructed-from-git (verify at implementation;
  listed in spec `## Assumptions`).

**Acceptance Criteria:**

1. **Reconstruction command.** A backfill entry point (e.g. `npm run backfill` /
   `scripts/backfill.mjs`) reconstructs, per configured jig project, a
   `progress(t)` series from git — spec-level `progressOf` over
   `docs/specs/*/spec.md` `status:` frontmatter at a sampled commit cadence (one
   commit per day) — mirroring `src/scan.mjs`/`src/lib.mjs` semantics
   (`denom = total − abandoned`). Read-only against source repos (never writes to
   them — a hard project constraint).
2. **Honest backfilled observations.** Each reconstructed point is written to the
   state dir as an observation whose provenance/freshness explicitly marks it
   **reconstructed-from-git** (not live-collected), with `collectedAt` set to the
   commit date. It validates against observation-v1.
3. **Deadline forecast lights up.** After backfill, `/api/data` returns a real
   non-`unknown` `forecast` for a project that has both a committed deadline and a
   reconstructed history clearing Gates 2/3/4/4.5 — verified on gauge (deadline
   2026-08-28): the RAG chip renders a real band, not `insufficient-history`.
4. **Gate 4 honesty preserved.** A project whose reconstructed `denom` never holds
   constant long enough (Gate 4 fails) still reads `unknown('scope-changed')` —
   the backfill does not fabricate a pace over churning scope. (Confirmed shape:
   jig, 68% denom churn, still has stable runs; the forecast abstains where it must.)
5. **Idempotent + bounded.** Re-running backfill does not duplicate observations
   for the same project/commit-day; the sampled cadence is bounded (documented),
   not a per-commit explosion.

**DoD:**
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests exercise each AC with fixtures — including a churning-`denom` fixture
      that must read `scope-changed`, and a stable-window fixture that lights up.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch if flag set).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, the owner opens the dashboard
and sees gauge's RAG chip show a **real** on_track/at_risk instead of grey — a
user-visible change, not just data on disk.

### Deviation log (after reconciliation)

_TBD._

### Reconciliation sweep

_TBD._
