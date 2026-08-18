---
status: DRAFT
dependencies: [014-02]
last_verified:
frame_review: true
arch_review: true
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
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [ ] Each new test has been shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` carries the cost-durability follow-up (persist
      cost when transcripts rotate) with its resolution trigger.

**Anti-horizontal-phasing check:** After this slice the owner sees, on each card,
whether velocity and spend are trending up or down over the accrued window — a
new decision-supporting read, not internal plumbing.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
