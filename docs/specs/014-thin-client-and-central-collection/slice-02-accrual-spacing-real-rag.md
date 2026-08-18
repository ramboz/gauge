---
status: DRAFT
dependencies: [014-01]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-02 — capture-validity: only genuine-change captures accrue

**Goal:** Make the accrued `progress(t)` series a record of **genuine changes**,
not a flatline of identical snapshots or storage-bloating duplicates, by deciding
at capture time **which session-end snapshots are valid progress points** — the
charter 014-01 explicitly hands here. This is the capture-validity layer that
*lets* real RAG light **when the project also has stable scope and a committed
target** — it does not, and cannot, force RAG green on its own.

**Frame (corrected by frame-critique — read `src/derive.mjs` before implementing):**
the earlier framing ("minimum-interval spacing lights real RAG") was wrong on the
mechanism. Grounding `deriveForecast`:
- **Pace uses two endpoints only** (`window[0]` earliest same-denom, and
  `latest`, `src/derive.mjs:~157`), so clustered captures do **not** distort
  observed pace — the value of deduping is **storage hygiene and honest
  progress-point selection**, not pace fidelity.
- **The binding gate for a captured series is scope stability, not density.**
  Gate 4 walks back only while `denom` is *exactly* equal to the latest
  (`DENOM_TOLERANCE = 0`, `src/derive.mjs:~120`); an actively-worked project whose
  `denom` churns collapses the window → honest `unknown('scope-changed')`,
  which this slice **must not** paper over. ADR-0018's reconstruction (signal
  computable on only 31–71% of observations) confirms scope churn, not clustering,
  is the dominant blocker.
- **The real hazard capture-validity fixes** is the 014-01 no-change case: an
  unconditional snapshot of an unchanged project appends an identical
  `progress(t)` point → a flat/regressing series `deriveForecast` reads as
  *stalled/at-risk* — a **false negative** on the very RAG chip the release lights.

**DoR:**
- ✅ Slice 014-01 landed: session-end captures are accruing under `stateDir` as
  raw activity samples (014-01 writes unconditionally; validity is this slice's
  job).
- ✅ Probe-confirmed: `collectObservation` appends one record per call with no
  dedup (`src/state.mjs:245`) → an unbounded hook bloats history (storage motive,
  AC2) and, worse, records no-change duplicates (false-flatline motive, AC1).
- ✅ Grounded read of `deriveForecast` (Gate 4 `DENOM_TOLERANCE=0`; 2-endpoint
  pace) recorded above — the ACs below target the real gate, not density.

**Acceptance Criteria:**

1. **No-change captures are skipped (content dedup — the primary rule).** A
   session-end capture whose observed progress state — git HEAD **and** execution
   progress `{done, denom}` — is identical to the latest retained snapshot is
   **not** written. A pure, unit-testable predicate over (latest snapshot, new
   observation), separate from I/O. Observable: a no-change session appends no
   record; a session that advanced HEAD or progress does. This is what keeps
   `progress(t)` from flatlining into a false `at_risk`.
2. **Storage hygiene, keep-latest within a window.** Beyond content dedup, dense
   genuine-change captures within a documented minimum interval (`MIN_CAPTURE_INTERVAL`,
   a named constant) are coalesced to **keep the newest** reading (never drop the
   fresher progress in favour of a stale one — resolving the skip-vs-coalesce
   ambiguity in favour of freshness). Framed as storage/span hygiene, **not** pace
   fidelity (pace is 2-endpoint; clustering cannot distort it).
3. **Real RAG only where scope is stable — honest `scope-changed` otherwise.**
   Two end-to-end assertions through the read layer on **captured** (not
   backfilled) records: (a) a **stable-denom** series spanning ≥ the ADR-0012
   minimum with a committed target renders a real `on_track`/`at_risk` band; (b) a
   series whose `denom` **churns** across captures renders honest
   `unknown('scope-changed')`, **never** a fabricated band. Capture-validity
   improves (a); it does not suppress (b).
4. **Branch/worktree captures never masquerade as mainline progress.** A capture
   taken from a `.claude/worktrees/*` or non-default-branch session records its
   branch provenance and is **excluded from (or explicitly marked in) the progress
   series the forecast reads**, so unmerged branch state never inflates mainline
   `progress(t)`. Observable: a worktree-session capture does not raise the
   mainline progress point; provenance is legible on the record.
5. **Backfill + capture compose.** Content dedup and hygiene treat git-backfilled
   seed records (013-01) and session-end captures as one ascending series (same
   directory, same `readObservationHistory` read) without double-counting or
   ordering errors.
6. **Honest below the gate.** A project still short of the minimum-history bar
   reads explicit `unknown (insufficient-history)` and still shows the
   013-shipped first-run hint — validity never fabricates a band it has not
   earned.

**Edge cases to cover explicitly:** a no-change run of N sessions (only genuine
changes retained, AC1); **`denom` changes across retained captures** (forecast
reads `scope-changed`, not a fabricated band — AC3b); a capture from a linked
worktree / feature branch (AC4); a capture whose `collectedAt` is *older* than the
latest record (clock skew — never reorders/dedups incorrectly); an empty history
(first genuine capture always retained); a same-day backfill seed then a fresh
capture (compose, keep-latest).

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
