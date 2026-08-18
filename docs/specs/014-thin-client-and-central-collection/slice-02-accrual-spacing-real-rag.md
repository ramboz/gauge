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
- **New hazard this slice owns (round-2 secondary):** because no-change captures
  are skipped, a genuinely **stalled** project stops accruing records, so its
  latest record's `freshness` is frozen at the last-change `collectedAt` — Gate 2
  could keep reading `fresh` and report `on_track` on a project that has since gone
  quiet. Validity must **not mask a stall** (AC4).

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
4. **A stall is never masked by dedup.** A project that genuinely stalls (no new
   commits, no progress → no new captures, by 014-01 AC2) must **not** keep reading
   `on_track` off a frozen-`fresh` record: its staleness surfaces (e.g. freshness
   evaluated so the quiet project reads `stale`/`at_risk`, not a stale `on_track`).
   Observable: a project whose last genuine capture is older than the staleness
   window reads a non-`on_track` state end-to-end, not a frozen healthy band.
5. **Honest below the gate.** A project still short of the minimum-history bar
   reads explicit `unknown (insufficient-history)` and still shows the
   013-shipped first-run hint — validity never fabricates a band it has not
   earned.

**Edge cases to cover explicitly:** dense genuine-change captures within the
interval (keep-latest, AC1); **`denom` changes across retained captures** (forecast
reads `scope-changed`, not a fabricated band — AC2b); a genuinely stalled project
whose last capture is old (reads stale, not frozen `on_track` — AC4); a capture
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
