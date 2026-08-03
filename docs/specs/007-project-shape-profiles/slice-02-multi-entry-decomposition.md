---
status: DRAFT
dependencies: [007-01]
last_verified:
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-02 — Multi-entry decomposition (Pattern C)

**Goal:** A profile can declare multiple entries so one repository renders N
portfolio cards, each with its own artifact root and progress — turning
`personalization-workspace` from a single blind generic card into three real
track cards (`rtb`, `offer-management`, `contextual-experimentation`).

**DoR:**
- ✅ 007-01 DONE (single-entry profile + artifact-root resolution in place).
- ✅ D2 (one-repo→N-entries identity & state layout) resolved — composite id
  scheme and shared-repository-signal decision recorded (ADR-0009 addendum or its
  own note).

**Acceptance Criteria:**

1. **Profile v1 expresses entries.** The profile gains an optional `entries`
   array; each entry has `id`, `label`, and an `artifactRoot` (plus the same
   optional overrides as 007-01). A profile with `entries` expands one
   `gauge.config.json` project into **N observations**; a profile without
   `entries` behaves exactly as 007-01 (single entry).
2. **Composite identity is valid and disjoint.** Each entry observation carries a
   composite id `<baseId>-<entryId>` that satisfies
   `^[a-z0-9][a-z0-9-]{0,63}$`; entries share the umbrella repository/git signal
   (per D3) but carry their own execution/workstreams from their own root.
3. **State layout stays safe.** Each entry's immutable records land under its
   composite id in `stateDir`; the ADR-0005 source/state disjointness and
   containment guarantees still hold, with no cross-entry collision.
4. **Pattern C renders three real cards.** Observing `personalization-workspace`
   with a 3-entry profile renders three cards with per-track progress that matches
   `tracks/<name>/specs` (rtb ~6, offer-management ~5, contextual-experimentation
   decisions-only → execution `unknown`, not a false 0/0 per #6). Single-entry and
   no-profile projects are unchanged.
5. **The dashboard is unambiguous.** N cards from one config entry are labelled by
   entry `label`, ordered deterministically, and never merge across entries.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage: entries expansion, composite-id validity, per-entry root
      isolation, state-disjointness for multi-entry, and a real-corpus smoke
      against `personalization-workspace`.
- [ ] Reviewed (compliance + craft + arch).
- [ ] Deviation log + Reconciliation sweep produced.
- [ ] `docs/refinement-todo.md` entry updated (07-02 resolves the multi-entry half).

**Anti-horizontal-phasing check:** After this slice, one config entry for the
umbrella repo yields three real track cards on the dashboard where there was one
empty generic card — end-to-end, observable value.

### Deviation log (after reconciliation)

_Filled during reconciliation._

### Reconciliation sweep

_Filled during reconciliation._
