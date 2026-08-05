---
status: DRAFT
dependencies: [009-01, adr-0006]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020). -->

## Slice 009-02 — Forecast/risk derivation

**Goal:** For each project, gauge derives a **forecast/risk read** —
`on_track` / `at_risk` / `unknown` — by folding its observation **history**
(observed pace) against its authored **deadline** and current progress, in a new
history-derived module (`src/derive.mjs`) that imports only the history reader and
observation helpers ([ADR-0006](../../decisions/adr-0006-two-layer-derivation.md));
the project's card shows the read with its explanation, and returns `unknown`
honestly whenever the evidence is too thin to justify a colour.

**DoR:**
- ✅ 009-01 DONE (deadline is an authored profile input the derive layer can read).
- ✅ ADR-0006 accepted (derivation home = `src/derive.mjs`; imports only
  `readObservationHistory()` + observation helpers; never adapters/`scan.mjs`;
  never writes; envelope `collection.status` is never derivation evidence).
- ⛔ **Blocking decision — forecast minimum-evidence rule.** The
  "Forecast confidence" item in `docs/refinement-todo.md` (minimum date/history
  evidence required before `on_track`/`at_risk`, below which the only valid result
  is `unknown`) must be resolved before this slice goes
  `READY_FOR_IMPLEMENTATION`. Resolve it as a lightweight decision (or a small
  ADR if it proves load-bearing) validated against the reference corpus in
  `docs/inbox.md`. This DoR item is the gate; do not implement against a guessed
  threshold.

**Acceptance Criteria:**

1. **Dedicated history-derived module.** Forecast/risk lives in a new
   `src/derive.mjs` whose only observation input is `readObservationHistory()`
   (per-project) plus observation-contract helpers; it imports no adapter and not
   `src/scan.mjs`, and writes nothing. (Enumeration: an import check over
   `src/derive.mjs` shows the closed set of its imports.)
2. **Evidence-gated three-state output.** Each project resolves to exactly one of
   `on_track` / `at_risk` / `unknown`. `unknown` is returned — never a coerced
   colour — whenever the deadline is `unknown`, history has fewer than the
   decided minimum observations, or the execution signal is itself `unknown`
   (product-vision: unknown, not zero/healthy).
2a. **The decided minimum-evidence rule is applied verbatim.** The threshold and
   conditions resolved in the DoR decision are implemented exactly; the slice
   cites the decision record.
3. **Explained, deterministic read.** Every result carries a short machine-set
   reason (e.g. `deadline-unknown`, `insufficient-history`, `pace-behind-required`,
   `pace-meets-required`) so the card can explain *why*; the same inputs always
   yield the same result (no clock-of-the-moment nondeterminism beyond the
   observation timestamps themselves).
4. **Envelope status is not evidence.** `collection.status` (`ok`/`partial`/
   `error`) never influences the forecast/risk result (ADR-0006 reaffirmation);
   a partial collection with sufficient capability evidence can still derive a
   colour, and a green envelope with thin evidence still resolves `unknown`.
5. **The card shows the read.** Each project's card renders its forecast/risk
   state and reason; `unknown` renders as an explicit, legible state, not a blank
   or a green default.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Coverage exercises: the import-boundary invariant (derive imports no
      adapter/scan), each of the three states, every `unknown` trigger
      (deadline-unknown, thin history, unknown execution), the envelope-not-evidence
      invariant, and determinism (same fixtures → same result).
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance). Craft pass run.
- [ ] **Architecture review passed** (`arch_review: true` — new module + ADR-0006
      import boundary is exactly the seam reviews must police).
- [ ] Implementation review passed.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] The forecast minimum-evidence decision is recorded (lightweight decision or
      ADR) and linked from this slice; `docs/refinement-todo.md` item marked
      resolved; status board updated.

**Anti-horizontal-phasing check:** after this slice a user looks at a project's
card and sees "at risk — pace behind required" (or an honest "unknown —
insufficient history") derived from its real observation series — the analytics
read is visible end to end, not an untested fold.

### Assumptions

- Observed pace is computable from ≥2 observations' `execution.value.progress`
  over their `collectedAt` span; the exact pace metric (pct-per-day vs.
  specs-per-day) and the required-pace comparison against the deadline are fixed
  by the DoR minimum-evidence decision, not guessed here.
- A single collection run produces one observation; a freshly-onboarded project
  therefore has thin history and resolves `unknown` until more runs accrue — an
  expected, correct state, not a failure (this is why manual `npm run collect`
  cadence is acceptable for the MVP).
