---
status: DONE
dependencies: [013-01, adr-0018]
last_verified: 2026-08-13
arch_review: true  # adds a curated profile field + a new RAG reason + a
#                    # deriveForecast signature change — a contract/boundary change.
---

<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable claims or mark them
     as assumptions in spec.md `## Assumptions`; never assert unverified. -->

## Slice 013-03 — curated soft appetite-window (green/amber)

**Goal:** Let the owner author a **soft appetite-window** — an absolute target date
tagged soft, curated at onboarding exactly like a deadline (ADR-0011: runtime never
parses prose) — and forecast against it with **soft** semantics: on pace → green
`within-appetite`; over the window → **amber** `over-appetite` (cutline-due, never
red). Tier 2 of ADR-0018.

**DoR:**
- ✅ 013-01 done; 013-02 landed the tier structure in `deriveForecast`.
- ✅ ADR-0018 tier-2 semantics: user-authored absolute soft target; amber-not-red;
  no runtime prose parsing.

**Acceptance Criteria:**

1. **Curated soft-target field.** The profile schema accepts a user-authored soft
   appetite-window (an absolute ISO date tagged soft — a flag on `deadline` or a
   distinct `appetiteWindow` field; decide at implementation). It is
   provenance-`user`, authored/curated, **never** runtime-derived from appetite
   prose. `unknown`/absent behaves like an absent deadline.
2. **Onboarding curation (author-time).** The onboarding path lets the owner commit
   the soft window; it MAY *suggest* a value from the release appetite hint via
   author-time comprehension (human, optionally Claude-assisted — ADR-0011's
   carve-out), but the runtime/collector never parses the appetite prose.
3. **Soft forecast.** With a committed soft window and gates passing,
   `deriveForecast` runs the tier-1 pace-vs-target machinery against the authored
   date but emits soft reasons: on pace → `{state:'on_track', reason:
   'within-appetite'}`; over → `{state:'at_risk', reason:'over-appetite'}`.
4. **Amber, never red.** `forecastToRag` maps `over-appetite` to **yellow** (add to
   `RAG_YELLOW_REASONS`), so over-running an appetite reads "cutline due," not a
   hard-fail red. `within-appetite` reads green.
5. **Deadline stays the sole hard target.** A committed hard `deadline` still
   produces hard `on_track`/`at_risk` (red on real overrun) unchanged; precedence
   is deadline > appetite-window > neutral (013-02) > unknown.
6. **No runtime prose parse (guard).** A test asserts the collection/derivation path
   reads only the committed field — never `docs/releases/*` appetite text — honoring
   ADR-0018's kill criterion.

**DoD:**
- [x] All ACs pass; suite green.
- [x] Tests cover within/over-appetite, amber (not red) rendering, precedence over
      the neutral tier, and the no-runtime-prose-parse guard.
- [x] Each new test shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft; arch if flag set).
- [x] Deviation log + reconciliation sweep produced.
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** An owner who curates an appetite-window sees the
card light **green/amber** on appetite-shaped work — the honest, date-free
forecasting ADR-0018 set out to deliver.

### Deviation log (after reconciliation)

1. **Schema-shape decision.** Added a **distinct `appetiteWindow: {value, provenance}`
   field** (top-level + per-entry), `$ref`'d to the existing `#/$defs/deadline`
   definition — *not* a flag on `deadline`. This single-sources validation (reuses
   `DEADLINE_PROVENANCE` / `DEADLINE_VALUE_PATTERN` / `deadlineMs`) while keeping the
   two targets independently addressable for precedence, per ADR-0018's "mechanically
   identical to a deadline" framing. **This resolves ADR-0018's open question
   "Soft-target schema + onboarding UX"** (distinct field, not a deadline flag).
2. **Threading.** `appetiteWindow` flows through `schemas/project-profile-v1.schema.json`,
   `src/profile.mjs` (`validateProfile`/`validateEntry`), `src/config.mjs`
   (`resolvedSingleProfile` + entry→profile fallback), `src/observation.mjs`
   (`joinProjectProfileFields`, pure passthrough), to `deriveForecast(observations,
   deadline, appetiteWindow)` via `attachForecasts`. `deriveForecast` stays a pure,
   import-free fold (ADR-0006).
3. **Tier-2 forecast + precedence.** `appetiteAt` is resolved **only** when
   `deadlineAt === null`, so a hard deadline always wins (AC5, "never both consulted
   for a colour"). Tier 2 runs the same pace-vs-target math but emits only
   `within-appetite` (on_track/green) / `over-appetite` (at_risk) — never a hard
   reason. `forecastToRag` maps `over-appetite` → **amber** (added to
   `RAG_YELLOW_REASONS`), never red; `within-appetite` → green.
4. **No runtime prose parse (AC6).** The soft window is read only from the committed
   profile field; onboarding surfaces a path *pointer* (never a parsed value). Guarded
   behaviorally by a test with a real appetite-shaped `docs/releases/*.md` on disk +
   an uncommitted field → still tier-3 neutral.
5. **Attention-queue fix (compliance blocker → resolved).** The first compliance pass
   caught that a soft `over-appetite` (`state:at_risk`) landed in attention **tier 1**
   with "at risk · deadline unknown" text — a hard-alarm smuggle tripping ADR-0018's
   kill criterion. Fixed: `tierOf` returns **tier 2** for `at_risk`+`over-appetite`
   (reason-based, before the generic `at_risk → 1`), and `tierReason` emits the soft
   phrase **"over appetite — cutline due"**. It sorts below hard at_risk (tier 1),
   above neutral tier 3; hard at_risk and `within-appetite` unaffected (regression-tested).
6. **Nits carried as follow-ups (non-blocking):** (a) ~6-line pace arithmetic is
   duplicated between the tier-1 and tier-2 `deriveForecast` blocks — accepted under
   ADR-0002 (legibility + tier-1-unchanged). (b) `deriveForecast` grew a third positional
   arg — invites an options-object refactor if a 4th target lands. (c) over-appetite
   entries have no appetite-window secondary sort within tier 2 (sort key is
   hard-deadline proximity only) — deliberate, in-scope. (d) **Extensibility:** two
   curated targets now run parallel `deadline`-shaped plumbing through ~7 sites; a
   **third** should trigger a target-descriptor-list refactor (logged to inbox).
7. **Invariant held.** Tier-1 (hard deadline) behavior unchanged; existing deadline
   tests pass untouched. Full suite **496/496** green.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No project-front-door change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out. |
| `docs/product-vision.md` | `no-op` | No product-boundary change; a forecast/onboarding-field refinement within the manager lens. |
| `docs/architecture.md` | `no-op` | `appetiteWindow` is an additive profile field mirroring the existing `deadline` read-layer-join; no new module boundary or trust boundary (arch-pass confirmed). |
| Primer surfaces: `CLAUDE.md` / scaffold templates | `deferred` | Spec 013 now closes (01/02/03 all DONE) — compress the active-spec entry as part of close-out (see below). |
| `docs/inbox.md` | `updated` | Logged the target-descriptor refactor trigger (a third curated target). |
| `docs/refinement-todo.md` | `no-op` | No new deferred owner-decision. |
| `docs/memory/**` | `no-op` | ADR-0018 + the author-time-curation memory already capture the semantics. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched; ADR-0018's open question is noted resolved in this deviation log (accepted ADRs are immutable). |
