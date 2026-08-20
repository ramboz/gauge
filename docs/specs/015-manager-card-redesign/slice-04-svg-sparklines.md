---
status: DRAFT
dependencies: [015-03]
last_verified:
design_review: true
---

## Slice 015-04 — SVG sparklines

**Goal:** Replace the unicode-block sparklines (`SPARK_BLOCKS = '▁▂▃▄▅▆▇█'`,
[`public/index.html:267`](../../../public/index.html)) with inline SVG polyline
sparklines per the mockup, so trend lines are crisp, fixed-width, and cannot
overflow the stat tile.

**DoR:**
- ✅ 015-03 DONE (stat tiles host the sparkline as a `.n` value).

**Acceptance Criteria:**

1. **SVG, not unicode.** `sparkline()` emits an inline `<svg>` (mockup: `64×18`
   viewBox, a `<polyline>` with `fill:none; stroke:var(--accent);
   stroke-width:1.5`) with points computed from the buckets and normalized to
   the viewBox height — no `▁▂▃…` characters remain in the rendered card.
2. **Both consumers switch.** The velocity sparkline (git trailing-8-week) and
   the observation-time trend sparkline both render as SVG.
3. **Graceful degradation.** Empty, single-point, or flat bucket series render a
   valid, non-overflowing SVG (a flat baseline), never a JS error and never a
   stray unicode run.
4. **Accessible.** The SVG keeps the existing descriptive `title`
   ("weekly commits, oldest → newest" / "over accrued observations, oldest →
   newest") and an appropriate `role`/`aria-hidden`, matching today's a11y
   affordance.
5. **Fixed width, no overflow.** The sparkline is a fixed 64px wide and sits
   inside its stat tile; no horizontal overflow at the 340px card track. Suite
   green.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Design-fidelity: servo `design-eval` score meets threshold for the
      sparkline, attested at `REVIEWED` — the final slice's score is the
      whole-card fidelity number.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice every card's trend lines are
crisp SVG that fit their tiles — the last visible step to the mockup, closing
the redesign.
