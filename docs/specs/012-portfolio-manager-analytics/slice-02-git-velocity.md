---
status: DRAFT
dependencies: []
last_verified:
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
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: cadence over a fixture repo, empty-window → unknown, no-git →
      unknown, bucket-series shape, and window-parameter determinism.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.
