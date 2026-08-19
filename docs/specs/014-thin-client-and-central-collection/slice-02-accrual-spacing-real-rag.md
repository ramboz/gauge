---
status: IN_PROGRESS
dependencies: [014-01]
last_verified:
frame_review: true
arch_review: true
claimed_by: claude/jig-orient-4db1fd
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
