---
status: DRAFT
dependencies: [013-01, adr-0018]
last_verified:
---

<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable claims or mark them
     as assumptions in spec.md `## Assumptions`; never assert unverified. -->

## Slice 013-02 — neutral date-free pace (advancing/stalled)

**Goal:** For a project with **no committed target** (no deadline, no
appetite-window) but a reconstructed history clearing the evidence gates, emit a
**neutral** motion read — `advancing` (pace > 0) or `stalled` (pace ≤ 0) — that
renders as an informational card annotation (gray, via `forecastToRag`'s default
branch) and does **not** re-tier the ADR-0013 attention queue. Tier 3 of ADR-0018.

**DoR:**
- ✅ 013-01 done (history exists to derive pace from).
- ✅ ADR-0018 tier-3 semantics: neutral, no colour, no attention promotion.

**Acceptance Criteria:**

1. **New neutral states.** `deriveForecast` (`src/derive.mjs`), when the deadline
   gate fails but Gates 2/3/4/4.5 pass, returns `{state:'advancing', reason:
   'progressing-no-deadline'}` for `observedPace > 0` and `{state:'stalled',
   reason:'stalled-no-deadline'}` for `observedPace ≤ 0`; `remaining ≤ 0` stays
   `on_track/already-complete`. Computed over the same Gate-4 stable window.
2. **No colour.** `forecastToRag` maps `advancing` and `stalled` to **gray** (they
   hit the existing default branch — verify no accidental colour). The RAG chip for
   a dateless project shows gray, never green/amber/red.
3. **No attention re-tiering.** The ADR-0013 attention queue places an `advancing`
   or `stalled` dateless project exactly where a `unknown (deadline-unknown)`
   project sits today — `stalled` is **not** ranked above `advancing` or `unknown`.
   (Guards against the round-3 urgency-laundering ADR-0018 rejected.)
4. **Card annotation.** The card surfaces `advancing`/`stalled` as a neutral,
   informational label (not an alarm) — copy/visual per the spec 012 mockup
   (design-fidelity is an AC, extract the neutral treatment).
5. **Abstains honestly.** Below any gate the forecast is unchanged `unknown` with
   its existing reason (including `scope-changed`); no dateless project is coerced
   into a motion state without a real within-window pace.

**DoD:**
- [ ] All ACs pass; suite green.
- [ ] Tests cover advancing / stalled / already-complete / gated-to-unknown, plus
      an assertion that attention order is unchanged for a stalled dateless project.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** A dateless project's card gains an honest
"advancing"/"stalled" read the owner can see, where before it only said "needs a
deadline."

### Deviation log (after reconciliation)

_TBD._

### Reconciliation sweep

_TBD._
