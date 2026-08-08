# Release Plan: Gauge — Thin Client + Central Collection

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Appetite

- **Deadline: 2026-08-28.** The follow-up to the local-data manager dashboard:
  add the moving parts that need *time* — accumulated history and live signals.
- Fixed constraints: preserve read-only sources and the local-first default;
  central collection stays private; scheduled collection is opt-in.

## Problem / Baseline

The [local-data release](manager-dashboard-local-data.md) ships the manager view
on point-in-time local data. Two things it deliberately defers need a time axis:
**history** (so pace/forecast/RAG become real, not `unknown`) and **live
signals** (so "in flight" reflects what is actually running now). This release
adds both.

## Solution Outline

- **Event-driven capture (thin client owns it).** Collection is **not** a manual
  or scheduled `npm run collect` — the thin client installs a **session-stop
  hook** (Claude Code `Stop`/`SessionEnd`) that writes an observation snapshot on
  **every session end**. This yields dense, forward history with no polling and
  no manual step (derive-never-ask). Gauge stays the read-only observer: it
  **reads** the resulting central history and derives — it does not capture.
- **Central data collection.** The captured snapshots accumulate centrally, past
  the ≥2-spaced-observations bar, so the forecast produces real `on_track` /
  `at_risk` (RAG lights up) and history-derived **velocity trend**, **native
  pace**, and **cost trend** render over time. Session-stop capture only records
  *going forward*; the retroactive **git-backfill seed** (see the local-data
  release) is the complement for existing/pre-thin-client history.
- **Thin-client live-session signals.** The same thin client also exposes
  per-project active-session data as an *optional enrichment* to "specs in
  flight" and a "running now" indicator — the seam to the engineer daily-driver.
  Optional and degrading: absent it, "in flight" still derives from
  branches/worktrees/draft PRs.

## Cutline

### Include
| Item | Why |
|---|---|
| Repeated/scheduled collection → history accrual | Turns RAG/forecast from `unknown` to real. |
| History-derived velocity trend + cost trend | The metrics that need a time axis. |
| Thin-client session-signal enrichment (optional) | Live "in flight / running now"; cross-tool seam. |

### Defer
| Item | To |
|---|---|
| Multi-source (Shaper/Servo) signals | [multi-source-portfolio](multi-source-portfolio.md). |
| People dimension | Future extension (owner decision — project-centric first). |
| First-class blockers | jig spec 108; adopt once it lands. |

## Risks / Rabbit Holes

- **Scheduling scope creep.** Keep collection a simple repeated pull; do not
  build a daemon/service before real usage warrants it.
- **Thin-client coupling.** The session-signal integration must stay optional and
  degrade cleanly — the manager view must not hard-depend on the engineer tool.
- **Forecast false precision.** Gate `on_track`/`at_risk` behind the existing
  minimum-history rule; below it, `unknown`.

## No-Gos

- No source-repo writes; no always-on GitHub polling by default; no engineer
  daily-driver depth.

## Release-Check Criteria

- After a short collection cadence, at least the actively-worked projects show a
  real (non-`unknown`) forecast/RAG; velocity/cost trends render over the
  accrued window; the thin-client enrichment is present when available and
  absent-safe when not.
