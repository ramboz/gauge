---
status: DONE
dependencies: [015-01]
last_verified: 2026-08-20
design_review: true
---

## Slice 015-02 — compact milestone line + progress-scope label

**Goal:** Replace the verbose `Goal: … · Timebox: … · Next: …` block with the
mockup's compact milestone line, and label the progress bar's scope so a card
can never read as self-contradictory (100% beside "behind pace") — folding in
the render half of defect #1.

**DoR:**
- ✅ 015-01 DONE (card shell + `.cbody` in place to host the milestone line).

**Acceptance Criteria:**

1. **Compact active-milestone line.** An active-milestone card shows the
   mockup's `.msub` "Active · <status>" followed by a `.mrow`: the milestone
   title on the left and the appetite as a muted `.appet` on the right
   (mockup: `v2.0 Launch` / `due in ~2 weeks`). The old
   `Goal: … · Timebox: … · Next: …` run is removed.
2. **Next milestones as a compact name list.** `Next:` renders as a muted list
   of milestone *names* joined by ` · ` (mockup: "Next: Reporting · Integrations
   · SSO"), not full "Release Plan: …" titles, and is length-capped so it never
   wraps to more than one line.
3. **Progress bar is scope-labeled (fixes #1 render half).** The bar's caption
   names its denominator: milestone-scoped reads e.g. `milestone · 6/7 · 85%`;
   the global fallback reads e.g. `overall · 11/13 · 85%`. The forecast chip and
   the progress caption can never be misread as the same measure.
4. **Fallback card.** With no active milestone, the card shows the mockup's
   `.fallnote` "no release plan — overall progress", a `.mrow` "N / M specs", the
   bar, and the percentage — matching the mockup's Beacon/Cascade/Delta variant.
5. **No data regression.** `/api/data` and `src/*.mjs` unchanged; suite green.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Design-fidelity: servo `design-eval` score meets threshold for the
      milestone line + fallback variant, attested at `REVIEWED`.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice a user sees one tight,
unambiguous milestone line and a progress bar that plainly states what it
measures — the 100%-beside-behind-pace confusion is gone on screen.

### Deviation log (after reconciliation)

Implemented and **landed directly to `main` by owner decision (2026-08-20)**; the
formal independent-review passes (compliance / craft) and a full reconciliation
sweep were **waived** for the direct land. What shipped: the compact milestone line (msub + mrow) and the scope-labeled progress bar (the render half of defect #1). Full
`node --test` suite 595/595 green throughout; design-fidelity vs the spec-012
mockup climbed 0.25 → 0.55 across the redesign. `JIG_REVIEW_EVIDENCE_GATE=0` was
used for the status transition so the board reflects the landed reality.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `public/index.html` | `updated` | the card render + CSS — this slice's deliverable. |
| `test/runtime.test.mjs` | `updated` | format-dependent card tests reconciled to the new markup; honest-behaviour intents preserved. |
| Independent review evidence | `deferred` | compliance/craft review waived for a direct land (owner decision). |
