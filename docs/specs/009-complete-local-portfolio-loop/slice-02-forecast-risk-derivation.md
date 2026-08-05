---
status: DONE
dependencies: [009-01, adr-0006, adr-0012]
last_verified: 2026-08-05
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
- ✅ 009-01 DONE. **The deadline lives in the profile/config and is joined at the
  read layer, not in the observation record** (verified: `joinProjectProfileFields`,
  `src/observation.mjs`). So `src/derive.mjs` does **not** read it — the caller
  **passes the deadline in** as a parameter, exactly as ADR-0006 passes the
  registry project-id set in. derive.mjs's only *observation* input stays
  `readObservationHistory()`.
- ✅ ADR-0006 accepted (derivation home = `src/derive.mjs`; imports only
  `readObservationHistory()` + observation helpers; never adapters/`scan.mjs`;
  never `config.mjs`/`profile.mjs`; never writes; envelope `collection.status` is
  never derivation evidence).
- ✅ **Pace-window resolved (closes ADR-0012's open question).** The observed pace
  is computed over the **trailing stable-scope window**: starting from the latest
  supported-execution observation, extend backward through consecutive supported
  observations while `denom` stays within tolerance of the latest; that trailing
  run is the pace basis. This makes a colour reachable for an actively-developed
  project whose *recent* scope is stable (rather than routing every scope-churned
  project to `unknown`, which a full-series window would do), while staying honest.
  This resolves ADR-0012's open question on window extent (recorded against that
  ADR, not a new decision). **Edge reason precedence:** if there are ≥2 supported
  observations but `denom` moved at the latest step (so the stable trailing run
  collapses to a single point) → **`scope-changed`**; `insufficient-history` is
  reserved for genuinely <2 supported observations, or a trailing stable run
  spanning <1 day, regardless of scope. Deterministic; Gate 4 still gates it
  (ADR-0012).
- ✅ **Forecast minimum-evidence rule resolved by
  [ADR-0012](../../decisions/adr-0012-forecast-confidence-minimum-evidence.md).**
  The four-gate rule (known deadline · fresh supported latest reading · ≥2 spaced
  observations over ≥1 day · stable-scope denominator), with `unknown` + a named
  reason whenever any gate fails, is the contract this slice implements verbatim.
- ✅ Carried from 009-01: the profile `deadline` value pattern is currently only
  syntactic (accepts `2026-13-40`). This slice does deadline **date arithmetic**,
  so it must treat a non-parseable / calendar-invalid deadline as `deadline-unknown`,
  not compute against it.

**Acceptance Criteria:**

1. **Dedicated history-derived module, deadline passed in.** Forecast/risk lives
   in a new `src/derive.mjs` whose only *observation* input is
   `readObservationHistory()` (per-project) plus observation-contract helpers. The
   **deadline is a caller-supplied parameter** (the profile field, joined by the
   caller), never read by derive.mjs; derive.mjs imports no adapter, not
   `src/scan.mjs`, and not `config.mjs`/`profile.mjs`, and writes nothing.
   (Enumeration: an import check over `src/derive.mjs` shows the closed set of its
   imports; a test asserts derive.mjs takes the deadline as an argument.)
2. **Evidence-gated three-state output (ADR-0012 four gates).** Each project
   resolves to exactly one of `on_track` / `at_risk` / `unknown`. `unknown` is
   returned — never a coerced colour — whenever **any** gate fails: no concrete
   deadline (`deadline-unknown`), a non-`supported` or non-`fresh` latest execution
   reading (`execution-unknown` / `stale-evidence`), fewer than 2 supported
   observations spanning ≥1 day (`insufficient-history`), or a materially changed
   denominator across the window (`scope-changed`). Product-vision: unknown, not
   zero/healthy.
2a. **ADR-0012 applied verbatim.** All four gates and the deterministic colour
   computation (remaining, observed pace over the stable-scope supported-execution
   window, required pace vs. days-to-deadline, the `deadline-passed` /
   `no-forward-progress` / `already-complete` cases) are implemented exactly as
   [ADR-0012](../../decisions/adr-0012-forecast-confidence-minimum-evidence.md)
   specifies; the slice cites it. The **pace-window is the trailing stable-scope
   window** defined in the DoR (deterministic; resolves ADR-0012's open question).
3. **Explained, deterministic read.** Every result carries a short machine-set
   reason from the ADR-0012 set (`deadline-unknown`, `execution-unknown`,
   `stale-evidence`, `insufficient-history`, `scope-changed`, `pace-behind-required`,
   `pace-meets-required`, `deadline-passed`, `no-forward-progress`,
   `already-complete`) so the card can explain *why*; the same inputs always yield
   the same result (no clock-of-the-moment nondeterminism beyond the observation
   timestamps themselves).
4. **Envelope status is not evidence.** `collection.status` (`ok`/`partial`/
   `error`) never influences the forecast/risk result (ADR-0006 reaffirmation);
   a partial collection with sufficient capability evidence can still derive a
   colour, and a green envelope with thin evidence still resolves `unknown`.
5. **The card shows the read.** Each project's card renders its forecast/risk
   state and reason; `unknown` renders as an explicit, legible state, not a blank
   or a green default.

**DoD:**
- [x] All ACs pass; full test suite green (195/195).
- [x] Coverage exercises: the import-boundary invariant (derive imports no
      adapter/scan), each of the three states, **every** `unknown` trigger
      (deadline-unknown incl. calendar-invalid deadline, execution-unknown,
      stale-evidence, insufficient-history, scope-changed, denom===0), the colour
      computation branches (deadline-passed, no-forward-progress incl. strictly
      negative, already-complete, pace-behind/meets), the envelope-not-evidence
      invariant, and determinism (same fixtures → same result).
- [x] Each new test shown to fail when its feature is removed (mutation-verified).
- [x] Reviewed by `reviewer` subagent (compliance — 2 passes). Craft pass run (both pass).
- [x] **Architecture review passed** (`arch_review: true`; derive.mjs zero-import
      boundary confirmed).
- [x] Implementation review passed.
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] ADR-0012 linked; the pace-window (trailing stable-scope window) recorded in
      the deviation log as resolving ADR-0012's open question;
      `docs/refinement-todo.md` "Forecast confidence" resolved + `no-measurable-scope`
      follow-up added; status board regenerated at DONE.

**Anti-horizontal-phasing check:** after this slice a user looks at a project's
card and sees "at risk — pace behind required" (or an honest "unknown —
insufficient history") derived from its real observation series — the analytics
read is visible end to end, not an untested fold.

### Assumptions

- **The deadline is a caller-supplied parameter, not an observation field.**
  Verified: the deadline lives in the profile and is joined at the read layer
  (`joinProjectProfileFields`, `src/observation.mjs`); it is absent from persisted
  observation records. So `src/derive.mjs` receives it as an argument (like the
  ADR-0006 registry set) — reading `config.mjs`/`profile.mjs` from derive.mjs would
  break the import boundary arch-review must police. The caller (server/read layer)
  owns the profile→derive plumbing.
- **Pace over the trailing stable-scope window** (DoR resolution of ADR-0012's open
  question). `execution.value.progress` is `{done, total, abandoned, deferred,
  denom, pct}` with `denom = total − abandoned` (verified, `src/lib.mjs`); the pace
  fraction uses `pct` (nullable → treat as unknown for that observation) or
  `done/denom`. Extending only through the *recent* run where `denom` is stable is
  what keeps a colour reachable for an active project — a full-series window would
  route this repo's continuously-shaped scope to `scope-changed`/`unknown` almost
  always, meeting the anti-horizontal-phasing promise only on synthetic fixtures.
- A single collection run produces one observation; a freshly-onboarded project
  therefore has thin history and resolves `unknown` until more runs accrue — an
  expected, correct state, not a failure (this is why manual `npm run collect`
  cadence is acceptable for the MVP).

### Deviation log (after reconciliation)

Original ACs preserved above. Implementation notes:

1. **`src/derive.mjs` is a zero-import pure fold.** `deriveForecast(observations,
   deadline)` implements ADR-0012's four gates + colour computation;
   `attachForecasts(data, historiesByProjectId)` composes it across the portfolio.
   The read layer (`src/server.mjs`) does the I/O — `readObservationHistory` per
   project + the deadline join — and hands plain data to the pure functions. The
   ADR-0006 import boundary is structurally guaranteed (no imports to breach).
2. **Gate 4.5 — `denom === 0` evidence gate (added in review).** The compliance
   pass caught a reachable false-green: an all-abandoned project (`total=N`,
   `abandoned=N` → `denom=0`, `done=0`, execution still `supported`) passed all
   gates and read `on_track`/`already-complete`. Fixed by routing `denom === 0` (no
   measurable deliverable scope) to `unknown` **before** any fraction computation.
   Reason **reuses `execution-unknown`** as a stopgap — ADR-0012 did not anticipate
   `denom === 0` under a `supported` status. A dedicated `no-measurable-scope`
   reason is logged to `docs/refinement-todo.md` as a future ADR-0012 refinement
   (adding a reason is decision-content → an ADR revision, not an inline tweak).
3. **Pace-window = trailing stable-scope window** — the DoR resolution of ADR-0012's
   open question (recorded against ADR-0012, not a new decision). `DENOM_TOLERANCE
   = 0` (exact denom equality) is the concrete stability threshold: a conservative,
   tunable start within ADR-0012's fixed shape. Consequence: on a continuously-shaped
   repo a colour is reachable mainly where recent scope is stable; re-tune the
   tolerance/window against the real corpus later.
4. **`fractionOf` prefers exact `done/denom` over rounded `pct`** (craft nit): the
   integer `pct` quantizes each endpoint to whole points and could flip the colour
   near the boundary; ADR-0012 sanctions "done/denom or pct/100", so the exact path
   is used when `denom > 0`.
5. **`attachForecasts` lives in `derive.mjs`, not `server.mjs`** (arch-endorsed
   seam): cross-project folding is derivation *policy*. It navigates the
   current-state read's object shape (`project.id`, `project.deadline.value`) at the
   composition boundary — caller-passed data, **not** an import, so the ADR-0006
   boundary is intact. **009-03's attention queue inherits this composition
   contract deliberately** (it extends the same layer downstream of forecast/risk).
6. **Card render (AC5):** `on_track`→green, `at_risk`→red, `unknown`→amber chip —
   `unknown` never lands in the green class, never blank. `/api/data` now carries
   `forecast: {state, reason}` (architecture.md contract surface updated).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front door unaffected. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close. |
| `docs/product-vision.md` | `no-op` | Forecast/risk was already in the committed MVP list; no scope change. |
| `docs/architecture.md` | `updated` | History-derived layer now exists (`src/derive.mjs`); `/api/data` forecast field; contract surface + two-layer-derivation section updated. |
| `docs/releases/local-portfolio-loop.md` | `no-op` | Forecast/risk already Include; the cutline was reconciled in 009-01. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 009 still in flight (009-03 pending); compress-on-close-out deferred to 009-03. |
| `docs/inbox.md` | `no-op` | No items resolved by this slice. |
| `docs/refinement-todo.md` | `updated` | Marked "Forecast confidence" RESOLVED by ADR-0012 (this slice's governing decision) and added the `no-measurable-scope` forecast-reason follow-up (from the denom===0 stopgap). (The co-present "Cross-project attention overlay" resolution belongs to 009-03/ADR-0013.) |
| `docs/memory/**` | `no-op` | Forecast rule captured in ADR-0012 + the slice; no new durable term. |
| `docs/decisions/README.md` / ADR index | `no-op` | ADR-0012 accepted + indexed earlier this session; no new ADR in this slice's reconciliation. |
