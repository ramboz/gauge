---
status: IN_PROGRESS
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
- **Token counting must dedup at per-request grain (developer-view finding).**
  Naive summing of `usage` across session logs **overcounts by up to ~3.4×** —
  running totals repeat per record and resumed sessions replay earlier history,
  so the same request appears many times. The spike's absolute figures were
  computed this naive way and are therefore **inflated**; the by-model/activity/
  skill slice must key on a unique request id and dedup globally across session
  files. Feasibility is unchanged; the *method* is not.

## Alignment with the developer-view sibling (open questions)

A developer-view sibling project (right-now / slice / session triage — the
engineer daily-driver Gauge deliberately does not rebuild) shared its brainstorm.
Both views converged on triage-not-report, glance/detail, current-track scoping,
analytics-in-a-detail-tier, and derive-never-ask. Owner decisions on the ideas
flagged as transferable:

- **RAG kept; who-acts-next replaced by concrete attention counts (revised).**
  The four-state who-acts-next model was **over-engineered** — deciding
  "waiting on you vs the AI" needs interpretation, which fights derive-never-ask.
  Replaced by a **countable attention row** on each card, all derivable facts:
  **PRs awaiting merge** (`gh`: open · not-draft · mergeable/approved),
  **specs in flight** (IN_PROGRESS specs ∪ feature-branch worktrees ∪ draft PRs;
  optional live-session enrichment from the developer-view thin client), and
  **blockers**. **RAG stays** as the per-card health chip; cards **order by the
  actionable counts** (PRs-to-merge + blockers first). This is finish-first made
  countable, and each count drills down in the detail tier.
- **Blockers — approximate now, first-class concept filed upstream.** jig has no
  first-class blocker concept; v1 renders an **approximate, labelled** count from
  proxies (`DEFERRED`+resolution-trigger, refinement-todo deferred decisions,
  unmet `dependencies:`, legacy narrative blockers). A clean concept is tracked
  in jig **spec 108 — first-class blockers** (proposes a `Blocked:` /
  `blocked_by:` convention); the count sharpens once that lands.
- **People dimension — deferred.** Stay **project-centric** initially; a people
  axis (who is overloaded / blocked) is kept as a future extension, not v1.
- **Shared invented sample dataset — adopted.** Design both views against the
  sibling's 8-project fictional world (Trailhead, Verdant, Beacon, Ledger,
  Cartographer, Almanac, Semaphore, Kestrel), projected into Gauge's manager
  shape (RAG · who-acts-next · milestone/fallback · velocity · cost · agent).
  Keeps the sibling views coherent and real portfolio data out of the public
  repo.

Still open (not yet decided): **finish-first ordering** (near-done-but-stuck
above new starts) and **WIP-as-attention-debt** — both fit within the
who-acts-next ordering and are candidates for how the 🔴/🟢 groups sort
internally.
- Gauge's **native** pace metric needs collection history to accrue (only one
  observation snapshot exists today); git commit cadence is the immediate proxy.
- `Co-Authored-By: Claude` as the human-vs-agent proxy assumes that trailer is
  used consistently; it undercounts other agent tooling.

## Decomposition

SPIDR, shaped after the spike (012-01) concluded and the owner fixed the redesign
direction (2026-08-10): **spec 011's milestone card lands standalone; 012's
analytics layer is layered into that card incrementally** — no from-scratch
glance→card→detail rebuild. So the near-term slices are **Data** (derivers) and
**Rules** (RAG), each layered onto 011's existing card, with the deeper cost cut
demoted to a detail tier rather than a new Interface shell.

- **Data** derivers, each cleared by the spike to build now (no deadline needed):
  012-02 (git-velocity deriver), 012-03 (token-cost adapter — total + by-model,
  deduped per-request), 012-05 (team signals — agent split + contributors).
- **Data (detail tier)**: 012-04 (cost by-activity + by-skill — the depth
  exception's deeper cut, off the card face).
- **Rules**: 012-06 (RAG chip from pace-vs-deadline), deadline-gated — gray until
  the Gauge deadline lands, then real.

Ordering: 02 (velocity) → 03 (cost total/by-model) → 04 (cost detail) → 05 (team)
→ 06 (RAG). 04 depends on 03; 06 depends on 02 (pace proxy) and the curated
deadline. Each raw-layer slice is independently shippable and degrades to
`unknown` honestly before the next lands.

## Slices

- [012-01 — feasibility spike: what local data supports which metrics](slice-01-feasibility-spike.md)
- [012-02 — git velocity on the card](slice-02-git-velocity.md)
- [012-03 — token cost: total + by-model](slice-03-token-cost-total-by-model.md)
- [012-04 — token cost: by-activity + by-skill](slice-04-token-cost-by-activity-skill.md)
- [012-05 — team signals: human-vs-agent split + contributors](slice-05-team-signals.md)
- [012-06 — RAG health chip (deadline-gated)](slice-06-rag-health-chip.md)
