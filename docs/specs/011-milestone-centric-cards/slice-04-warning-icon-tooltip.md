---
status: DONE
dependencies: [011-01]
last_verified: 2026-08-11
---

## Slice 011-04 — warnings collapse to a header ⚠ icon + tooltip

**Goal:** Collection warnings and cleanup-worthy signals stop occupying a top
block; they collapse to a single ⚠ icon in the card header whose hover/focus
tooltip explains what needs attention — keeping the card a high-level surface.

**DoR:**
- ✅ 011-01 landed (card header exists in its new form).
- ✅ Collection warnings and worktree cleanup state (stale/forgotten, ADR-0015)
  are already available per project.

**Acceptance Criteria:**

1. **Icon only when needed.** The ⚠ appears in the header **only** when there is
   something to report (collection warning, repository stale, cleanup-worthy
   worktree, or "no release plan" gap); a clean project shows no icon.
2. **Tooltip content.** Hovering/focusing the ⚠ reveals a tooltip listing each
   attention item in plain language (e.g. "forgotten worktree `sad-jepsen` —
   stale, no PR"), with **no file paths**.
3. **Top warnings block removed.** The previous full-width worktree warnings box
   is gone from the card body.
4. **Accessible.** The affordance is reachable and readable without a mouse
   (focus/keyboard), not hover-only.

**DoD:**
- [x] All ACs pass; full suite green. — 299/299.
- [x] Tests/checks cover: icon-suppressed-when-clean, icon-shown-with-items,
      tooltip content assembly (no paths), and the removal of the old block.
- [x] Each new test shown to fail when the feature is removed. — 10/12 red before
      implementation; the two negative tests (clean→no-icon, warnbox-removed) are
      paired with positive counterparts that fail on feature removal.
- [x] Reviewed (compliance + craft). Deviation log + reconciliation sweep. — both
      PASS (`reviews/slice-04-compliance.md`, `reviews/slice-04-craft.md`);
      reconciliation review below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **New pure helper `warningItems(p)` in `public/index.html`.** Returns a
  plain-language `string[]` (never a file path), assembled from: collection status
  ≠ ok (+ `errors[].message`), repository freshness `stale`, cleanup-worthy
  worktree docs (`WT_CLEANUP_GROUPS` via the existing `wtGroup`), and the
  "no release plan" gap (`!p.milestone?.active`, mirroring `card()`'s own
  fallback-note condition — single source of truth). DOM-free and fs-free, so it is
  unit-tested directly via the existing vm `cardContext()` idiom.
- **Header ⚠ affordance.** `<span class="warn-icon" tabindex="0" role="img"
  aria-label="…" title="…">⚠</span>`, rendered only when
  `warningItems(p).length`. Accessible name in both `aria-label` and `title` +
  a `:focus` outline (AC4 — keyboard-reachable, not hover-only). **XSS-safe by
  construction:** `warningItems` returns raw text; `card()` escapes the joined
  tooltip once at the render boundary via `esc()` in double-quoted attributes
  (craft pass verified hostile error text is inert).
- **`warnbox` removed; `infobox` retained as `worktreeInfo` (honest scope).** AC3
  targets the *warnings* box: the old `worktreeWarn()` split cleanup docs (→
  `.warnbox`) and healthy in-progress docs (→ `.infobox`). Only the `.warnbox` half
  + its CSS were removed; the `.infobox` "work in progress" list survives as a
  renamed `worktreeInfo(docs)` (unchanged behavior). Flagged so the reviewer knows
  the infobox retention is deliberate, not a missed removal.
- **Tooltip wording (accepted).** Items read e.g. "forgotten worktree
  `sad-jepsen`, no PR" — the spec's `stale` descriptor is folded into the
  "forgotten" `WT_CLEANUP_LABEL`. The spec example was "e.g."; no verbatim string
  was mandated.
- **Deferred nits (craft/compliance, non-blocking).**
  1. *Raw error `undefined` token* — `errors.map(e=>e.message)` yields the literal
     "undefined" if an error lacks `.message`; a `.filter(Boolean)` would clean it.
     Edge (esc-safe), logged.
  2. *Path-in-error-message edge* — a collection `e.message` is uncontrolled source
     text; if one embedded a path it would surface in the tooltip (AC2 wants
     path-free). Worktree items themselves are path-clean; the risk is source error
     text only. Logged as an accepted edge.
  3. *Worktree grouping duplicated* — `worktreeInfo` and `warningItems` each build a
     by-group/by-worktree Map (different value shapes); a shared `groupWorktrees`
     would keep them in lockstep (two call sites — below the ADR-0002 threshold).

### Reconciliation sweep

- **`docs/architecture.md`** → **no-op**: no contract surface touched —
  `warningItems` only reads already-consumed `/api/data` shapes (collection,
  repository/hygiene signals, errors, milestone) and renders them (compliance pass
  confirmed).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: render-only, no new field.
- **`docs/memory/glossary.md`** → **no-op**: no new domain term (worktree
  cleanup-state vocabulary already exists — ADR-0015/0016).
- **`CLAUDE.md` hot cache** → **no-op**: spec 011 still in flight; revisit at
  spec-close (011-05).
- **`docs/decisions/lightweight-decisions.md`** → **deferred (nudge)**: the ⚠
  affordance copy / `WT_CLEANUP_LABEL` vocabulary are UI-copy choices; kept in this
  deviation log while card copy is still being shaped (011-05 remains). Promote at
  spec-close if the labels stabilize.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.
