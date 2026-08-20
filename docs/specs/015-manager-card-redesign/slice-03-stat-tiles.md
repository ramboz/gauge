---
status: IN_PROGRESS
dependencies: [015-01]
last_verified:
design_review: true
claimed_by: claude/jig-orient-3599d4
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
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice a user sees each project's
velocity, spend, and team split as a tight, aligned tile strip — a directly
visible density improvement.
