---
status: DRAFT
skill:
use_cases: []
---

# Spec 012: Portfolio-manager analytics

> Reserved on 2026-08-07 via `workflow.py new`. Opens with a research spike
> (slice 012-01); downstream slices are shaped after the spike + the dashboard
> redesign direction settle.

## Overview

A manager wants, across all their team's projects, a fast read on: **progress on
the active milestone(s)**, **what's next**, **velocity + on-track-ness**,
**token cost so far**, and an **overall RAG status** (green / yellow / red /
gray-stale). This spec explores and then builds a portfolio-manager analytics
layer over **local data**, and reframes the dashboard from a single card grid
into a layered information architecture (portfolio glance → project card →
project detail) so the richer metrics have a home without overloading the card.

This is broader than [spec 011](../011-milestone-centric-cards/spec.md) (the
milestone-centric *card*): spec 011's card becomes the middle tier of this
architecture. Whether 011 lands independently or folds into this redesign is a
decision to make after the spike.

## Scope boundary — manager lens (this), not the engineer daily-driver

Gauge is the **manager / portfolio lens**: zoom **out**, breadth, decision.
Cross-project comparison, **milestone-level** (never slices), goals / deadlines /
RAG / forecast, aggregate spend / velocity / PR-backlog, attention ranking. It
owns a **shallow project detail tier** (cost by model/activity, velocity trend,
open-PR list, worktrees) but **stops before slices, active sessions, and task
management** — that granular, current-work depth is the **engineer daily-driver**
view, owned by complementary tooling and deliberately *not* rebuilt here.

Consequences of the line (owner decisions):
- **Progress is milestone-scoped**, never the full history: a 122-spec project
  shows only its active track's handful, not specs 1–60.
- **One deliberate depth exception: token/cost analytics.** Spend is worth the
  depth, so it goes all the way to **by-model, by-activity, and by-skill** (below)
  even though everything else stays shallow.
- The engineer daily-driver (slice/session-level, current work) is a separate,
  complementary tool; Gauge may link to it but must not duplicate it.

## Manager-metrics catalog

Feasibility tags: **L** = local now (git/transcripts) · **J** = join of sources
· **H** = optional `gh` · **G** = needs curated goal/deadline · **T** = accrues
over time (history).

| Metric | Source | Tag |
|---|---|---|
| Active milestone(s) + progress | release plans (Status) + referenced specs | L |
| Next workstream | release plans (candidate) | L |
| Velocity (commit cadence) | git | L |
| Delivery throughput / cycle time | git history of spec status | L·T |
| Token cost — total per project | Claude Code transcripts | L |
| Token cost — by model | transcripts | L |
| Token cost — by activity (review / impl / plan) | transcripts × jig `[jig:phase=…]` tags | J |
| Token cost — by skill | transcripts × skill invocations | J |
| Cost trend / cost-per-shipped-unit | transcripts × git | J |
| Time spent (engaged) per project | transcript session wall-clock, idle-gap-capped | L (fuzzy) |
| Overall RAG status | forecast (pace vs deadline) | G |
| On-track per milestone | pace vs milestone appetite/deadline | G |
| Risk drivers (why yellow/red) | forecast reason strings | G·J |
| Attention queue (who needs me + why) | derive.mjs (ADR-0013) | G |
| WIP (too much in flight) | in-progress specs + active worktrees | L |
| Aging / stuck work | worktree lifecycle (ADR-0015) + git | L |
| Contributors / bus factor | git authors | L |
| Human-vs-agent split | git `Co-Authored-By: Claude` ratio | L |
| Review backlog (open PRs, time-in-review) | `gh` | H |
| Freshness / last observed | git + collection recency | L |

## Data-availability audit (2026-08-07, probed against the live portfolio)

> Qualitative only. Per-project figures were probed in-session but are **not
> recorded here** — this repo is public and portfolio spend/velocity is
> sensitive (project CLAUDE.md). The findings below are what generalize.

- **Milestones:** only a minority of projects carry release plans with a
  `## Status`; **most fall back** to overall spec progress. The fallback path is
  the common case and must be first-class.
- **Goal set:** curated for most projects; a few have none.
- **Deadline set:** **none of the projects has a deadline** → the entire RAG /
  on-track / forecast / risk-driver layer is dark portfolio-wide. This is the
  single highest-leverage input to populate.
- **Velocity (git):** available for every project and differentiated by orders
  of magnitude (a small solo repo vs a large shared one).
- **Human-vs-agent split:** available and differentiated (single digits to ~80%
  agent-coauthored across the portfolio).
- **Token cost:** available and rich from Claude Code transcripts
  (`~/.claude/projects`) — per-message `input/output/cache` tokens + model, ~3
  months deep, aggregatable per project; cost = tokens × per-model pricing.
- **Contributors / bus factor:** available (solo up to large shared teams).

**Verdict:** the raw layer (velocity, cost, team, milestones-where-present) is
available **now**; the RAG/forecast layer is entirely gated on **deadlines**,
which no project has. The blocker is a curated input, not data access.

## Design reference

The owner-approved layout and palette are locked in
[design/manager-dashboard-mockup.html](design/manager-dashboard-mockup.html)
(static, **illustrative data only** — genericized project names and figures).
Key decisions it encodes: no page-level aggregate (heterogeneous projects don't
sum meaningfully); each card leads with a RAG **status callout** (colored left
border + headline + ⚠ tooltip); **worst-first ordering** replaces a separate
attention block; a **cards ↔ table** toggle (table is comparison-first,
sortable); a stat row of always-available signals (velocity sparkline · token
cost · agent %); and a **cool-neutral palette** replacing the current board's
warm theme.

## Assumptions

- Token/cost is sourced from **Claude Code's own transcripts**, outside the
  source repos — architecturally a new local telemetry source, not the
  observation loop. Path→project mapping is imperfect (temp/probe paths,
  worktrees at odd roots, some projects with no mapped sessions), and cost needs
  a per-model pricing table including non-Anthropic/local models.
- Gauge's **native** pace metric needs collection history to accrue (only one
  observation snapshot exists today); git commit cadence is the immediate proxy.
- `Co-Authored-By: Claude` as the human-vs-agent proxy assumes that trailer is
  used consistently; it undercounts other agent tooling.

## Decomposition

_TBD — shaped after the spike concludes and the redesign direction (below) is
chosen. Likely axes: **Interface** (portfolio glance / card / detail tiers),
**Data** (token-cost adapter, git-velocity deriver), **Rules** (RAG thresholds
once deadlines exist)._

## Slices

- [012-01 — feasibility spike: what local data supports which metrics](slice-01-feasibility-spike.md)
