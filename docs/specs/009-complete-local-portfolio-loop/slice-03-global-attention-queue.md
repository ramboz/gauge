---
status: DRAFT
dependencies: [009-02, adr-0006, adr-0013]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020). -->

## Slice 009-03 — Global attention queue

**Goal:** The dashboard presents a single **explained, deterministic
cross-project attention queue** — an ordering that says *which project deserves
attention next and why* — derived downstream of forecast/risk in `src/derive.mjs`
([ADR-0006](../../decisions/adr-0006-two-layer-derivation.md)), which surfaces
portfolio intent without ever rewriting any project's own local priorities
(product-vision authority model).

**DoR:**
- ✅ 009-02 DONE (forecast/risk is the upstream input the queue consumes).
- ✅ ADR-0006 accepted (the attention queue belongs in the history-derived layer,
  downstream of forecast/risk; it takes the project-id set from the registry via
  its caller, not by reading the registry directly).
- ✅ **Attention-overlay policy resolved by
  [ADR-0013](../../decisions/adr-0013-attention-overlay-policy.md).** The queue is a
  deterministic **tiered lexicographic ordering** keyed on the derived forecast
  state + ADR-0012 reason (never owner-assigned importance), within-tier by deadline
  proximity, ties by `project.id`. Five tiers that partition every ADR-0012 output:
  (1) at_risk; (2) stale-evidence or explicit blocker — "verify"; (3) needs owner
  input (`deadline-unknown`/`scope-changed`); (4) awaiting evidence
  (`insufficient-history`/`execution-unknown`); (5) on_track. Most-urgent-tier-wins
  (first-match top-down). This is the contract this slice implements verbatim.

**Acceptance Criteria:**

1. **Deterministic, explained ordering.** Given each project's **derived
   forecast/risk read (state + ADR-0012 reason)** from 009-02, its deadline, and
   (when present) its blocker text — never raw signals — `src/derive.mjs` produces
   a total ordering; the same inputs always yield the same order, and each ranked
   entry carries a short reason for its position (tier label + within-tier key).
2. **ADR-0013 tiers applied verbatim.** The ranking implements the five-tier
   partition exactly (at_risk → stale/blocked → needs-owner-input → awaiting-
   evidence → on_track), each ADR-0012 reason mapped to its tier per ADR-0013;
   most-urgent-tier-wins (first-match top-down); within-tier by deadline proximity
   (soonest concrete date first; `unknown` deadline last in its tier); ties by
   `project.id`. The slice cites ADR-0013.
3. **Never a rewrite of project-local priority.** The queue expresses only
   cross-project attention order; it does not reorder, mutate, or write any
   project's own local priorities or source repo (authority model). `unknown`
   forecast/risk and `unknown` deadlines are ordered by an explicit, explained
   rule — not silently sunk or floated.
4. **Registry-set in, no adapter reach.** The cross-project ranking receives the
   project-id set from its caller (registry-derived); `src/derive.mjs` still
   imports no adapter and not `src/scan.mjs`, and writes nothing (ADR-0006).
5. **The dashboard shows the queue.** The dashboard renders the ranked attention
   queue with each entry's reason, distinct from the per-project cards — a user
   can read "what to pick up next across the portfolio" at a glance.

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Coverage exercises: deterministic ordering (fixed fixtures → fixed order);
      each of the five tiers populated; every ADR-0012 reason mapped to its correct
      tier (incl. `execution-unknown`→4, `stale-evidence`→2); most-urgent-tier-wins
      when a project matches multiple tiers (e.g. at_risk + blocker); within-tier
      deadline-proximity ordering with `unknown` deadline sorting last; `project.id`
      tie-break; the no-local-priority-rewrite invariant; the import-boundary
      invariant; and the dashboard render.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance). Craft pass run.
- [ ] **Architecture review passed** (`arch_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] ADR-0013 (attention-overlay policy) is Accepted and linked (done);
      `docs/refinement-todo.md` "Cross-project attention overlay" already resolved;
      status board updated.
- [ ] **Primer hygiene (closes spec 009):** this slice closes the spec — apply the
      compress-on-close-out rule to `CLAUDE.md` and confirm the MVP loop is
      reflected in the release plan.

**Anti-horizontal-phasing check:** after this slice a user opens the dashboard and
sees an explained ranked list of which project to attend to next across the whole
portfolio — the cross-project decision layer is visible end to end.

### Assumptions

- The queue keys on the **derived forecast read (state + reason)** plus deadline
  plus optional blocker — not raw per-signal freshness (ADR-0013: consuming the
  derived read keeps the "stale = source-repo-quiet, not collection-lapse"
  grounding honest). No richer per-project comparability (e.g. comparing spec
  counts across projects) is assumed — the product-vision warns against pretending
  work units are comparable.
- The `narrative` blocker field (tier-2's optional trigger) is present only for
  legacy-Compass sources; where absent, tier 2 rests on the `stale-evidence`
  forecast reason alone, never a fabricated blocker (ADR-0013). Confirm the exact
  field (`narrative.value.blockers`) against `src/observation.mjs` at implementation.
