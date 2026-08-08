> Status: Active. Reframed 2026-07-13 by
> [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md), and
> sharpened 2026-08-07 by
> [ADR-0017](decisions/adr-0017-reframe-onto-manager-lens.md) (manager/portfolio
> lens; analytics scope; reconstructable/captured history).
>
> Captures what Gauge is, for whom, and why. Technical mechanics live in
> [architecture.md](architecture.md); release boundaries live in
> [releases/](releases/).

# Vision: Gauge

## Identity

- **Vision:** the **manager / portfolio lens** — a private, read-only view that
  shows, across all of a person's projects, how each is advancing toward its
  active milestone, whether it will hold, what it is costing, and what needs
  attention next. Zoom **out**: breadth, decision, trend.
- **Tagline:** Gauge — know where every project stands and where to focus next.
- **The line vs the engineer daily-driver.** Gauge is deliberately
  *complementary* to a separate **engineer daily-driver** dashboard (slice- and
  session-level, "what am I doing right now, in the code"). Gauge works at
  **milestone** granularity — never slices (a jig/SPIDR internal) — and owns a
  **shallow** project detail tier that stops before slices, active sessions, and
  task management. That inner depth belongs to the daily-driver; Gauge links to
  it, it does not rebuild it (ADR-0017).
- **Relationship to sibling tools:** Jig owns daily engineering execution,
  Shaper owns release shaping inside a project, and Servo owns
  evaluation-driven development evidence. Gauge aggregates their optional
  signals — and generic project sources (git, GitHub, Claude Code transcripts) —
  without depending on any of them.

## Target users

- **MVP:** one person overseeing several independent software projects — the
  portfolio owner, wearing the manager hat.
- **Follow-up:** a small trusted group authenticated through one configured
  GitHub organization team.
- **Long term:** teams and organizations with richer portfolio policy,
  multi-repository projects, and concurrent goals. A **people dimension** (who is
  overloaded / blocked) is a deferred extension; v1 is project-centric.

Gauge is not a replacement for project-local planning, lifecycle tools, or the
engineer daily-driver. It is the manager's portfolio view over them.

## Core problem

Goals, deadlines, implementation state, decisions, blockers, and next actions
live in different repositories and tools. Each project can be internally
coherent while the person responsible for several projects still cannot answer:

- Which projects are on track (RAG), and which deadlines are becoming risky?
- What changed since yesterday, and how fast is each project moving (velocity)?
- What is it costing — token spend, by model / activity / skill?
- What needs a hand next: PRs awaiting merge, work in flight, or blockers?

Manual portfolio boards duplicate source state and quickly become stale. Gauge
**derives** an explainable view from evidence the projects already produce
(*derive, never ask*) — and never asks a human to keep status up to date.

## Authority model

- Projects own goals, deadlines, local priorities, and lifecycle state.
- Gauge owns portfolio membership, central observations/history, forecasts,
  risk classifications, and cross-project attention policy.
- Gauge reads source projects without writing to them.
- A central priority overlay may rank attention, but it never rewrites a
  project's own priority or status.
- Missing dates or insufficient history remain `unknown`; Gauge does not invent
  precision.

## Committed MVP

The MVP has a maximum two-week appetite and delivers one complete local daily
portfolio loop:

1. Configure at least three single-repository projects.
2. Select one active source-owned goal for each project.
3. Author each project's goal and deadline into its profile via a curated
   onboarding step (ADR-0011), and collect optional Jig execution evidence. (The
   generic GitHub milestone adapter is deferred with hosted/GitHub-push
   collection.)
4. Store dated observations in the private central Gauge instance.
5. Show progress, freshness, blockers, deadline confidence, and next action per
   project.
6. Show an explainable global attention queue.

Visual polish, extra progress strategies, advanced prediction, and historical
analysis beyond retaining daily observations are variable scope. The fixed
cutline lives in
[local-portfolio-loop.md](releases/local-portfolio-loop.md).

## Near-term direction (the manager dashboard)

Two dated releases carry the manager-lens build (ADR-0017); cutlines live in
[releases/](releases/):

1. **[Manager Dashboard — local data](releases/manager-dashboard-local-data.md)**
   (committed, 2026-08-14): milestone-centric cards ([spec 011](specs/011-milestone-centric-cards/spec.md)),
   RAG health, the attention row (PRs-to-merge · in-flight · blockers), git
   velocity, and **token-cost analytics** by model / activity / skill — all from
   local data ([spec 012](specs/012-portfolio-manager-analytics/spec.md)).
2. **[Thin Client + Central Collection](releases/thin-client-and-central-collection.md)**
   (candidate, 2026-08-28): event-driven **session-stop capture** (the thin
   client), central aggregation, history-derived trends, and optional
   live-session enrichment.

## Later direction

1. **Secure small-team hosting:** GitHub App sign-in for one owner and one
   configured organization team, with server-side membership authorization.
2. **Multi-source signals:** optional Shaper and Servo adapters, richer
   history-derived views, and bounded project-specific metrics.

Multi-repository projects, concurrent goals, a people dimension, organization-wide
roles, source write-back, and automated lifecycle transitions remain outside
these releases. Slice-, session-, and task-level depth is the engineer
daily-driver's job, not Gauge's.

## Design principles

1. **Read-only observer.** Gauge reads and derives; it never mutates surveyed
   repositories, and it never captures on their behalf.
2. **Derive, never ask.** Every signal comes from evidence the projects already
   produce (git, GitHub, release plans, transcripts). No manual status entry —
   status that must be reported by hand rots.
3. **Deterministic and explainable.** Every progress, risk, cost, and
   recommendation links to evidence, collection time, and policy.
4. **Graceful degradation.** An uninstrumented project is still valid; missing
   signals are unavailable or `unknown`, never faked (no green without evidence).
5. **History is reconstructable *and* captured, project-owned intent.** The time
   series can be **reconstructed from git** (the past) and is **captured
   event-driven** by the thin client on session-stop (the future); Gauge reads
   the result. Goals and deadlines stay in the projects (ADR-0017, refining
   ADR-0006).
6. **Private by construction.** The MVP binds locally; hosted access requires
   real authentication and authorization, never an unguessable URL. Real
   portfolio figures never leave the machine into a public repo.
7. **No composite-health fiction.** Delivery progress, scope readiness,
   evaluation quality, and cost remain distinct typed signals.

## Success criteria

- Three real projects complete daily collection with no source-repository
  writes and with explicit provenance and freshness.
- Readable source dates produce confidence-aware risk; absent dates remain
  unknown.
- The attention queue explains its deterministic ordering without assuming
  project-local work units are comparable.
- The local server binds to loopback, committed observations contain no
  secrets, and the full test suite is green.

## Open product questions

Implementation-blocking decisions are tracked in
[refinement-todo.md](refinement-todo.md). The observation/history foundation is
accepted; the most important remaining questions are goal/deadline source
precedence, minimum forecast confidence, daily collection, and the smallest
useful portfolio-priority overlay.
