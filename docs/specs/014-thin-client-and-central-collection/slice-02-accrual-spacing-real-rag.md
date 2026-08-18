---
status: DRAFT
dependencies: [014-01]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-02 — capture-validity hardening: honest RAG on captured history

**Goal:** Harden the captured `progress(t)` series into an **honest** one so that
the RAG chip reads truthfully on real captured history: dense genuine-change
captures don't bloat storage, a genuinely **stalled** project surfaces as stale
(not a frozen `on_track`), a **scope-churning** project reads honest
`scope-changed`, and backfilled + captured records compose as one series. This is
the capture-validity hardening layer on top of 014-01's minimal no-change guard —
it *lets* real RAG light **where scope is stable and a target is committed**; it
does not, and cannot, force RAG green.

**Frame (corrected across 2 frame-critique rounds — read `src/derive.mjs` and
`src/observation.mjs` before implementing):**
- **The no-change guard lives in 014-01, not here.** Round 2 established that the
  hook must be non-regressive *standalone*, so the primary no-change content-dedup
  (skip a capture whose git HEAD + `{done,denom}` equals the latest) shipped in
  **014-01 AC2**. This slice hardens the *rest*.
- **Pace uses two endpoints only** (`window[0]` earliest same-denom, and `latest`,
  `src/derive.mjs:~157`), so clustered captures do **not** distort pace — the value
  of coalescing is **storage/span hygiene**, not pace fidelity.
- **The binding gate is scope stability, not density.** Gate 4 walks back only
  while `denom` is *exactly* equal to the latest (`DENOM_TOLERANCE = 0`,
  `src/derive.mjs:~120`); a churning `denom` collapses the window → honest
  `unknown('scope-changed')`, which this slice **must not** paper over.
- **Worktree captures are a non-issue (round-2 grounding):** the hook observes the
  matched project's `project.path` (main tree) via `observeProject`
  (`gitInfo(project.path)`, `observation.mjs:671`), **not** the session cwd. So a
  worktree/feature-branch session captures the unchanged main tree → a no-change
  capture skipped by 014-01 AC2. Unmerged branch state can never enter
  `progress(t)`; there is **no** worktree-exclusion rule to write (an earlier draft
  AC4 was dropped as architecturally precluded — it would only drop legitimate
  mainline points).
- **New hazard this slice owns — a READ-LAYER fix (rounds 2–3):** because
  no-change captures are skipped, a genuinely **stalled** project stops accruing
  records, so its latest *stored* record keeps a capture-time `freshness: fresh`
  forever; `deriveForecast` Gate 2 (`derive.mjs:109`) folds
  `readObservationHistory` (the stored series) and reads that frozen value, so it
  would keep reporting `on_track`. The fix **cannot** live in the capture layer
  (there is no event to dedup, and *keeping* no-change captures would contradict
  014-01 AC2). It lives in the **read layer**: re-evaluate freshness against
  read-time `now` from the source's last-commit date — the server already runs a
  live `observeAll` scan whose freshness *is* current, so splice/reconcile that
  live reading as the series tail before the pure fold, keeping `deriveForecast`
  I/O-free and `now`-free (ADR-0006). Keys on **source-commit age vs read-time
  now** (`gitFreshness(lastCommit, now)`, `lib.mjs:351`), not capture/`collectedAt`
  age. Owned by AC4.

**DoR:**
- ✅ Slice 014-01 landed: session-end captures accrue under `stateDir`, already
  no-change-deduped (014-01 AC2) — genuine-change points only.
- ✅ Probe-confirmed: `collectObservation` appends per call (`src/state.mjs:245`);
  dense genuine-change captures still motivate keep-latest hygiene (AC1).
- ✅ Grounded read of `deriveForecast` (Gate 4 `DENOM_TOLERANCE=0`; 2-endpoint
  pace; Gate 2 frozen freshness) and `observation.mjs` (captures read
  `project.path`) recorded above — the ACs target the real gate, not density, and
  claim no worktree hazard.

**Acceptance Criteria:**

1. **Storage hygiene, keep-latest within a window.** Dense genuine-change captures
   within a documented minimum interval (`MIN_CAPTURE_INTERVAL`, a named constant)
   are coalesced to **keep the newest** reading (never drop fresher progress for a
   stale one — resolving skip-vs-coalesce in favour of freshness). Framed as
   storage/span hygiene, **not** pace fidelity (pace is 2-endpoint).
2. **Real RAG only where scope is stable — honest `scope-changed` otherwise.**
   Two end-to-end assertions through the read layer on **captured** (not
   backfilled) records: (a) a **stable-denom** series spanning ≥ the ADR-0012
   minimum with a committed target renders a real `on_track`/`at_risk` band; (b) a
   series whose `denom` **churns** across captures renders honest
   `unknown('scope-changed')`, **never** a fabricated band.
3. **Backfill + capture compose.** Hygiene treats git-backfilled seed records
   (013-01) and session-end captures as one ascending series (same directory, same
   `readObservationHistory` read) without double-counting or ordering errors.
4. **A stall is never masked by frozen freshness (read-layer re-evaluation).**
   Because no-change captures are skipped (014-01 AC2), a stalled project's latest
   stored record keeps its capture-time `freshness: fresh`; `deriveForecast` Gate 2
   reads that stored value and would keep reporting `on_track`. This slice
   re-evaluates freshness **at read time** — recomputing `gitFreshness(lastCommit,
   now)` from the source's last-commit date against the current clock (splice the
   read layer's live `observeAll` freshness as the series tail before the fold;
   `deriveForecast` stays I/O-free and `now`-free). Keys on **source-commit age vs
   read-time now**, not capture age. **Observable that bites when the re-eval is
   removed:** a project whose stored record was `fresh` at capture but whose
   `lastCommit` is now older than `STALE_AFTER_DAYS` reads a **non-`on_track`**
   state end-to-end — whereas trusting the frozen record reads a false `on_track`
   (so removing the feature flips the test red; a pre-stale fixture does not
   vacuously pass).
5. **Honest below the gate.** A project still short of the minimum-history bar
   reads explicit `unknown (insufficient-history)` and still shows the
   013-shipped first-run hint — validity never fabricates a band it has not
   earned.

**Edge cases to cover explicitly:** dense genuine-change captures within the
interval (keep-latest, AC1); **`denom` changes across retained captures** (forecast
reads `scope-changed`, not a fabricated band — AC2b); a stalled project whose stored
record was `fresh` at capture but whose `lastCommit` is now older than
`STALE_AFTER_DAYS` (read-time re-eval reads stale, not a frozen `on_track` — AC4); a capture
whose `collectedAt` is *older* than the latest record (clock skew — never
reorders/dedups incorrectly); a same-day backfill seed then a fresh capture
(compose, keep-latest, AC3).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [ ] Each new test has been shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [ ] Implementation review passed.
- [ ] **Dogfood probe:** captured (non-backfilled) history on at least one real
      stable-scope project lights a real RAG band, and a scope-churning project
      reads honest `scope-changed` — recorded in the deviation log, so the payoff
      is verified against real data, not fixtures alone.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, a Gauge owner's captured
history is a clean series of **genuine changes** — so a worked project with
**stable scope and a committed target** shows a real green/amber RAG band on its
own captured (non-backfilled) history, while a scope-churning project honestly
reads `scope-changed` rather than a fabricated band or a false `at_risk`
flatline. (The dogfood claim is backed by a probe against Gauge's own captured
history in the DoD, not asserted on fixtures alone.)

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
