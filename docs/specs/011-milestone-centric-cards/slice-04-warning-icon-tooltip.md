---
status: DRAFT
dependencies: [011-01]
last_verified:
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
- [ ] All ACs pass; full suite green.
- [ ] Tests/checks cover: icon-suppressed-when-clean, icon-shown-with-items,
      tooltip content assembly (no paths), and the removal of the old block.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed (compliance + craft). Deviation log + reconciliation sweep.
