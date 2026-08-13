---
status: DRAFT
dependencies: [013-01, adr-0018]
last_verified:
# arch_review: true  # candidate — adds a curated profile field + onboarding path
#                    # and a new RAG reason; flip on if it touches the profile
#                    # schema / onboarding contract.
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
- [ ] All ACs pass; suite green.
- [ ] Tests cover within/over-appetite, amber (not red) rendering, precedence over
      the neutral tier, and the no-runtime-prose-parse guard.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch if flag set).
- [ ] Deviation log + reconciliation sweep produced.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** An owner who curates an appetite-window sees the
card light **green/amber** on appetite-shaped work — the honest, date-free
forecasting ADR-0018 set out to deliver.

### Deviation log (after reconciliation)

_TBD._

### Reconciliation sweep

_TBD._
