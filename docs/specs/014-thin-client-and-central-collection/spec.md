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
- **The hook mechanism exists.** Claude Code hooks fire in this environment
  (SessionStart, UserPromptSubmit observed). The specific `Stop`/`SessionEnd`
  payload — whether it hands the hook the session's working directory — is an
  **external contract** not verifiable from this repo; see `## Assumptions` A1.

## Assumptions

Load-bearing claims about surfaces this repo **cannot** probe (external Claude
Code contracts). Each is marked; slices that depend on one carry `frame_review`.

- **A1 — Stop/SessionEnd hook payload exposes the session working directory.**
  Slice 014-01 maps a finished session to a configured Gauge project by matching
  the session's cwd against `project.path`. This assumes the `Stop`/`SessionEnd`
  hook provides the cwd (or a resolvable project path) and can invoke a Node
  script. If it does not, 014-01's mapping needs an alternate key (env var,
  explicit per-project hook arg) — the slice's first task **verifies the payload
  before building on it** (grounding-by-probe against the real hook).
- **A2 — Session end is a reasonable capture trigger cadence.** We assume
  real usage produces session ends spaced enough that the 014-02 spacing rule
  yields a useful `progress(t)` series (not all clustered in one burst). The
  git-backfill seed (013-01) is the complement for sparse forward history.
- **A3 — Historical velocity/cost are reconstructable at read time.** Velocity
  derives from `git log` (fully historical) and cost from timestamped Claude Code
  transcripts (`src/cost.mjs`, per-request timestamps). We assume both can be
  bucketed by time window without a persisted per-snapshot value — making the
  014-03 "recompute" option viable. To be confirmed as 014-03's first task.
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
  **Open decision** (resolve as the slice's first task): *recompute* each metric
  historically (A3) vs. *persist* it into each snapshot going forward. Prefer
  recompute if A3 holds (no schema change, works over backfilled history too);
  fall back to forward-persist only for a metric that cannot be reconstructed. A
  schema change to the observation contract would be load-bearing → ADR.
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
