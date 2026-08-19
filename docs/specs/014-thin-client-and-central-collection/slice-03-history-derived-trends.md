---
status: RECONCILED
dependencies: [014-02]
last_verified: 2026-08-18
frame_review: true
arch_review: true
claimed_by: claude/jig-orient-4db1fd
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-03 — history-derived velocity + cost trends

**Goal:** Add a **velocity trend** and a **cost trend** to each card — the metric
plotted over the accrued observation window, not just the current point-in-time
value — so the owner sees direction over time (accelerating / cooling, spend
rising / flat).

**DoR:**
- ✅ Slice 014-02 landed: a valid, deduped observation series accrues per project.
- ✅ Probe-confirmed: velocity (`src/velocity.mjs`) and cost (`src/cost.mjs`) are
   read-time joins, **not** persisted in snapshots (schema carries only
   repository/execution/workstreams/hygiene/narrative).
- ✅ Assumption **A3 sharpened** (spec `## Assumptions` A3): transcript records
   carry a `timestamp`, but `src/cost.mjs` does **not** read it today — cost
   time-bucketing is **net-new extraction**, and it must survive the
   `dedupeRecords` first-by-filename-sort rule and the resumed-session **replay**
   hazard. This slice's first task verifies replay-stable chronology (AC1), not
   merely that a timestamp field exists. Velocity from `git log` is already
   known-reconstructable and unaffected.

**Source decision (settled 2026-08-18 — owner):** **recompute both metrics** on
every read; do **not** persist either into snapshots in this slice.
- **Velocity** → recomputed from `git log` windows over the accrued/backfilled
  observation timeline. Git is the durable source of truth; a persisted value
  could disagree with git after a rebase, so velocity stays recompute-only —
  **never persisted** (owner call).
- **Cost** → recomputed from timestamped transcripts (`src/cost.mjs`) for the
  visible trend. Works retroactively over backfilled history **while transcripts
  survive**.
- **No schema change, no ADR in this slice.** Cost *durability* once transcripts
  age out is a separate, triggered follow-up (`docs/refinement-todo.md` — "Cost
  trend durability: persist cost into snapshots when transcripts rotate"), not
  committed here. When that trigger fires, the read layer prefers a persisted
  value and falls back to recompute — an additive, ADR-gated schema change then,
  not now.

**Acceptance Criteria:**

1. **Cost time-attribution grounded, replay-stable (A3).** Before building the
   cost trend, a probe verifies — recorded in the deviation log with evidence —
   that dedup-surviving cost records carry a **chronologically-correct,
   replay-stable** `timestamp`: specifically (a) `src/cost.mjs` is extended to
   read the record `timestamp` (net-new — it does not today); (b) the
   `dedupeRecords` first-by-filename-sort winner for a replayed request carries
   the request's **original** timestamp, not a replay-time one; (c) bucketing is
   verified against a fixture with a resumed/replayed session spanning two
   windows. If any of (a)–(c) fails, the cost trend degrades to explicit
   `unknown` over the affected window — **never** a plausible-but-wrong series.
   Velocity (git-derived) is unaffected.
2. **Velocity trend renders.** The card shows a velocity **trend** across the
   accrued window (a multi-point series over observation time, distinct from the
   existing single-window git sparkline). A pure fold produces the trend series
   from its inputs; `null`/insufficient data renders explicit `unknown`, never a
   fabricated flat line.
3. **Cost trend renders (replay-safe).** The card shows a cost **trend** across
   the accrued window, reusing the per-request-deduped, illustrative-pricing cost
   model (012-03/04), with records bucketed by their verified-stable `timestamp`
   (AC1). Unknown-model, no-transcript, and un-attributable-window cases stay
   honest `unknown` exactly as today's point-in-time cost does — never a spend
   figure placed in a window it cannot be proven to belong to.
4. **Read-layer join, no derivation coupling.** Both trends are computed in the
   read layer (mirroring `attachVelocity`/`attachTokenCost`), never inside
   `deriveForecast`, preserving the ADR-0006 boundary. Each is a `/api/data`
   join with a pure, unit-testable core.
5. **Honest with thin history.** With too few observations to form a trend, the
   card shows the point-in-time value (today's behavior) plus an explicit
   "trend: not enough history yet" — never a two-point line dressed as a trend.

**Edge cases to cover explicitly:** a resumed/replayed session whose records
appear across multiple session files (dedup keeps the original-timestamp record;
spend lands in the correct window — AC1); a single observation (no trend, fall back to
point value); a gap in the series (missing window buckets); a metric that is
`unknown` at some observations but not others (trend must not treat `unknown` as
`0`); backfilled-only history (trend renders over reconstructed points if
recompute chosen).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [x] Each new test has been shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` carries the cost-durability follow-up (persist
      cost when transcripts rotate) with its resolution trigger.

**Anti-horizontal-phasing check:** After this slice the owner sees, on each card,
whether velocity and spend are trending up or down over the accrued window — a
new decision-supporting read, not internal plumbing.

### Deviation log (after reconciliation)

1. **Implemented directly in the main loop** (session-limit continuity; the
   subagent path had died earlier on 014-02). Independent review stayed separate
   fresh-context subagents (compliance ×2, craft, arch).
2. **Trends as pure folds.** `src/trends.mjs` — `velocityTrend` (commits/week in a
   trailing window as-of each accrued observation) and `costTrend` (USD of deduped
   records bucketed by stable `timestamp`), plus `attachVelocityTrend`/
   `attachCostTrend`. Reuses `dedupeRecords` + a new `recordUsd` (`src/cost.mjs`,
   prices one record; null on no-usage/unknown-model) and an exported
   `gitCommitTimestamps` (`src/velocity.mjs`). All I/O (git log, transcript reads)
   stays in `src/server.mjs`; `deriveForecast` untouched (ADR-0006). Sampled by
   observation **timestamp**, never record count — honors the 014-02 arch note
   (coalescing preserves timestamps, so the series is stable).
3. **AC1 — replay-stable chronology VERIFIED against real transcripts (probe).**
   AC1's gating obligation. A probe of a real 14-session project
   (`-Users-ramboz-Projects-misc-morning-brief-agent`) found **322 `requestId`s
   appearing in >1 record**. My initial comment claimed replays carry a *verbatim
   identical* original timestamp — the probe **refuted** that literal wording:
   copies differ. But the difference is **intra-request streaming drift** — a
   `requestId` groups a request's streamed records — with a **max span of 89.6s**;
   only 5 requestIds spanned >1 min, **none >1 hour, none cross-day**. At the trend's
   **week-bucket** granularity that sub-90s drift is negligible: every copy of a
   request falls in the same window, so dedup's first-occurrence winner buckets
   spend into the correct window. Corrected the `recordTimestampMs` comment to
   state the grounded finding; added a two-window test proving sub-minute drift
   never splits a request across weeks. **Contract holds at week granularity; no
   cross-day replay re-stamping exists in real data.**
4. **Duplicate-I/O fix (arch+craft+compliance nit → fixed, not deferred).** The
   first cut re-read+re-deduped each project's transcripts for the cost trend —
   reintroducing the exact per-request redundancy 012-04's `projectCostBundle`
   removed. Fixed: `projectCostBundle` now also returns its **deduped record set**;
   `server.mjs`'s cost trend reuses it (no second transcript read). The 012-04
   single-read guard test was **strengthened** to assert `server.mjs` never raw-reads
   transcripts (`readTranscriptRecords`/`sessionFilesForProject`), making its title
   true again.
5. **Recorded remaining nits (non-blocking).** (a) `gitCommitTimestamps` is a second
   `git log` per project alongside `gitVelocity` — defensible (the trend legitimately
   needs a wider span than velocity's fixed 8 weeks); a follow-up could feed one wide
   fetch to both. (b) `WEEK_MS` is redefined locally in `server.mjs` (also in
   trends/velocity) — trivial. (c) `O(observations × records)` bucketing — bounded and
   fine at these scales. (d) A `velocityTrend` point shows `perWeek: 0` for a
   zero-commit window (whole-trend null only if NO window has commits), a deliberate
   in-series "quiet week" reading vs. point-in-time `gitVelocity`'s null — defensible.
   (e) The cost trend **excludes** unknown-model spend (`recordUsd` → null), so it can
   under-count vs. the point-in-time headline's `unknown-model` bucket — AC3-mandated
   honest exclusion (never a guessed window), not a defect.
6. **Dogfood (real data).** Velocity trend on gauge (12 backfilled points) accelerates
   **2.1 → 11.9 commits/wk**; cost trend on jig reads **$0.25 → $0.25**. Both light on
   real captured/backfilled history; projects without attributable cost read honest
   `null` ("not enough history yet").

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No front-door change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out. |
| `docs/product-vision.md` | `no-op` | No scope/behavior drift; honest-unknown preserved. |
| `docs/architecture.md` | `no-op` | ADR-0006 upheld (trends are pure folds, I/O in the read layer); no schema change (recompute-only). |
| Primer surfaces (`CLAUDE.md`/`AGENTS.md`/templates) | `no-op` | Spec 014 still in flight (014-04 pending); primer compression waits for close. |
| `docs/inbox.md` | `no-op` | Nothing resolved/added. |
| `docs/refinement-todo.md` | `updated` | Cost-durability follow-up already recorded (from spec-014 authoring); confirmed present. |
| `docs/memory/**` | `no-op` | AC1 probe finding captured in the deviation log; memory-sync at spec close. |
| `docs/decisions/` / ADR index | `no-op` | No ADR: recompute-only, no schema change, no load-bearing decision with rejected alternatives beyond the recorded owner call. |

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
