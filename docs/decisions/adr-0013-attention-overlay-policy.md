---
status: Accepted
dependencies: [adr-0003, adr-0006, adr-0012]
last_verified: 2026-08-05
frame_review: true
---

# ADR-0013: Cross-project attention-overlay policy for the global queue

## Status

Accepted (2026-08-05)

## Context

Spec 009-03 builds the **global attention queue** — a single cross-project
ordering that answers "which project deserves attention next, and why" — in the
history-derived layer, downstream of forecast/risk ([ADR-0006](adr-0006-two-layer-derivation.md)).
Before it can be built, one policy must be decided: **the smallest central rule
that expresses portfolio attention without duplicating project-local priority.**
This is the "Cross-project attention overlay" item in `docs/refinement-todo.md`.

Two hard constraints from the product frame:

- **Authority model (product-vision, ADR-0003).** The queue expresses
  cross-project *attention order*; it must never become a rewrite of any
  project's own local priorities. A policy that asks the user to hand-rank
  projects would re-implement project-local priority at the center — the exact
  authority drift the product forbids.
- **No false comparability (product-vision).** Work units are not comparable
  across projects; the queue must not pretend project A's "40% done" outranks
  project B's "60% done." Ordering must come from *attention-need* signals, not
  from a manufactured cross-project importance score.

Verified inputs available to the ordering (per-project, from the current
checkout). The queue orders on the **derived** forecast read (ADR-0006, downstream
of forecast/risk), not on raw signals:

- **Forecast/risk state + reason** — `on_track` / `at_risk` / `unknown` plus
  exactly one ADR-0012 reason, from the 009-02 derivation. This is the primary
  tiering input. In particular `stale-evidence` already encodes "latest execution
  reading is not fresh" — which means the **source repo has gone quiet**
  (`freshness = gitFreshness(lastCommit, collectedAt)`, `src/observation.mjs`), a
  *repository-activity* proxy. It is **not** a Gauge collection-lapse signal (that
  would be `now − latest.collectedAt`, which nothing computes and which, under
  manual pull, is portfolio-wide rather than per-project anyway).
- **Deadline** — the profile's concrete date or `unknown` (009-01 / ADR-0011),
  used only as the within-tier ordering key.
- **Blockers (optional)** — the `narrative` signal's `blockers` text, present only
  when a legacy Compass narrative was scanned (not universal; used when available,
  never fabricated).

## Decision Options Considered

### Option A: User-assigned ordering (hand-ranked projects or tiers)
- **Pros:** directly captures the owner's intent; trivial to sort.
- **Cons:** re-implements project-local priority at the center — the authority-model
  no-go — and is not derivable, so it goes stale the moment priorities shift.
  Rejected.

### Option B: Single-factor sort (deadline proximity only)
- **Pros:** dead simple, fully deterministic, no comparability problem.
- **Cons:** ignores risk and staleness — an at-risk project with a far deadline
  would sort below a healthy one with a near deadline, burying the thing that most
  needs attention. Rejected as the whole rule (deadline is a good *within-tier*
  key, not the tier).

### Option C: Weighted numeric attention score across factors
- **Pros:** one number to sort by; tunable weights.
- **Cons:** a composite score pretends incomparable factors (risk, deadline,
  staleness) are commensurable and is hard to explain — "why is A above B?"
  becomes "because 0.62 > 0.58." That is the false precision the product forbids.
  Rejected.

### Option D (recommended): Derived, explained tiered lexicographic ordering
- **Pros:** tiers come from *attention-need* signals, not owner-assigned
  importance, so the authority boundary holds; within-tier ordering is deadline
  proximity (a real, comparable quantity); every position is explainable in words,
  not a score; fully deterministic. Small and honest.
- **Cons:** tie/edge placement (where `unknown` and `unknown`-deadline sort) must
  be stated explicitly rather than falling out of a number; the tier set is a
  judgment that may need one revision after real use.

## Recommended Decision

Adopt **Option D**. The attention queue is a **deterministic tiered lexicographic
ordering**, keyed on the **derived forecast/risk state and its ADR-0012 reason**
(never on owner-assigned importance, never on raw signals — the queue is downstream
of forecast/risk per ADR-0006). Within a tier, projects order by **deadline
proximity** (soonest concrete date first; `unknown` deadline sorts to the end of
its tier); ties break by a stable key (`project.id`).

The tiers **partition every project by mapping each ADR-0012 output to exactly one
tier**, so no project falls through:

1. **At risk** — forecast `at_risk`. The deadline is threatened; highest attention.
2. **Stale or stuck** — forecast `unknown` with reason `stale-evidence` (the latest
   execution reading is not fresh: the *source repo has gone quiet*, so the status
   is old and may not reflect reality), **or** an explicit `narrative` blocker is
   present. Attention means **verify** — the read can't be trusted at face value,
   or work is flagged stuck. (Deliberately *not* "re-collect": a quiet source stays
   `stale` on re-collection under manual pull; the remedy is a human look.)
3. **Needs owner input** — forecast `unknown` with reason `deadline-unknown` (no
   goal/deadline set) or `scope-changed` (delivery scope moved mid-window).
   Portfolio hygiene the owner can resolve.
4. **Awaiting evidence** — forecast `unknown` with reason `insufficient-history`
   (needs more collections over time) or `execution-unknown` (the adapter finds no
   recognized delivery status yet — may not be a delivery-tracked project). Low
   attention; nothing to do but keep collecting.
5. **On track** — forecast `on_track`. Healthy; least attention.

Precedence when a project could match more than one tier (e.g. `at_risk` *and* a
blocker) is **most-urgent-tier-wins**, implemented as a first-match top-down scan.
Because forecast is exactly one of `on_track`/`at_risk`/`unknown` and every
`unknown` carries exactly one of the five ADR-0012 reasons — each mapped above —
the mapping is total; the optional blocker only ever *raises* a project into tier 2,
never leaves one unplaced.

Every ranked entry carries a short **reason** (its tier label + the within-tier
key, e.g. "at risk · deadline in 3 days" or "needs a goal set"), so the queue is
read as explanation, not as an opaque rank. The ordering consumes **only** the
derived forecast/risk read (state + reason), the deadline, and (when present) the
blocker text; it takes the project-id set from the caller (registry-derived, per
ADR-0006), imports no adapter and not `src/scan.mjs`, and writes nothing.

The **tier definitions are the decision**; the exact reason wording and the
tie-break key are implementation detail. The tier *set* may be revised once after
real portfolio use (see Kill criteria) — a bounded revision, not a per-tuning
supersession.

## Consequences

**Becomes easier:**
- 009-03 implements a pure, deterministic sort over already-derived inputs; "why
  is A above B" is always answerable from the tier + deadline, never a score.
- The authority boundary is structural: no owner-ranking input exists to drift.

**Becomes harder:**
- The tier set is a fixed editorial judgment; a project that wants a different
  notion of "attention" (e.g. weighting a strategic project up) cannot express it
  without changing the policy — deliberately, to keep local priority out of the
  center.
- Edge placement (unknown vs. on_track ordering) is a stated rule that must be
  tested, not an emergent property of a number.

## Assumptions

- The tiers partition every project because they map ADR-0012's **complete
  output** to a tier: `at_risk`→1; `on_track`→5; and every `unknown` reason to
  exactly one of tiers 2–4 (`stale-evidence`→2; `deadline-unknown`,`scope-changed`
  →3; `insufficient-history`,`execution-unknown`→4). ADR-0012's five unknown
  reasons are all covered — including `execution-unknown`, the no-recognized-delivery
  case (`src/observation.mjs`) — so no project falls through. Precedence when a
  project matches multiple tiers is **most-urgent-tier-wins**, implemented
  first-match top-down. (If ADR-0012 ever adds a reason, this mapping must gain a
  tier for it — a bounded, review-visible change.)
- `narrative.value.blockers` (array of strings) is present only when a legacy
  Compass narrative was scanned (`src/observation.mjs`), so the tier-2 blocker
  trigger is best-effort: absent it, tier 2 rests solely on the `stale-evidence`
  forecast reason, never a fabricated blocker. (009-03 confirms the exact field.)

## Kill criteria

- If real portfolio use shows a tier is never populated or two tiers never need
  distinguishing, collapse them — a bounded tier-set revision.
- If users consistently want a *strategic* project surfaced above a mechanically
  more-urgent one, that is a genuine need for an owner-intent input; it would
  supersede this ADR's derived-only stance (and must be designed to not silently
  re-import project-local priority).

## Open questions

- Whether the queue shows all projects or only the top-N attention tiers is a
  009-03 presentation choice; this ADR fixes the ordering, not the cutoff.
- The precise `narrative` blocker field and whether repository-freshness or
  execution-freshness (or both) drives tier 2 are 009-03's to pin down against the
  observation shape.
