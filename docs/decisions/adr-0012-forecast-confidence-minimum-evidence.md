---
status: Accepted
dependencies: [adr-0003, adr-0006, adr-0011]
last_verified: 2026-08-05
frame_review: true
---

# ADR-0012: Forecast confidence: minimum-evidence rule for on_track/at_risk vs unknown

## Status

Accepted (2026-08-05)

## Context

Spec 009-02 derives a per-project forecast/risk read — `on_track` / `at_risk` /
`unknown` — in the history-derived layer ([ADR-0006](adr-0006-two-layer-derivation.md)).
Before it can be built, one policy must be decided: **how much evidence is
required before Gauge dares assign a colour, below which the only honest answer is
`unknown`.** This is the "Forecast confidence" item parked in
`docs/refinement-todo.md`.

The product's central honesty rule (product-vision; glossary `Unknown`) is that
insufficient evidence must yield `unknown`, never a coerced `on_track`/zero/healthy.
A forecast that turns one noisy data point into a confident "on track" is worse
than saying nothing — it manufactures false precision, the exact rabbit hole the
release plan calls out.

Verified inputs available to the rule (from the current checkout):

- **History.** `readObservationHistory(stateDir, projectId)` (`src/state.mjs`)
  returns the project's observation series sorted by `collectedAt`. It is the
  layer's only observation input (ADR-0006).
- **Progress.** Each observation's `execution` capability signal, when
  `status: 'supported'`, carries `value.progress` (`{pct, done, denom, deferred}`
  — verified in `src/observation.mjs`); when the adapter finds no recognized
  delivery status it is `status: 'unknown'` (never a coerced `0`).
- **Freshness.** Every signal carries a `freshness.state` of
  `fresh` / `unknown` / `stale` / `error`; for the jig execution signal this is
  derived from git-commit recency (`gitFreshness(scanned.git?.lastCommit,
  collectedAt)` — verified in `src/observation.mjs`). It therefore certifies
  recent **repository activity** — a proxy for evidence recency — not that spec
  completion itself changed.
- **Scope churn.** `denom` is a *moving denominator*: jig specs are shaped,
  deferred, and abandoned continuously (this repo grew 004→007→008→009 over its
  life). So the completion *fraction* can move for reasons unrelated to delivery.
- **Deadline.** Authored into the profile by 009-01 / ADR-0011 as a concrete date
  or the literal `unknown`; the machine never fabricates one.

The open decision is the *shape of the gate*, not the exact numbers — collection
is manual and sparse for the MVP, so no long real history exists yet to tune
against; the rule must be conservative and honest by construction now, and tunable
later once the corpus accrues multi-day history.

## Decision Options Considered

### Option A: Single-observation forecast (latest progress vs. deadline)
- **Pros:** works from the very first collection; no history needed.
- **Cons:** with one point there is no *pace*, so "on track" would rest on a
  guess about future velocity — precisely the false precision the product forbids.
  A project at 10% with a near deadline could read `on_track` from a single
  optimistic snapshot. Rejected.

### Option B: Trust any two points (pace from the last two observations)
- **Pros:** minimal history; simple slope.
- **Cons:** two observations minutes apart (a re-run) yield a degenerate/zero-span
  or wildly noisy pace; a single stale pair would still produce a colour. Too easy
  to fool. Rejected as the *whole* rule (a span/freshness gate is required).

### Option C (recommended): A conservative multi-gate rule; unknown unless every gate passes
- **Pros:** encodes the honesty rule structurally — a colour requires a known
  deadline, a fresh supported latest reading, and enough spaced history to compute
  a real pace; anything short is `unknown` with a named reason. Deterministic given
  the observation timestamps; the exact thresholds are tunable parameters within a
  fixed shape.
- **Cons:** for the current sparse corpus most projects will read `unknown` until
  several collections accrue — correct behaviour, but it means the colour is
  earned slowly, not instantly.

## Recommended Decision

Adopt **Option C**. A project resolves to a **colour** (`on_track` / `at_risk`)
only when **all** of these gates pass; otherwise the result is **`unknown`** with a
machine-set reason:

1. **Known deadline** — the profile `deadline` is a concrete date, not `unknown`
   (else reason `deadline-unknown`).
2. **Fresh, supported latest reading** — the latest observation's `execution`
   signal is `status: 'supported'` with `freshness.state === 'fresh'` (else
   `execution-unknown` or `stale-evidence`). Freshness here means recent
   *repository activity* (see Context), so this gate rejects clearly-stale
   evidence; it does not by itself certify that progress changed — gates 3–4
   supply the delivery-movement evidence.
3. **Sufficient spaced history** — at least **2** observations carrying a
   `supported` execution progress, spanning at least **1 day**
   (`max(collectedAt) − min(collectedAt) ≥ 24h`), so an observed pace is real and
   not a zero-span artifact (else `insufficient-history`).
4. **Stable comparability basis** — the `execution` denominator (delivery scope)
   must be materially stable across the window. If `denom` changed beyond a small
   tolerance between the earliest and latest supported observations (scope was
   shaped, deferred, or abandoned mid-window), the progress *fraction* conflates
   scope churn with delivery and its slope is not a pace, so the result is
   **`unknown`** with reason `scope-changed` — never a colour. (Absolute
   `done`-count movement stays available to a future scope-robust metric; this ADR
   does not compute a colour from a moving denominator. A project that shaped new
   specs reads `unknown`, not a manufactured `at_risk`.)

When all four gates pass — so the window has a known deadline, fresh supported
evidence, ≥1-day spaced history, **and a stable scope** — the read is computed
deterministically (the `observedPace ≤ 0 → at_risk` case below is now honest,
because gate 4 has already excluded scope churn as the cause):

- `remaining = 1 − progressFraction` (from `progress`; `done/denom` or `pct/100`).
- If `remaining ≤ 0` → **`on_track`** (goal already met).
- `observedPace = (latestFraction − earliestFraction) / spanDays` over the
  supported-execution window.
- `daysToDeadline = deadline − latest.collectedAt`.
- If `daysToDeadline ≤ 0` and `remaining > 0` → **`at_risk`** (deadline reached,
  work remains).
- If `observedPace ≤ 0` and `remaining > 0` → **`at_risk`** (no forward progress).
- `requiredPace = remaining / daysToDeadline`; **`on_track`** iff
  `observedPace ≥ requiredPace`, else **`at_risk`**.

Every result — colour or `unknown` — carries a short reason string so the card can
explain *why* (`deadline-unknown`, `execution-unknown`, `stale-evidence`,
`insufficient-history`, `scope-changed`, `pace-behind-required`,
`pace-meets-required`, `deadline-passed`, `no-forward-progress`,
`already-complete`). The `collection.status` envelope (`ok`/`partial`/`error`) is
**never** an input (ADR-0006 reaffirmation).

**The gate *shape* is the decision; the numbers (`≥2` observations, `≥1 day` span)
are tunable parameters.** They start conservative and are re-tuned against the
reference corpus once real multi-day history exists — a parameter change within
this shape, not a new decision requiring a superseding ADR.

## Consequences

**Becomes easier:**
- 009-02 implements a single deterministic fold with an unambiguous `unknown`
  contract; the honesty rule is structural, not a reviewer's judgment call.
- 009-03's attention queue consumes a well-defined three-state input plus reasons.

**Becomes harder:**
- Freshly-onboarded or sparsely-collected projects read `unknown` for a while;
  users must collect a few times over days before a colour appears. This is the
  intended trade (honest silence over a confident guess), but it must be explained
  on the card, not left blank.
- The tunable thresholds live in code; changing them needs a test update, and the
  "why these numbers" rationale must stay attached to the constant.

## Assumptions

- `execution.value.progress` exposes `{done, denom, pct}` (verified present in
  `src/observation.mjs` for the `supported` jig execution signal). The completion
  *fraction* is **not** comparable point-to-point when `denom` moves — jig scope is
  shaped/deferred/abandoned continuously — so a fraction slope can reflect scope
  churn rather than delivery. Gate 4 routes a materially-changed denominator to
  `unknown` (`scope-changed`), **not** to a colour; only a stable-scope window
  yields a colour, and there `observedPace ≤ 0` honestly reads `at_risk`. This
  corrects the naive "regression ⇒ at_risk" reading, which would have manufactured
  a false `at_risk` for a healthy project that merely shaped new specs.
- Manual collection produces one observation per run; multi-day span therefore
  requires the user to collect across ≥2 days. Confirmed by the MVP's manual-pull
  decision (2026-08-05). This is why `insufficient-history` will be the common
  early state, not a bug.

## Kill criteria

- If real corpus history shows the ≥1-day span gate makes colours effectively
  unreachable in normal use (e.g. users collect too rarely), relax the span
  parameter — a tuning change, not a shape change.
- If a single-snapshot deadline-vs-progress signal proves genuinely useful and
  honestly labelled (e.g. a distinct "behind schedule (no pace yet)" state), that
  is a *new* state to add, and would supersede this ADR's strict two-colour gate.

## Open questions

- **Pace-window definition (load-bearing for how often Gate 4 fires).** Over a
  *full-series* window an active jig portfolio's `denom` will almost always have
  moved (scope churn), so Gate 4 routes to `scope-changed`/`unknown` for precisely
  the actively-developed projects — colours appear mainly in the execution tail.
  A *recent* window (last N observations, or a trailing span with stable scope)
  could make a colour reachable during active development where the recent scope
  was stable. 009-02 must decide full-series vs. recent-window deliberately (it
  directly governs the `unknown` rate); this ADR mandates a deterministic observed
  pace over the *supported-execution, stable-scope* window but leaves the window's
  extent to 009-02, provided the choice is deterministic and Gate 4 still gates it.
- A `done`/`complete` state distinct from `on_track` (for `remaining ≤ 0`) may be
  worth surfacing on the card; deferred to 009-02/009-04 presentation.
