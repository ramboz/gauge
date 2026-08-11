---
status: DONE
dependencies: []
last_verified: 2026-08-11
---

## Slice 012-02 — git velocity on the card

**Goal:** Each project card carries a **velocity** signal derived from git commit
cadence — a compact number (commits per week over a trailing window) plus a small
sparkline of recent weekly buckets — so a manager sees relative momentum across
the portfolio at a glance. No deadline dependency; this is a raw-layer signal the
spike (012-01) cleared to build now.

**DoR:**
- ✅ Every corpus repo exposes git history; commit cadence is present and
  differentiated across repos by orders of magnitude (spike 012-01, re-validated
  2026-08-10).
- ✅ Gauge's own observation history is a single snapshot (no native pace series
  yet), so git cadence is the immediate proxy (spec.md `## Assumptions`).
- ✅ The read layer (`/api/data`) can carry new per-project fields.

**Acceptance Criteria:**

1. **Velocity deriver.** A pure function computes, per project, the commit count
   over a trailing window (default 8 weeks) and a per-week bucket series from git
   log timestamps. It reads git read-only and never writes to a source repo.
2. **Headline number.** The card shows commits/week (windowed mean), rounded to a
   sensible precision, labelled so it is unambiguous (e.g. "≈ N commits/wk").
3. **Sparkline.** The weekly buckets render as a compact inline sparkline on the
   card stat row; empty/short history degrades to fewer bars, never a crash.
4. **Unknown is explicit.** A project with no git, no commits in the window, or an
   unreadable history renders `unknown` (gray), never `0` presented as healthy —
   per the project's unknown-stays-explicit rule.
5. **Windowed, deterministic.** Given a fixed clock and repo state the output is
   deterministic; the window is a documented parameter, not hard-coded magic.
6. **No source writes, no secrets.** The deriver only reads; no commit messages or
   author emails are surfaced verbatim on the card beyond the aggregate counts
   this slice defines (author-level detail is 012-05's concern).

**DoD:**
- [x] All ACs pass; full suite green (no regressions).
- [x] Tests cover: cadence over a fixture repo, empty-window → unknown, no-git →
      unknown, bucket-series shape, and window-parameter determinism.
- [x] Each new test shown to fail when the feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-02-compliance.md`, `reviews/slice-02-craft.md`).
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed. — see below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **New module `src/velocity.mjs`.** Pure `velocityFromTimestamps(timestamps,
  nowMs, windowWeeks=8)` → `{perWeek, buckets}` | `null`; thin git wrapper
  `gitCommitTimestamps` (`git log --since --format=%ct`); combinator
  `gitVelocity(root, nowMs, windowWeeks)` → `null` on any git failure; pure
  read-layer join `attachVelocity(data, byId)` mirroring `attachMilestones`.
  Wired into `/api/data` in `src/server.mjs` with a single shared `nowMs` per
  request (AC5 determinism); rendered in `public/index.html` (`sparkline` +
  `velocityBlock`/`velocityHeadline`).
- **Windowing defense-in-depth.** `git log --since` uses a +1-week margin so no
  boundary commit is lost to `--since` vs millisecond disagreement; the pure
  `velocityFromTimestamps` does the authoritative `[windowStart, nowMs]` filter.
  A commit exactly on `windowStart` is clamped into bucket 0 via
  `Math.min(windowWeeks-1, weeksAgo)` (off-by-one guard).
- **Reconciliation fixes (from the review passes).**
  1. *Partially-vacuous AC4 "unknown" test* — the assertion `/\bunknown\b/i` also
     matched the card's "Execution signal unknown." fallback, so it passed even
     with `velocityBlock` stubbed out. Scoped to the velocity block's own markup;
     red-on-stub confirmed.
  2. *Weak empty-sparkline test* — strengthened from bare `doesNotThrow` to assert
     the headline + an empty-but-present spark span.
  3. *Sub-0.1 rounding honesty* — a non-null but sparse rate could round to
     `0.0` and display "≈ 0 commits/wk" (the "0-as-healthy" shape AC4 guards
     against) once the window param is large. Added `velocityHeadline`: a non-null
     `perWeek` that rounds to 0 renders "< 0.1 commits/wk", never "≈ 0"; true
     `unknown` (null) is unchanged. Pure + card tests added.
- **Accepted/logged nits (non-blocking).** (a) `gitVelocity` runs a synchronous
  `execFileSync` git spawn per project per `/api/data` request — bounded (~9 weeks
  of `%ct` lines) and consistent with the existing `attachForecasts` sync-read
  pattern; a pathologically busy repo hitting `execFileSync`'s 1 MB `maxBuffer`
  degrades to `unknown` (extreme edge). (b) The sparkline `<span>` is
  `aria-hidden` so its `title` isn't announced — acceptable because the numeric
  headline carries the accessible signal.

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**: the
  read-layer-joins list now names the per-project `velocity: {perWeek, buckets}`
  join (`attachVelocity`, `src/velocity.mjs`; `null` when git unavailable/empty).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: `velocity` is a read-layer
  join, not an observation-v1 field.
- **`docs/memory/glossary.md`** → **no-op**: "velocity = git commit cadence" is
  already the manager-metrics-catalog definition in the parent spec.
- **`CLAUDE.md` hot cache** → **no-op**: spec 012 still in flight (raw-layer slices
  landing incrementally); revisit at spec-close.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.
