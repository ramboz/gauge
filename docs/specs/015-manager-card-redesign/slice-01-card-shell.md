---
status: IN_PROGRESS
dependencies: []
last_verified:
design_review: true
claimed_by: claude/jig-orient-3599d4
---

## Slice 015-01 — card shell, overflow discipline, drop the workstream dump

**Goal:** Replace the card's structural shell with the mockup's callout-band +
`.cbody` layout, add real CSS overflow discipline so no content escapes the card
box, and remove the redundant all-workstreams dump — delivering tight,
non-overflowing cards as the foundation the later slices build on.

**DoR:**
- ✅ Servo stood up on Gauge: `/servo:scaffold-init` has installed `oracle.sh` +
  `.servo/`, and `/servo:design-eval` has authored a frozen fidelity eval against
  `manager-dashboard-mockup.html` with a `score_design_fidelity` component (A1).
  This is the shared gate for every 015 visual slice.
- ✅ The mockup's card-shell CSS values are extracted (below) and agreed as ACs.

**Acceptance Criteria:**

1. **Grid items stop overflowing.** `.card` (a CSS-grid item) sets
   `min-width:0`, so at the `.grid` track's 340px minimum the card's widest
   content (long release titles, sparklines) no longer forces the card past its
   own border. Observable: the Jig card's velocity sparkline (which currently
   runs off the right edge) is fully contained.
2. **Card shell matches the mockup structure.** Each card is a `.pcard`
   (`border-left-width:4px`, `border-radius:12px`, `overflow:hidden`, body
   padding `0 0 14px`) whose top is a RAG-tinted **callout band**
   (`background: color-mix(in srgb, <rag-color> 12%, transparent)`) carrying the
   project name, a short status phrase, and the ⚠ flag; the signals sit in a
   padded `.cbody` below. The left-border color still encodes the RAG band
   (green/yellow/red/gray) exactly as today.
3. **Text rows wrap, never overflow.** Card text rows set
   `overflow-wrap:anywhere` (or equivalent) so a single long unbreakable token
   cannot widen the card beyond its grid track.
4. **The workstream dump is gone (#2).** The card no longer renders the full
   list of release-plan workstream rows. Release context is carried only by the
   compact milestone line (delivered in 015-02), never as a repeated row list.
   Observable: the Gauge card no longer shows six "Release Plan: …" rows.
5. **No data regression.** Every signal the card showed before is still present
   (relocated, not removed); `/api/data` and all `src/*.mjs` are unchanged; the
   full `node --test` suite stays green.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Design-fidelity: the servo `design-eval` score against the mockup meets
      the eval's threshold for the card-shell + callout band, attested at
      `REVIEWED` (`design_review: true`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice a user opening
`localhost:5111` sees tight, non-overflowing cards with a clean callout band and
no repeated release dump — an immediately visible, end-to-end improvement, not
scaffolding for a later slice.
