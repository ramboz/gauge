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

- **Central data collection.** Accrue the observation history the derivation
  layer already reads (`readObservationHistory`), via repeated/scheduled
  `npm run collect` runs — reaching the ≥2-spaced-observations bar so the
  forecast produces real `on_track` / `at_risk` and the RAG layer lights up.
  Unlocks history-derived **velocity trend**, **native pace**, and **cost
  trend** over time.
- **Thin-client live-session signals.** Consume the developer-view thin client's
  per-project active-session data as an *optional enrichment* to the
  "specs in flight" count and a "running now" indicator — the seam between the
  manager view (this) and the engineer daily-driver (thin client). Optional and
  degrading: absent it, "in flight" still derives from branches/worktrees/draft
  PRs.

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
