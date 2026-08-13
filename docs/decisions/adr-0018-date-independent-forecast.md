---
status: Accepted
dependencies: [adr-0003, adr-0006, adr-0011, adr-0012, adr-0013, adr-0017]
last_verified: 2026-08-13
frame_review: true
---

# ADR-0018: Date-independent forecast for appetite-shaped work

## Status

Accepted (2026-08-13)

## Context

[ADR-0012](adr-0012-forecast-confidence-minimum-evidence.md) makes a **concrete
deadline the first gate** of every forecast: `deriveForecast` (`src/derive.mjs`)
returns `unknown('deadline-unknown')` the moment the profile `deadline` is absent
or the literal `unknown`, before any pace is computed. That was the right honesty
rule for the deadline case — but the real portfolio rarely carries dates. The
owner works in **shaper appetites** (fixed-effort / cutline), not calendar dates
(inbox, 2026-08-06), so every project collapses to `forecast: unknown
(deadline-unknown)` → attention tier 3, "needs a deadline set"
([ADR-0013](adr-0013-attention-overlay-policy.md)).

**The "no history" objection was a collection gap, not a data gap — and we closed
it.** A live snapshot of `~/.gauge` shows one observation per project, which looks
like "insufficient history forever." But for a jig project `progress(t)` is fully
reconstructable from git: at any past commit the spec `status:` frontmatter is
right there. A throwaway reconstruction (spec-level `progressOf`, daily cadence,
`DENOM_TOLERANCE=0` — mirroring Gauge's own logic) over four real repos produced:

| repo | daily pts | span | denom range | denom churn | in stable run | pace-eligible | naive vs in-window pace |
|---|---|---|---|---|---|---|---|
| jig | 61 | 82d | 2→107 | 68% of steps | 46% | 31% | +1.13 vs 0.00 |
| gauge | 9 | 30d | 3→11 | 50% | 78% | 44% | **−0.60 vs +3.73** |
| servo | 26 | 58d | 1→22 | 56% | 65% | 42% | −0.31 vs +1.25 |
| shaper | 7 | 55d | 7→8 | 17% | 86% | 71% | +1.56 vs +3.31 |

Three things this settles (see Assumptions):

1. **The history gate dissolves retroactively.** 7–61 real timestamped daily
   observations per repo — Gate 3 (≥2 spaced) is trivially met once the
   git-backfill seed runs. This ADR is no longer "changes nothing until history
   accrues."
2. **Gate 4 (stable-scope) is vindicated but not fatal.** Churn is real (17–68% of
   daily steps move `denom`) and it genuinely lies: **gauge's naive whole-series
   pace reads −0.60 pct/day — backwards — while its in-stable-window pace is
   +3.73/day**, because `denom` grew 3→11 as work shipped. So pace over a moving
   `denom` is a lie, exactly as Gate 4 assumes; but stable same-`denom` windows
   exist and a real within-window pace is computable on **31–71%** of observations.
3. **Appetite-shaped work has real, forecastable execution arcs.** shaper went
   14%→100% inside a single 26-day stable window. What it lacks is a *target* to
   forecast that arc against — and the owner has one in mind (the appetite), it is
   simply not yet a committed value.

**The binding constraint from ADR-0011.**
[ADR-0011](adr-0011-goal-deadline-source-strategy.md) (Accepted) decides that the
**runtime never parses source prose**: "The machine never infers a deadline from
appetite prose... never a value the collector computed from prose." Prose
comprehension is an **author-time** step — a human, optionally Claude-assisted,
resolves the appetite at onboarding — while the runtime reads only the committed,
curated field. Any forecast target this ADR uses must therefore be **user-authored
at onboarding, never runtime-derived.** (An earlier draft of this ADR proposed
deriving an appetite window from prose at runtime; the frame-critique correctly
killed it as a re-run of the option ADR-0011 already rejected.)

Two honesty constraints bind every option below:

- **The machine never infers a target** (ADR-0011): a target is whatever the user
  committed at onboarding; the runtime never computes one from prose.
- **No false precision — symmetric** (ADR-0012; product-vision `Unknown`):
  insufficient or churning evidence yields `unknown`; and with **no** committed
  target the machine withholds both the colour call and the urgency call.

## Decision Options Considered

### Option A: Runtime-derived appetite window (parse "two weeks" + git start → target)
- **Cons:** violates ADR-0011's "runtime never parses source prose" and its "never
  a value the collector computed from prose." Soft-vs-hard colour changes only the
  consequence band, not the prohibited mechanism. **Rejected — conflicts with an
  Accepted ADR.**

### Option B: Date-free pace that emits red/green (stall → `at_risk`, progress → `on_track`)
- **Cons:** asymmetric and dishonest — a dateless stall painted red imports a
  "will-miss-target" judgment with no target. **Rejected** (frame-critique round 1).

### Option C-attention: Neutral colour, but rank `stalled` above `advancing`
- **Cons:** launders the same false alarm through queue position. **Rejected**
  (frame-critique round 3).

### Option D: Attention-tier reshuffle ranking on raw progress
- **Cons:** leaves `forecast: unknown` and re-derives attention from raw signals,
  which ADR-0013 forbids. **Rejected as insufficient.**

### Curated appetite-window (ADOPTED, tier 2): a user-authored *soft* target
- **Pros:** honors ADR-0011 exactly — the appetite is resolved at **onboarding**
  (author-time comprehension, optionally Claude-assisted, which ADR-0011 permits)
  into a committed, machine-readable **soft target**; the runtime reads only that
  field, never prose. Mechanically it is the existing curated-deadline path with a
  `soft` tag. The data shows real arcs (shaper 14→100) this would forecast honestly
  once the owner commits the window.
- **Cons:** asks the owner to curate one more field at onboarding; needs a `soft`
  discriminator and an amber reason so over-run reads "cutline due," not "will miss."

### Neutral date-free pace (ADOPTED, tier 3 floor): targetless motion, informational only
- **Pros:** for a project with **no** committed target of any kind, emit a neutral
  motion read — `advancing` / `stalled` — that does not colour RAG (gray, the
  `forecastToRag` default) and does not re-tier attention. Honest where there is
  genuinely no target; computable on the 31–71% of observations with a stable window.
- **Cons:** humble — informs, does not triage.

## Recommended Decision

Adopt a **tiered forecast-confidence model** extending (not superseding) ADR-0012.
Every tier reuses the existing evidence gates — Gate 2 (fresh supported latest),
Gate 3 (≥2 spaced supported), Gate 4 (trailing stable-`denom` window), Gate 4.5
(non-zero scope) — and computes `observedPace` over that stable window. Below any
gate → `unknown` with its existing reason (including `unknown('scope-changed')` for
churning scope; the path **must not** relax Gate 4 — the data proves the pace would
be a lie).

Tiers, in precedence order:

1. **Committed hard deadline** → ADR-0012's rule, unchanged. Sole source of a
   **hard** `on_track` / `at_risk` (green / red).
2. **Committed soft appetite-window** (a user-authored **absolute** target date
   tagged soft, curated at onboarding per ADR-0011 — mechanically identical to a
   deadline, so the runtime neither parses prose *nor* computes the target by
   anchoring a relative window; if a relative appetite is ever wanted, its
   anchoring is resolved at author-time too, never at collection time) → run
   ADR-0012's pace-vs-target machinery against the authored date, but emit **soft**
   reasons:
   on pace → green `within-appetite`; over the window → **amber** `over-appetite`
   (cutline-due, *never* red). Honest because the target is user-committed, not
   inferred; soft because an appetite is a cuttable budget, not a deadline.
3. **No committed target of any kind** → **neutral date-free pace**:
   `observedPace > 0` → `advancing`; `≤ 0` → `stalled`; `remaining ≤ 0` →
   `on_track`/`already-complete`. Neutral: no RAG colour (gray) and **no attention
   re-tiering** — the machine withholds colour *and* urgency with no target for either.
4. **Otherwise** → `unknown`.

**Honesty line, stated once:** a **hard** green/red requires a committed deadline;
a **soft** green/amber requires a committed appetite-window; with no committed
target the forecast is neutral (motion only) or `unknown` — never a coerced colour,
never a coerced attention rank, and **never a target the runtime computed from prose.**

Scope for the implementing slice (sequenced with the git-backfill seed): the schema
`soft`-target field + onboarding curation (author-time, optionally Claude-assisted
to *suggest* a window from the appetite hint — the user commits it); the neutral
`advancing`/`stalled` states; `forecastToRag` handling (neutral → gray;
`over-appetite` → amber via `RAG_YELLOW_REASONS`); and the card rendering. This ADR
fixes the *semantics* and the honesty line, grounded in the reconstruction above.

## Consequences

**Becomes easier:**
- The owner gets honest appetite-based forecasting by curating one soft-target field
  — a **green/amber** read on shaper-shaped work — without a hard deadline and
  without the runtime ever parsing prose.
- Projects with no committed target still get a neutral motion read instead of a
  blank "needs a deadline"; the git-backfill seed makes both tiers light up on real
  history (31–71% of observations).
- The honesty rule is explicit and tiered: hard colour ⇐ deadline; soft colour ⇐
  appetite-window; else neutral/unknown — all targets user-committed.

**Becomes harder:**
- Onboarding grows a curated soft-target field and an (optional, author-time)
  appetite-suggestion step; the vocabulary grows (`within/over-appetite` + two
  neutral states); `forecastToRag`, ADR-0013, card copy, and the mockup must handle
  them and keep `over-appetite` **amber**, never red.
- Three tiers coexist in `deriveForecast`; the deadline tier must remain the sole
  source of **hard** red/green, and no tier may read source prose at runtime, or
  ADR-0012 / ADR-0011 erode.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

Probed at this checkout (commit `5ee13ff`):

- `src/derive.mjs`: Gate 1 returns `unknown('deadline-unknown')` before any pace
  math (lines 81–83); `observedPace`/`remaining` are history-only (lines 137–142);
  Gate 4 walks a `DENOM_TOLERANCE=0` stable window (lines 98–115). Verified.
- `public/index.html` `forecastToRag` (lines 386–390): `on_track`→green;
  `at_risk`→yellow iff reason ∈ `RAG_YELLOW_REASONS`, else red; every other/new
  state → gray. So neutral `advancing`/`stalled` render gray with no code change,
  and `over-appetite` needs adding to `RAG_YELLOW_REASONS` for amber. Verified.
- `docs/decisions/adr-0011-*.md`: the runtime-never-parses-prose rule and the
  author-time-comprehension carve-out are quoted from lines 58–59, 107, 125–130.
  Tier 2 sits inside that carve-out (author-time curation), not against the rule.
  Verified.
- **Git reconstruction** (an uncommitted throwaway script run in the authoring
  session, not part of the repo): spec-level `progressOf` from
  `docs/specs/*/spec.md` `status:` frontmatter, one commit per day, over
  jig/gauge/servo/shaper. Results in the Context table — gauge's naive −0.60 vs
  in-window +3.73 pct/day, 31–71% pace-eligible. **The git-backfill-seed slice is
  the real, test-covered version that must reproduce these numbers** — treat the
  table as an indicative probe to re-derive, not a committed artifact.

## Kill criteria

- **Any tier reads source prose at runtime.** If the implementing slice parses the
  appetite text (or any source prose) at collection time instead of reading a
  user-committed field, it has become rejected Option A and violates ADR-0011 —
  block it.
- **The neutral or soft read gets smuggled into a hard alarm.** If a slice renders
  `stalled` red, re-tiers it above `advancing`/`unknown`, or maps `over-appetite`
  to a hard red instead of cutline-due amber, it reintroduces the false alarm this
  ADR rejects.
- **The deadline tier stops being the sole source of hard red/green.** If tier 2 or
  3 ever emits a *hard* `on_track`/`at_risk`, ADR-0012's line has eroded — revisit.
- **Nobody curates the soft target.** If, in practice, owners will not author an
  appetite-window any more than they author a deadline, tier 2 serves nobody and
  the real portfolio lives entirely in tier 3 (neutral) — revisit whether the soft
  target earns its complexity, or whether tier 3 plus a liveness signal is the
  honest whole answer.

## Open questions

- **Soft-target schema + onboarding UX.** Whether the soft window is a flag on
  `deadline` or a distinct `appetiteWindow` field, and how onboarding suggests a
  value from the appetite hint (author-time, Claude-assisted, user-committed) —
  slice-level design.
- **`over-appetite` rendering.** Amber cutline-due vs a distinct treatment — a
  design-fidelity call against the spec 012 mockup.
- **Sequencing with the git-backfill seed.** This ADR's observable effect rides on
  the reconstruction; the implementing slice should land with or after the seed —
  a release-shaping call for the committed thin-client release.
- **A liveness/staleness signal for churning work.** Projects stuck in
  `unknown (scope-changed)` (heavy shaping) get nothing from pace; an
  activity/recency signal might serve them. Out of scope here; candidate future ADR.
- **Relationship to the parked `no-measurable-scope` reason (ADR-0012 / 009-02).**
  Both extend ADR-0012's reason set; reconcile if that revision lands first.
