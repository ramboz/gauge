---
status: RECONCILED
dependencies: [013-01, adr-0018]
last_verified: 2026-08-13
claimed_by: claude/jig-orient-efb5dd
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
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** A dateless project's card gains an honest
"advancing"/"stalled" read the owner can see, where before it only said "needs a
deadline."

### Deviation log (after reconciliation)

1. **Restructure.** `deriveForecast` (`src/derive.mjs`) now runs the evidence gates
   (2/3/4/4.5) **unconditionally**, computing `observedPace`/`remaining` once, and
   consults the deadline only afterward as a single discriminator: `deadlineAt ===
   null` → the tier-3 neutral read (`advancing`/`stalled`/`already-complete`/gate-
   `unknown`); a concrete deadline → ADR-0012's tier-1 rule, **behaviorally
   unchanged**. New states `advancing`/`stalled` with reasons
   `progressing-no-deadline` / `stalled-no-deadline`.
2. **`deadline-unknown` retired from `deriveForecast` output** (a real, intended
   semantic change per ADR-0018 / AC5: "below any gate → unknown with its existing
   reason"). A dateless project failing an evidence gate now returns that gate's
   reason (`insufficient-history`, `execution-unknown`, `stale-evidence`,
   `scope-changed`) rather than the old `deadline-unknown` placeholder. The
   `deadline-unknown` branches in `tierOf`/`tierReason` survive **only** for
   standalone `attentionQueue` callers/fixtures — `tierOf` now carries a src
   comment marking this (reconciliation nit fix). Several **pre-existing** dateless-fixture tests had
   their expected values updated to the new (more honest) reasons — matching
   ADR-0018 semantics, not masking a regression (compliance-reviewed).
3. **RAG neutrality (AC2).** `advancing`/`stalled` hit `forecastToRag`'s existing
   default → **gray**; no `forecastToRag` change. The card drops the ⚠ alarm glyph
   for these states while keeping the "advancing/stalled — no deadline set" copy
   (mirrors green's non-alarm treatment). The two gray/uncoloured tests are
   regression guards (characterization) — acceptable per AC2's "verify no accidental
   colour"; the no-⚠ callout test is non-vacuous.
4. **No re-tiering (AC3).** `advancing`/`stalled` map to attention **tier 3**
   alongside `deadline-unknown`/`scope-changed`; the mixed-queue test uses
   adversarial ids to prove `stalled` is neither re-tiered nor sorted ahead of
   `advancing`/`unknown` within the tier.
5. **Naming asymmetry** `advancing` / `progressing-no-deadline` is spec-mandated
   (AC1 literal), noted for the record. The `{advancing, stalled}` neutral predicate
   is open-coded across the server (`derive.mjs`) / client (`index.html`) boundary —
   accepted (a shared helper is awkward across that split; ADR-0002 exposure is mild).
6. **Invariant held:** the deadline (tier-1) path returns exactly the prior results;
   all pre-existing deadline-path tests untouched and green. Dateless
   already-complete → `on_track` (green) is intended (ADR-0018: complete is complete,
   date or not) — not a hard-colour-without-deadline violation. Full suite 455/455.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No project-front-door change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out. |
| `docs/product-vision.md` | `no-op` | No product-boundary change; a forecast-derivation refinement. |
| `docs/architecture.md` | `no-op` | `deriveForecast`'s signature + the read-layer-join boundary are unchanged; internal branch logic only. |
| Primer surfaces: `CLAUDE.md` / scaffold templates | `no-op` | Spec 013 still in flight (03 DRAFT); compress at spec close-out. |
| `docs/inbox.md` | `no-op` | No new item; the CLI-extraction follow-up (013-01) still stands. |
| `docs/refinement-todo.md` | `no-op` | No new deferred owner-decision. |
| `docs/memory/**` | `no-op` | ADR-0018 already captured the tier semantics. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. |
