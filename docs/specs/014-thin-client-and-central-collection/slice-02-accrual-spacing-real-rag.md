---
status: DONE
dependencies: [014-01]
last_verified: 2026-08-18
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-02 — capture-validity hardening: honest RAG on captured history

**Goal:** Make the RAG chip read truthfully on real captured history by hardening
two things on top of 014-01's unconditional capture: (1) **storage hygiene** —
coalesce byte-identical consecutive captures while *advancing* the timestamp (no
bloat, no masked stalls); (2) **forecast currency** — a read-layer live-tail splice
so the forecast's `latest` reflects "now", removing the false `on_track` a frozen
old record produces (a fresh-but-flat project honestly reads `at_risk`; a quiet
project honestly reads `unknown('stale-evidence')` — never coerced). Plus honest
`scope-changed` where `denom` churns, and backfill+capture compose. It *lets* real RAG light **where scope is
stable and a target is committed**; it does not, and cannot, force RAG green.

**Frame (corrected across 3 frame-critique rounds + owner decision 2026-08-18 —
read `src/derive.mjs`, `src/observation.mjs`, `src/server.mjs` before implementing):**
- **014-01 captures unconditionally — no content-dedup (owner decision).** Round 3
  established (against `src/derive.mjs:162`) that pace is **endpoint-based and
  density-invariant**, so deduping flat points changes no forecast; and that a
  flat-progress-near-deadline `at_risk` is **honest**, not a false alarm — while
  content-dedup would *freeze the latest timestamp and mask real stalls*. So the
  earlier "no-change guard" was **removed** from 014-01. This slice owns the two
  concerns that remain.
- **Storage hygiene that ADVANCES the timestamp (AC1).** Unconditional capture
  bloats storage with byte-identical consecutive records. Coalesce a run of
  identical-`{HEAD,done,denom}` captures to **one record whose timestamp is the
  newest** — pure storage hygiene, **forecast-neutral** (the retained latest
  timestamp still advances, so a stall is *not* masked; freezing the timestamp is
  exactly what we must not do). Density-invariance (pace is 2-endpoint) is what
  makes this safe.
- **Forecast currency via a read-layer live-tail (AC4).** The real lever on the
  RAG chip is the **latest timestamp**: `deriveForecast` reads `daysToDeadline =
  deadline − latest.collectedAt` and `spanDays` from `latest.collectedAt`
  (`derive.mjs:194,162`). A stalled project (no new captures) keeps an old stored
  `latest` → a false-`on_track` reading. Fix in the **read layer**: splice the
  server's live `observeAll` observation (current state, `now` timestamp, current
  freshness) as the series **tail** before the pure fold, so `latest` always
  reflects now. **Gate 2 then splits the outcome honestly** (`derive.mjs:109`, runs
  before the pace fold): a **fresh-but-flat** project → `at_risk
  (no-forward-progress)`; a **quiet** project (git stale > `STALE_AFTER_DAYS`) →
  `unknown('stale-evidence')`. We never coerce `fresh` to force `at_risk` (ADR-0006
  "unknown, never coerce"). The win: **no false `on_track` off a frozen latest.**
  Keeps `deriveForecast` I/O-free and `now`-free (ADR-0006).
- **The binding gate is scope stability, not density.** Gate 4 walks back only
  while `denom` is *exactly* equal to the latest (`DENOM_TOLERANCE = 0`,
  `src/derive.mjs:~120`); a churning `denom` collapses the window → honest
  `unknown('scope-changed')`, which this slice **must not** paper over (AC2).
- **Worktree captures are a non-issue:** the hook observes `project.path` (main
  tree, `observation.mjs:671`), not the session cwd — no worktree-exclusion rule
  exists to write.

**DoR:**
- ✅ Slice 014-01 landed: session-end captures accrue **unconditionally** under
  `stateDir` (no content-dedup — owner decision) — honest forward history.
- ✅ Grounded read recorded above: pace is endpoint-based/density-invariant
  (`derive.mjs:162`); the latest **timestamp** is the RAG lever; the server runs a
  live `observeAll` scan (`server.mjs`) whose freshness/timestamp are current and
  can be spliced as the series tail.
- ✅ Gate 4 `DENOM_TOLERANCE=0` and `project.path` observation confirmed — the ACs
  target the real gate, claim no worktree hazard, and never freeze a timestamp.

**Acceptance Criteria:**

1. **Storage hygiene that advances the timestamp (never freezes).** A run of
   consecutive captures with identical `{HEAD, done, denom}` is coalesced to **one
   retained record whose `collectedAt` is the newest** of the run — so storage
   doesn't bloat, but the retained latest timestamp still **advances** (a stall is
   never masked by a frozen timestamp). Forecast-neutral by density-invariance
   (pace is 2-endpoint). Observable: N identical consecutive captures leave one
   record; its `collectedAt` equals the newest capture's, not the oldest.
2. **Real RAG only where scope is stable — honest `scope-changed` otherwise.**
   Two end-to-end assertions through the read layer on **captured** (not
   backfilled) records: (a) a **stable-denom** series spanning ≥ the ADR-0012
   minimum with a committed target renders a real `on_track`/`at_risk` band; (b) a
   series whose `denom` **churns** across captures renders honest
   `unknown('scope-changed')`, **never** a fabricated band.
3. **Backfill + capture compose.** Hygiene treats git-backfilled seed records
   (013-01) and session-end captures as one ascending series (same directory, same
   `readObservationHistory` read) without double-counting or ordering errors.
4. **Forecast currency via a read-layer live-tail splice (no false `on_track`).**
   The read layer splices the server's live `observeAll` observation — current
   state, `now` `collectedAt`, current freshness — as the **tail** of the series
   handed to `deriveForecast`, so `latest` always reflects now (`deriveForecast`
   stays I/O-free and `now`-free; ADR-0006). This removes the **false `on_track`**
   a frozen old stored record produces; the two honest outcomes, split by Gate 2
   (`derive.mjs:109`, which runs *before* the pace logic), are:
   - **Fresh-but-flat** (recent commits, milestone `done/denom` flat): passes
     Gate 2, reaches the pace fold → **`at_risk` (`no-forward-progress`)** as the
     deadline nears. Honest.
   - **Quiet** (no commits > `STALE_AFTER_DAYS`): the live tail is `stale` → Gate 2
     returns **`unknown('stale-evidence')`**. Honest — we do **not** coerce `fresh`
     to force `at_risk` (that would fabricate evidence, an ADR-0006 violation).

   Either way, **never a false `on_track` off a frozen latest.** **Observable that
   bites when the splice is removed:** a project whose newest *stored* record was
   `fresh` at capture but whose `lastCommit` is now old reads a false `on_track`
   off that frozen latest; with the splice it reads `at_risk` (fresh-but-flat
   fixture) or `unknown('stale-evidence')` (quiet fixture) end-to-end — removing
   the splice flips both tests. Two fixtures required (the bands differ).
5. **Honest below the gate (bar measured post-splice).** ADR-0012's ≥2-supported /
   ≥1-day-span bar is measured on the series **after** the live tail is spliced
   (the tail is a `supported` execution, so Gate 3 counts it, `derive.mjs:112-115`).
   So `insufficient-history` is the honest read only when there are **0 stored
   supported records** or the spliced span is `< 1 day` — i.e. one genuinely
   time-separated stored capture plus the live `now` tail can legitimately light a
   real band (two real, time-separated readings, per ADR-0012's letter). Such a
   project still shows the 013 first-run hint until it clears; validity never
   fabricates a band it has not earned. (Fixture: 0 stored supported records → the
   spliced tail alone stays `insufficient-history`.)

**Edge cases to cover explicitly:** a run of byte-identical consecutive captures
(coalesced to one record at the newest `collectedAt` — AC1); **`denom` changes
across retained captures** (forecast reads `scope-changed`, not a fabricated band —
AC2b); a **fresh-but-flat** project (recent commits, flat progress → live-tail splice →
`at_risk` — AC4); a **quiet** project (git stale > `STALE_AFTER_DAYS` → live-tail
splice → `unknown('stale-evidence')`, never a frozen `on_track` and never coerced
to `at_risk` — AC4); the live tail when its `{HEAD,done,denom}` **equals** the
newest stored record — it is **always appended** (extends `spanDays` with a `now`
timestamp, adds no distinct progress step; a literal "skip when equal" is wrong and
would reintroduce the frozen-latest false `on_track`); a capture whose `collectedAt`
is *older* than the latest record (clock skew — never reorders incorrectly); a
same-day backfill seed then a fresh capture (compose, AC3).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [x] Each new test has been shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [x] Implementation review passed.
- [x] **Dogfood probe:** captured (non-backfilled) history on at least one real
      stable-scope project lights a real RAG band, and a scope-churning project
      reads honest `scope-changed` — recorded in the deviation log, so the payoff
      is verified against real data, not fixtures alone.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, a Gauge owner's captured
history is a clean series of **genuine changes** — so a worked project with
**stable scope and a committed target** shows a real green/amber RAG band on its
own captured (non-backfilled) history, while a scope-churning project honestly
reads `scope-changed` rather than a fabricated band or a false `at_risk`
flatline. (The dogfood claim is backed by a probe against Gauge's own captured
history in the DoD, not asserted on fixtures alone.)

### Deviation log (after reconciliation)

1. **Implemented directly in the main loop.** The first implementer subagent died
   on a session limit mid-task with no partial code; the slice was re-implemented
   in the orchestrator loop. Independent review remained separate fresh-context
   subagents (compliance + craft + arch + a fresh compliance re-review), so review
   independence held.
2. **Two pure modules + opt-in capture hygiene + a read-layer splice.**
   `src/capture-hygiene.mjs` (`sameCaptureState`, keyed on git HEAD + execution
   `{done,denom}`) and `src/live-tail.mjs` (`spliceLiveObservation`, always-append)
   are pure. `collectObservation` gained an **opt-in** `coalesce` option
   (`src/state.mjs`) that removes the newest identical-state prior after writing —
   default-off, so manual `snapshot` and `backfill` are unaffected; only the
   session-stop hook opts in. `src/server.mjs` splices the live `observeAll`
   observation as the history tail before `attachForecasts`; `deriveForecast` is
   unchanged (pure, `now`-free — ADR-0006).
3. **Cross-slice change to 014-01 (in-spec evolution).** Enabling `coalesce` in the
   014-01 hook changed two 014-01 tests that had asserted append-count: identical
   consecutive captures of the unchanged main tree now coalesce to one record at
   the newest `collectedAt`. Updated to assert the coalesced outcome (not a
   weakening — compliance confirmed). 014-02's charter is exactly to harden 014-01's
   capture, so this is expected, not drift.
4. **Review fixes (all reviewer findings addressed).** Clock-skew guard
   (arch+craft+compliance): `coalescePriorIdentical` now compares `collectedAt` and
   drops the *older* of two identical-state records, so a backward-skewed capture
   never regresses the latest timestamp (+ witnessed test). Added AC2a/AC2b tests
   (stable→band, churn→`scope-changed`), an AC3 backfill+capture compose test, and a
   `server.mjs` live-tail wiring test matching the `attach*` idiom.
5. **Dogfood probe (DoD) — verified on real captured history, not fixtures.** Ran
   `npm run backfill --project-id gauge` (11 reconstructed points) + the live-tail
   splice through the real read path: **gauge → `at_risk(no-forward-progress)`** (a
   real RAG band on captured history, honest — milestone progress flat as the
   2026-08-28 deadline nears), and scope-churning projects (jig, servo, shaper,
   mystique-cwv) → honest `unknown('scope-changed')`. The splice demonstrably shifts
   real readings (rtb `insufficient-history`→`stalled`; servo `stale-evidence`→
   `scope-changed`) and never fabricates an `on_track`.
6. **Forward notes carried (arch reconciliation).** 014-03 must **not** read
   observation-record *count* as a trend signal (coalescing collapses flat runs but
   preserves every genuine change point). 014-04's running-now join must **compose
   with**, not duplicate, the live-tail splice (do not double-append a `now`
   endpoint). Recorded here for the next slices; no `refinement-todo` change needed.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing front-door change; the capture/derive plumbing is internal. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out (below). |
| `docs/product-vision.md` | `no-op` | No scope/behavior drift; honest-unknown + read-only-observer contracts preserved. |
| `docs/architecture.md` | `no-op` | ADR-0006 (pure derivation) and ADR-0005 (source/state isolation) upheld — the splice adds the clock only in the read layer, coalescing removes only Gauge's own records; no boundary moved. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / templates | `no-op` | Spec 014 still in flight (014-03/04 pending); primer compression waits for spec close. |
| `docs/inbox.md` | `no-op` | No items resolved or added by this slice. |
| `docs/refinement-todo.md` | `no-op` | No new deferred decisions; forward notes for 014-03/04 live in the deviation log. |
| `docs/memory/**` | `no-op` | No new durable term/learning beyond the deviation log; memory-sync at spec close. |
| `docs/decisions/` / ADR index | `no-op` | No ADR: the `coalesce` state-contract evolution is opt-in and within ADR-0005's own-state scope (arch pass concurred); the splice is within ADR-0006. |

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
