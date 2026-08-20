---
status: DONE
dependencies: [015-01]
last_verified: 2026-08-20
design_review: true
---

## Slice 015-03 — stat-tile row

**Goal:** Replace the stacked full-width velocity / team / cost text lines with
the mockup's compact `.stats` flex-wrap row of `.stat` tiles, so a card's
metrics read as one scannable strip instead of four stacked paragraphs.

**DoR:**
- ✅ 015-01 DONE (card shell + `.cbody` host the stat row).

**Acceptance Criteria:**

1. **Stat tiles per the mockup.** Velocity, token-cost, and team signals render
   as a `.stats` row: `display:flex; gap:16px; flex-wrap:wrap; border-top`.
   Each `.stat` is a `.n` value (bold ~14px) over a `.l` label
   (uppercase, ~10.5px, muted, `letter-spacing:.03em`) — mockup examples
   "3.5M / TOKENS · ~$70" and "60% / AGENT-DRIVEN".
2. **Wrap, not overflow.** On a narrow card the tiles wrap to a second line
   (`flex-wrap:wrap`) rather than overflow the card box.
3. **Honest unknowns.** A signal with no data renders an explicit tile
   (e.g. "— / COST UNKNOWN", "— / VELOCITY"), never a fabricated `0` and never a
   blank gap — preserving the product's unknown-state discipline.
4. **Old blocks removed.** The prior full-width `velocityBlock` / `teamBlock` /
   `costBlock` text lines are replaced by the tile row (no duplicate rendering).
5. **No data regression.** `/api/data` and `src/*.mjs` unchanged; suite green.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Design-fidelity: servo `design-eval` score meets threshold for the stat
      row, attested at `REVIEWED`.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice a user sees each project's
velocity, spend, and team split as a tight, aligned tile strip — a directly
visible density improvement.

### Deviation log (after reconciliation)

Implemented and **landed directly to `main` by owner decision (2026-08-20)**; the
formal independent-review passes (compliance / craft) and a full reconciliation
sweep were **waived** for the direct land. What shipped: the stat-tile block (token cost · agent-coauthored · velocity · cost trend), later reshaped into the tight 2×2 grid per owner direction. Full
`node --test` suite 595/595 green throughout; design-fidelity vs the spec-012
mockup climbed 0.25 → 0.55 across the redesign. `JIG_REVIEW_EVIDENCE_GATE=0` was
used for the status transition so the board reflects the landed reality.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `public/index.html` | `updated` | the card render + CSS — this slice's deliverable. |
| `test/runtime.test.mjs` | `updated` | format-dependent card tests reconciled to the new markup; honest-behaviour intents preserved. |
| Independent review evidence | `deferred` | compliance/craft review waived for a direct land (owner decision). |
