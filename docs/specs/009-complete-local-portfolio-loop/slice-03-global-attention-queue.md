---
status: DRAFT
dependencies: [009-02, adr-0006]
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
- ⛔ **Blocking decision — cross-project attention-overlay policy.** The
  "Cross-project attention overlay" item in `docs/refinement-todo.md` (the
  smallest central policy that expresses portfolio intent — ordered projects,
  coarse tiers, or deadline-plus-attention rules) must be resolved before this
  slice goes `READY_FOR_IMPLEMENTATION`. This is a load-bearing choice with
  rejected alternatives → resolve it via **`jig:adr-workflow`** (a small ADR),
  not an ad-hoc rule. This DoR item is the gate.

**Acceptance Criteria:**

1. **Deterministic, explained ordering.** Given the per-project forecast/risk
   reads (009-02) plus deadlines and freshness, `src/derive.mjs` produces a total
   ordering of projects; the same inputs always yield the same order, and each
   ranked entry carries a short reason for its position.
2. **The decided overlay policy is applied verbatim.** The ranking implements the
   policy resolved in the DoR ADR exactly (e.g. tier, then deadline proximity,
   then risk) and cites it; ties break by a stated deterministic key.
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
- [ ] Coverage exercises: deterministic ordering (fixed fixtures → fixed order),
      tie-breaking, placement of `unknown` risk/deadline per the decided rule,
      the no-local-priority-rewrite invariant, the import-boundary invariant, and
      the dashboard render.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance). Craft pass run.
- [ ] **Architecture review passed** (`arch_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] The attention-overlay ADR is Accepted and linked; `docs/refinement-todo.md`
      item marked resolved; status board updated.
- [ ] **Primer hygiene (closes spec 009):** this slice closes the spec — apply the
      compress-on-close-out rule to `CLAUDE.md` and confirm the MVP loop is
      reflected in the release plan.

**Anti-horizontal-phasing check:** after this slice a user opens the dashboard and
sees an explained ranked list of which project to attend to next across the whole
portfolio — the cross-project decision layer is visible end to end.

### Assumptions

- Forecast/risk, deadline, and freshness are sufficient inputs to express the
  MVP's portfolio intent; whether a coarser or richer overlay is needed is
  exactly the DoR policy decision. No richer per-project comparability (e.g.
  comparing spec counts across projects) is assumed — the product-vision warns
  against pretending work units are comparable.
