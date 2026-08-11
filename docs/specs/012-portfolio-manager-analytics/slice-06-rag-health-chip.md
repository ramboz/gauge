---
status: DONE
dependencies: [012-02]
last_verified: 2026-08-11
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
- [x] All ACs pass; full suite green (no regressions). — 431/431.
- [x] Tests cover: each forecast→band mapping, no-deadline→gray+reason,
      deadline→real band, tooltip reason wiring, and the worst-first sort key.
- [x] Each new test shown to fail when the feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-06-compliance.md`, `reviews/slice-06-craft.md`); compliance
      returned needs-changes on the first pass (unconditional ⚠) and PASS on
      re-review after the gating fix.
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed. — see below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **Render-only change in `public/index.html`; reuses the existing forecast layer.**
  Pure `forecastToRag(forecast)` → `green|yellow|red|gray` reads the already-attached
  `p.forecast` (from `deriveForecast`/`attachForecasts`, spec 009-02) — it never
  re-derives. Documented reason→band rule: `on_track → green`; `at_risk` →
  `yellow` for `pace-behind-required` (behind but recoverable), `red` for
  `deadline-passed`/`no-forward-progress` (and any other/future `at_risk` reason —
  red is the safer default); `unknown`/absent/malformed → `gray` (never
  green-by-default). `ragReasonText` maps all 10 ADR-0012 reason codes to short
  phrases (raw reason as an escaped fallback). Callout = colored `.card.rag-*`
  left border + `rag-headline` + a keyboard-reachable ⚠ tooltip, as the card's
  leading element (per the mockup). `ragSortKey` (built on `forecastToRag`) applies
  a stable worst-first sort (red<yellow<gray<green) in `load()`.
- **Compliance blocker fixed (needs-changes → pass).** The ⚠ was initially rendered
  on **every** card, including a healthy green `on_track` card — semantically wrong
  (AC3's ⚠ carries a *risk* reason) and against 011-04's "⚠ only when something to
  report" convention. **Fix:** the ⚠ is gated on `band !== 'green'` — green shows
  only border + headline; yellow/red/gray keep the ⚠. Added the decisive invariant
  tests (green → no `rag-flag`; non-green → has it), scoped via `ragCalloutMarkup`
  so the unrelated 011-04 `warn-icon` can't cross-contaminate.
- **011-04 clean-project test amended (intentional convention refinement).** A
  fully-clean project with no `forecast` reads `gray` ("no forecast available"),
  which legitimately carries a RAG ⚠ — so the old blanket `doesNotMatch(html, /⚠/)`
  was narrowed to the 011-04 `warn-icon` (its actual subject). Consistent with
  AC2/AC3 (gray = "something to report: needs a deadline"), not a regression.
- **009-02's `forecastBlock` left unchanged.** The RAG callout is additive; the
  existing `forecast: <state> <reason>` chip and its tests are untouched.
- **Deadline-gated / dogfood (AC2/AC6).** With no curated deadline the forecast is
  `{state:'unknown', reason:'deadline-unknown'}` → gray "needs a deadline set". The
  AC6 "lights up" path is proven by a test running a fixture history + deadline
  through the **real** `deriveForecast` → `on_track` → green end-to-end; **no
  deadline is fabricated in committed data** (per the Resolution note — the real
  Gauge deadline is gitignored onboarding config the owner sets separately).
- **Accepted/logged nits (craft, non-blocking).** (a) The grid-level worst-first
  `.sort()` in `load()` has no rendered-order test (AC5's "full ordering may land
  with the card-grid work" carve-out; `ragSortKey` itself is unit-tested). (b) The
  `cleanProject` test fixture has no forecast so it models a gray card, not the real
  green path. (c) `ragCalloutMarkup`'s test regex assumes the callout has no nested
  `<div>` — documented latent brittleness.

### Reconciliation sweep

- **`docs/architecture.md`** → **no-op**: no new contract surface — `forecastToRag`
  reads the existing `p.forecast` join (009-02, already documented) and renders it;
  no `/api/data` field added.
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE; spec
  012 rolls up to DONE with this slice).
- **`CLAUDE.md` hot cache** → **updated (spec-close primer hygiene, spec 025 rule)**:
  spec 012 is now fully DONE (spike + all five raw-layer/RAG slices landed); the
  Hot Cache "active build" line moves 012 from in-flight-drafted to landed, naming
  the shipped analytics (velocity, token cost by model/activity/skill, team,
  RAG chip) and the deadline-gated dogfood.
- **`schemas/observation-v1.schema.json`** → **no-op**: render-only, no observation
  field.
- **`docs/memory/glossary.md`** → **no-op**: RAG/forecast terms already defined
  (ADR-0012, manager-metrics catalog).
- **`docs/decisions/lightweight-decisions.md`** → **deferred (nudge)**: the RAG
  band colors + reason-phrase copy are UI choices; the reason→band threshold
  (yellow vs red) is a documented derivation rule in-code, arguably decision-content
  — but it follows directly from ADR-0012's existing `at_risk` reason vocabulary
  rather than introducing a new load-bearing choice, so it is recorded here rather
  than promoted to an ADR. Revisit if a future forecast model adds intermediate
  states.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.

**Resolution note:** raw-layer slices (012-02..05) proceed independently; this
slice's *real* (non-gray) output is contingent on the Gauge deadline being written
into onboarding config. It can be built and merged with gray-until-deadline
behavior first, then verified green once the deadline lands.
