> Status: Active (reframed 2026-07-13 by
> [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)).
>
> Captures what Gauge is, for whom, and why. Technical mechanics live in
> [architecture.md](architecture.md); release boundaries live in
> [releases/](releases/).

# Vision: Gauge

## Identity

- **Vision:** a private cross-project dashboard that shows how each project is
  advancing toward its goal, whether deadlines are likely to hold, and what
  deserves attention next.
- **Tagline:** Gauge — know where every project stands and where to focus next.
- **Relationship to sibling tools:** Jig owns daily engineering execution,
  Shaper owns release shaping inside a project, and Servo owns
  evaluation-driven development evidence. Gauge aggregates their optional
  signals alongside generic project sources without depending on any of them.

## Target users

- **MVP:** one person running several independent software projects.
- **Follow-up:** a small trusted group authenticated through one configured
  GitHub organization team.
- **Long term:** teams and organizations with richer portfolio policy,
  multi-repository projects, and concurrent goals.

Gauge is not a replacement for project-local planning or lifecycle tools. It
is the portfolio view over them.

## Core problem

Goals, deadlines, implementation state, decisions, blockers, and next actions
live in different repositories and tools. Each project can be internally
coherent while the person responsible for several projects still cannot answer:

- Which projects are on track?
- Which deadlines are becoming risky?
- What changed since yesterday?
- Which implementation task, decision, draft, or blocker needs attention next?

Manual portfolio boards duplicate source state and quickly become stale. Gauge
derives an explainable daily view from project-owned evidence instead.

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
3. Collect generic GitHub milestone and optional Jig execution evidence.
4. Store dated observations in the private central Gauge instance.
5. Show progress, freshness, blockers, deadline confidence, and next action per
   project.
6. Show an explainable global attention queue.

Visual polish, extra progress strategies, advanced prediction, and historical
analysis beyond retaining daily observations are variable scope. The fixed
cutline lives in
[local-portfolio-loop.md](releases/local-portfolio-loop.md).

## Follow-up direction

1. **Secure small-team hosting:** GitHub App sign-in for one owner and one
   configured organization team, with server-side membership authorization.
2. **Multi-source signals:** optional Shaper and Servo adapters, history-derived
   views, and bounded project-specific metrics.

Multi-repository projects, concurrent goals, organization-wide roles, source
write-back, and automated lifecycle transitions remain outside these releases.

## Design principles

1. **Read-only sources.** Collection never mutates surveyed repositories.
2. **Deterministic and explainable.** Every progress, risk, and recommendation
   links to evidence, collection time, and policy.
3. **Graceful degradation.** An uninstrumented project is still valid; missing
   signals are unavailable or unknown, not failed.
4. **Central history, project-owned intent.** Observations live in Gauge while
   goals and deadlines remain in projects.
5. **Private by construction.** The MVP binds locally; hosted access requires
   real authentication and authorization, never an unguessable URL.
6. **No composite-health fiction.** Delivery progress, scope readiness, and
   evaluation quality remain distinct typed signals.

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
[refinement-todo.md](refinement-todo.md). The most important are the normalized
observation contract, goal/deadline source precedence, minimum forecast
confidence, and the smallest useful portfolio-priority overlay.
