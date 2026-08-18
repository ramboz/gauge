---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 014: Thin Client + Central Collection

> Implements the committed
> [thin-client-and-central-collection release](../../releases/thin-client-and-central-collection.md)
> (deadline 2026-08-28). Adds the two moving parts that need a **time axis**:
> accumulated **history** (so pace/forecast/RAG become real, not `unknown`) and
> live **session signals** (so "in flight" reflects what is actually running
> now). Grounded in [ADR-0017](../../decisions/adr-0017-reframe-onto-manager-lens.md)
> (session-stop capture is the future, git backfill the past, Gauge reads +
> derives) and [ADR-0006](../../decisions/adr-0006-two-layer-derivation.md)
> (two-layer derivation).

## Overview

The [local-data release](../../releases/manager-dashboard-local-data.md) shipped
the manager dashboard on **point-in-time** local data. Two deferred capabilities
need history to be real:

1. **Capture that accrues on its own.** Today history grows only via a manual
   `npm run collect` (`scripts/snapshot.mjs`) or the one-time git-backfill seed
   (`npm run backfill`, slice 013-01). Neither gives dense **forward** history.
   ADR-0017's answer is **event-driven capture owned by a thin client**: a
   Claude Code `Stop`/`SessionEnd` hook writes one observation snapshot per
   session end — no polling, no manual step (derive-never-ask). Gauge stays the
   read-only observer; the hook writes only Gauge's **own** instance history
   under `stateDir`, never a source repo (the read-only-source constraint holds:
   `collectObservation` already writes exactly there).
2. **Metrics that need a time axis.** With ≥2 spaced observations accrued past
   ADR-0012's minimum-history bar, the forecast produces real `on_track`/
   `at_risk` (the RAG chip lights) and **velocity** / **cost** render as
   **trends** over the accrued window rather than a single point-in-time value.
   An **optional** thin-client live-session signal adds a "running now" indicator
   as an enrichment to "in flight" — degrading cleanly to today's
   branch/worktree/draft-PR derivation when absent.

This spec builds the **write path** (the capture hook + installer) and the
**read-path** consequences (accrual → real RAG, history-derived trends, optional
live-session enrichment). It does **not** rebuild the engineer daily-driver, add
scheduled/daemon collection, or add source-repo writes (release No-Gos).

## Current state (probe-verified 2026-08-18)

- **Capture appends, never dedups.** `collectObservation` (`src/state.mjs:245`)
  writes one immutable record per call at
  `<stateDir>/observations/<projectId>/<stamp>-<recordId>.json`, where `stamp`
  is `collectedAt` with non-alphanumerics stripped. Two captures moments apart
  produce two records. → a hook firing on *every* session end will accrue many
  same-day records unless a **spacing/dedup rule** governs it (slice 014-02).
- **Snapshots do not store velocity or cost.** The observation schema
  (`schemas/observation-v1.schema.json`) carries only `repository`, `execution`,
  `workstreams`, `hygiene`, `narrative` signals. Velocity (`src/velocity.mjs`)
  and cost (`src/cost.mjs`) are **read-layer joins computed fresh at request
  time** (`attachVelocity` / `attachTokenCost` in `src/server.mjs`), never
  persisted per-snapshot. → a history-derived **trend** must either recompute
  each metric historically or start persisting it forward (slice 014-03's open
  decision, below).
- **The read side already reads history.** `readObservationHistory(stateDir,
  projectId)` (`src/state.mjs:274`) returns the ascending observation series;
  `deriveForecast` already folds it and lights real RAG once the series clears
  ADR-0012's gate — so 014-02 is chiefly a *capture-quality* rule plus
  verification, not a new derivation.
- **The hook contract is verified (A1 resolved 2026-08-18).** Per the Claude
  Code hooks docs (`code.claude.com/docs/en/hooks.md`, `hooks-guide.md`) plus a
  local probe of `~/.claude/settings.json`: a **`SessionEnd`** hook receives a
  JSON payload on **stdin** carrying `cwd`, `session_id`, `transcript_path`,
  `hook_event_name`, and `exit_reason` — so cwd → project mapping is reliable. It
  runs an **arbitrary command** (`node scripts/…`), registered under
  `hooks.SessionEnd[].hooks[]` (`{type:"command", command, timeout?}`) in
  `~/.claude/settings.json`. **`SessionEnd` (once per session), not `Stop`**
  (fires every turn), is the correct trigger. Constraint: SessionEnd hooks share
  a **~1.5s budget** (raise via per-hook `timeout`, max 60s); failure is
  **non-blocking** (never disrupts session exit). Local grounding: the user's
  `settings.json` **already has a populated `SessionEnd` group** (+8 other
  events) → the installer must **merge**, never create-or-clobber (slice 014-01
  AC4). See `## Assumptions` A1 for the resolved record.

## Assumptions

Load-bearing claims about surfaces this repo **cannot** probe (external Claude
Code contracts). Each is marked; slices that depend on one carry `frame_review`.

- **A1 — RESOLVED (verified 2026-08-18), not an open assumption.** The
  `SessionEnd` hook payload **does** expose the session cwd on stdin, so
  014-01's cwd → `project.path` mapping is sound; the hook runs a Node script and
  registers in `~/.claude/settings.json` under `hooks.SessionEnd`. Trigger is
  **`SessionEnd`** (once per session), **not `Stop`** (per-turn). Verified via
  the Claude Code hooks docs + a local `settings.json` probe (see `## Current
  state`). The only residual: exact field names / the ~1.5s timeout budget can
  drift by Claude Code version, so 014-01's first task **re-confirms them against
  the installed version** before writing the hook — a cheap re-probe, not an open
  design risk.
- **A2 — Session end is a reasonable capture trigger cadence.** We assume
  real usage produces session ends spaced enough that the 014-02 spacing rule
  yields a useful `progress(t)` series (not all clustered in one burst). The
  git-backfill seed (013-01) is the complement for sparse forward history.
- **A3 — Historical cost is reconstructable at read time.** Velocity from
  `git log` is known-reconstructable (fully historical); the open half is cost —
  we assume it can be bucketed by time window from the timestamped transcripts
  `src/cost.mjs` already reads, without a persisted per-snapshot value. This is
  what makes 014-03's settled "recompute both" viable; confirmed as 014-03's
  first task. (Cost *durability* after transcripts rotate is out of 014-03 — a
  triggered follow-up in `docs/refinement-todo.md`.)
- **A4 — A live-session signal source exists and is optional.** Slice 014-04
  assumes some local, read-only source reports which Gauge projects have an
  **active** Claude Code session right now (e.g. a session registry / lock /
  transcript-open heuristic). It must degrade cleanly to absent — the manager
  view never hard-depends on it (release Risk: thin-client coupling).

## Decomposition

SPIDR split into four vertical slices, one per committed release item. Spike is
**not** used as a standalone slice — the one genuine unknown (the hook payload,
A1) is a bounded first task **inside** 014-01, concluding in the same slice that
ships the hook, so it is not horizontal phasing.

- **014-01 — Session-stop capture hook + auto-installer** (Path: the automated
  capture path, alongside the existing manual `npm run collect`). The thin
  client: a `Stop`/`SessionEnd` hook that maps session cwd → project and writes
  one snapshot; an installer that auto-registers it in `~/.claude/settings.json`
  (idempotent, backs up, reversible — owner chose auto-write).
- **014-02 — Accrual spacing rule → real RAG lights** (Rules: the
  simple-first rule that turns dense session-stop captures into a valid spaced
  series). A minimum-interval/dedup rule so N session-ends near in time do not
  bloat history or distort observed pace; the payoff is a worked project's card
  going gray → green/amber on **captured** (not just backfilled) history.
- **014-03 — History-derived velocity + cost trends** (Data: a new time-series
  view over the accrued series, vs. today's point-in-time value). A velocity
  trend and a cost trend on the card, read from the accrued observation window.
  **Source decision settled (owner, 2026-08-18): recompute both**, persist
  neither in this slice — velocity from `git log` (durable source; never
  persisted, so it can't disagree with git after a rebase), cost from timestamped
  transcripts (works while transcripts survive). No schema change, no ADR. Cost
  *durability* once transcripts age out is a triggered follow-up in
  `docs/refinement-todo.md`, not committed here.
- **014-04 — Live-session "running now" enrichment (optional)** (Interface: an
  optional extra signal channel that degrades cleanly). A "running now" indicator
  and an in-flight enrichment sourced from live-session data (A4), present when
  available and absent-safe when not — the seam to the engineer daily-driver.

Dependency order: 014-01 → 014-02 → 014-03; 014-04 is independent of the trend
slices (needs only the read layer) and is the natural **cutline candidate** if
the 08-28 deadline tightens, though the owner committed all four.

## Slices

- [014-01 — session-stop capture hook + auto-installer](slice-01-session-stop-capture-hook.md)
- [014-02 — accrual spacing rule lights real RAG](slice-02-accrual-spacing-real-rag.md)
- [014-03 — history-derived velocity + cost trends](slice-03-history-derived-trends.md)
- [014-04 — live-session "running now" enrichment](slice-04-live-session-enrichment.md)
