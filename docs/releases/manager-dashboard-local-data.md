# Release Plan: Gauge — Manager Dashboard (local data)

## Status

`committed`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Appetite

- **Deadline: 2026-08-14.** Finish the milestone-centric manager dashboard on
  **local data only** (git, Claude Code transcripts, `gh`) — no central
  collection, no thin-client dependency.
- Fixed constraints: read-only sources; illustrative/sanitized data only in the
  public repo; every figure derived from real artifacts (derive-never-ask);
  `unknown` stays explicit (RAG will read `unknown` while history is thin — see
  Risks).

## Problem / Baseline

The board is a generic per-project scan. This release delivers the owner-approved
manager/portfolio lens (design reference:
[spec 012 mockup](../specs/012-portfolio-manager-analytics/design/manager-dashboard-mockup.html)):
milestone-centric cards, a RAG health chip, and countable attention — all from
data already on disk, so it ships without waiting on the collection/thin-client
work (which is the next release).

## Solution Outline

- **[Spec 011 — milestone-centric cards](../specs/011-milestone-centric-cards/spec.md):**
  active/next milestone from release `Status`, milestone-scoped progress from
  referenced specs, fallback for projects without release plans, warnings → ⚠
  icon, worktrees/PRs mapped to milestones.
- **[Spec 012 — portfolio-manager analytics](../specs/012-portfolio-manager-analytics/spec.md)
  (local-data cuts):** RAG health chip; git velocity; **token cost by
  model/activity/skill** (per-request-deduped); the **attention-counts row**
  (PRs-to-merge via `gh` · specs-in-flight · blockers *approximate*); cards ↔
  table; worst/attention-first ordering; the cool-neutral palette.

## Cutline

### Include
| Item | Why |
|---|---|
| Milestone card + fallback (spec 011) | The core reframe; ships on local data. |
| RAG health chip (kept) + attention counts (replaces who-acts-next) | The two triage axes, both derivable locally. |
| Token cost by model/activity/skill, deduped | The deliberate depth exception; local transcripts. |
| Velocity, PR-backlog, worktree hygiene | All local (git + `gh`). |

### Defer
| Item | To |
|---|---|
| Central data collection + history-derived pace | Next release (2026-08-28). |
| Thin-client live-session signals | Next release. |
| First-class blockers (clean count) | jig spec 108 (upstream); count stays approximate here. |
| RAG lit to on_track/at_risk (real values) | Two paths: an **optional git-backfill seed** (reconstruct `progress(t)` from commit history — instant past, the "takes a bit longer" local work) as a stretch here, else it accrues via the thin client's session-stop capture next release. The RAG *affordance* ships now; it reads honest `unknown` until either path provides ≥2 spaced observations. |

## Risks / Rabbit Holes

- **Thin history → RAG `unknown`.** The forecast needs ≥2 spaced observations;
  with one snapshot it reads `unknown (insufficient-history)` even with a
  deadline set. That is correct and honest, not a bug. The data exists (git holds
  the full `progress(t)` series), so this is a *code* gate, not a data one —
  retire it either by the optional git-backfill seed here or by the thin client's
  session-stop capture next release. Keep `unknown` explicit meanwhile; never
  fake green.
- **Token overcount.** Naive summing overcounts up to ~3.4×; must dedup at
  per-request grain (spec 012 assumption).
- **Public-repo leakage.** Real portfolio figures must never be committed; keep
  the design reference on illustrative data.

## No-Gos

- No central/scheduled collection, no thin-client dependency, no engineer
  daily-driver depth (slices/sessions/tasks), no people dimension.

## Release-Check Criteria

- Cards render milestone-or-fallback with milestone-scoped progress; the
  attention row and RAG chip are both present and derived from local data; token
  cost is deduped; nothing on the public board exposes real portfolio figures.
