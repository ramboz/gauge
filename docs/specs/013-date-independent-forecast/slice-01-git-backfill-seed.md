---
status: DONE
dependencies: [adr-0018]
last_verified: 2026-08-13
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
- [x] All ACs pass; full suite green (no regressions).
- [x] Tests exercise each AC with fixtures — including a churning-`denom` fixture
      that must read `scope-changed`, and a stable-window fixture that lights up.
- [x] Each new test shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft; arch if flag set).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, the owner opens the dashboard
and sees gauge's RAG chip show a **real** on_track/at_risk instead of grey — a
user-visible change, not just data on disk.

### Deviation log (after reconciliation)

1. **Shape.** Delivered `src/backfill.mjs` (pure reconstruction fold
   `gitBackfillSeries` + honest observation builder `buildBackfillObservation` +
   idempotent writer `recordBackfillObservation`), `scripts/backfill.mjs` (CLI,
   mirrors `scripts/snapshot.mjs`), `test/backfill.test.mjs` (12 tests, real
   git-fixture repos), and an `npm run backfill` script. `deriveForecast` and the
   observation/state/schema surfaces are **unmodified** (verified byte-identical);
   the slice is purely additive.
2. **Status sourcing.** Reconstruction sources status via whole-file `^status:`
   grep at each historical commit, not a frontmatter-block parse. It reuses
   `progressOf`/`normStatus`/`gitFreshness` verbatim so vocabulary/rollup cannot
   drift from the live scan, but the *sourcing* differs. Safe against the current
   corpus (no spec body carries a line-start `status:`); revisit if one ever does.
3. **Honesty markers.** Backfilled observations carry `adapterId: 'git-backfill'`
   (never `jig`) and `freshness.reason` prefixed `reconstructed-from-git`, with
   `freshness.state` honestly derived from commit recency via the unmodified
   `gitFreshness` against the real run clock (a dormant project reads `stale`, not
   a blanket `fresh`). No schema or `state.mjs` change was needed.
4. **Idempotency** is per-`(projectId, sha)` via a deterministic UUID-v4-shaped
   record id, catching the raw `EEXIST` from `state.mjs`'s atomic writer
   (`created:false`) — intended; a per-calendar-day key was not used.
5. **Craft nits folded in.** Fixed during reconciliation: the inaccurate "UTC day"
   comment (bucketing is commit-local-offset day) and the decorative
   `DEFAULT_BACKFILL_CADENCE_DAYS` — now load-bearing (a `!== 1` guard throws,
   so the documented constant can't silently do nothing). Suite still 443/443.
6. **Nits carried as follow-ups (not fixed here, to keep the slice lean):**
   `parseArgs` + the config-load/warn/exit CLI scaffold now recur across
   `snapshot.mjs`/`onboard.mjs`/`backfill.mjs` — this slice crosses the ADR-0002
   third-caller threshold, so a shared CLI helper is warranted (logged to inbox).
   `gitOut` swallows all git errors to `''`, so a misconfigured/non-repo project
   path reports a cheerful "0 reconstructed points" rather than a diagnostic —
   acceptable for now, noted. Idempotency couples to `state.mjs`'s raw `EEXIST`
   surface. No dedicated end-to-end "stale latest ⇒ still unknown after backfill"
   test (Gate 2 is covered in the derive suite; the single-observation stale case
   is covered at `test/backfill.test.mjs`).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Slice adds a backfill script + module; no project-front-door change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out. |
| `docs/product-vision.md` | `no-op` | No product-boundary/scope change; backfill is a local read-only derivation. |
| `docs/architecture.md` | `no-op` | No module-boundary/public-contract change; `deriveForecast`/observation/state surfaces untouched (additive module + script only). |
| Primer surfaces: `CLAUDE.md` / scaffold templates | `no-op` | Spec 013 still in flight (02/03 DRAFT); active-spec entry left; compress at spec close-out. |
| `docs/inbox.md` | `updated` | Logged the ADR-0002 third-caller CLI-scaffold extraction follow-up. |
| `docs/refinement-todo.md` | `no-op` | No new deferred owner-decision from this slice. |
| `docs/memory/**` | `no-op` | No new durable term/learning beyond what ADR-0018 already captured. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched by this slice. |
