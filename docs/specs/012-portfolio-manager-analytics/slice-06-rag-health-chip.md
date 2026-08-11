---
status: DRAFT
dependencies: [012-02]
last_verified:
---

## Slice 012-06 — RAG health chip (deadline-gated)

**Goal:** Each project card leads with a **RAG status callout** — green / yellow /
red / gray-stale — derived from pace-vs-deadline via the existing `deriveForecast`
(ADR-0012), rendered as the mockup's colored left-border + headline + ⚠ tooltip.
Because no project carries a curated deadline today, the chip reads **gray/unknown
portfolio-wide until a deadline exists**; the owner is setting one on Gauge
(spike 012-01 outcome), which lights up the first real RAG card.

**DoR:**
- ✅ Spike 012-01 concluded the RAG/forecast layer is gated solely on a curated
  deadline input; `deriveForecast` already maps evidence → `on_track` / `at_risk`
  / `unknown` (ADR-0012), and `attentionQueue` (ADR-0013) consumes it.
- ✅ Owner decision (2026-08-10): set a curated deadline on Gauge (committed
  release appetite 2026-08-14) so goal+deadline+milestone+progress+RAG exercise
  together on one dogfooded card.
- ⚠ **Assumption:** velocity/pace signal from 012-02 (or Gauge's own accruing
  history) feeds the forecast; until history accrues, git cadence is the proxy.

**Acceptance Criteria:**

1. **RAG mapping.** A pure mapping turns a project's forecast state into a RAG
   band: `on_track → green`, `at_risk → red` (or yellow per a documented
   threshold), `unknown`/stale → gray. The threshold rationale is documented, not
   magic.
2. **Deadline-gated, honest.** With no curated deadline the chip is **gray with an
   explicit "needs a deadline set" reason**, never green-by-default and never a
   fabricated forecast. A project with a deadline shows a real band.
3. **Card callout render.** The chip renders as the mockup's status callout:
   colored left border + one-line headline + a ⚠ hover tooltip carrying the risk
   reason string(s). Matches the design reference
   (`design/manager-dashboard-mockup.html`).
4. **Reason strings surfaced.** The forecast reason (why yellow/red/gray) is shown
   in the tooltip, sourced from `deriveForecast`'s reason output — no invented
   copy.
5. **Worst-first ordering hook.** The RAG band exposes a sort key so cards can be
   ordered worst-first (red → yellow → gray → green), per the mockup's
   attention-first layout (full ordering may land with the card-grid work).
6. **Gauge lights up.** With the Gauge deadline set, Gauge's card renders a real
   (non-gray) RAG band end-to-end — the dogfood acceptance from the spike outcome.

**DoD:**
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: each forecast→band mapping, no-deadline→gray+reason,
      deadline→real band, tooltip reason wiring, and the worst-first sort key.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.

**Resolution note:** raw-layer slices (012-02..05) proceed independently; this
slice's *real* (non-gray) output is contingent on the Gauge deadline being written
into onboarding config. It can be built and merged with gray-until-deadline
behavior first, then verified green once the deadline lands.
