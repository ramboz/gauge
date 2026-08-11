---
slice: 011-04 — warnings collapse to a header ⚠ icon + tooltip
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T17:58:55Z
prompt_source: review.py pr-review .../spec.md 011-04 public/index.html test/runtime.test.mjs --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 011-04. VERDICT: pass. XSS-safe by construction (warningItems returns plain text; card() escapes the joined tooltip once at the render boundary via esc() in double-quoted title/aria-label — hostile error text inert). Accessibility proper. Tests run the real vm-extracted script, not a reimplementation.
SPECIFIC ISSUES (all non-blocking → deviation log):
- [nit][impl] (p.errors||[]).map(e=>e.message).join(' · ') yields literal "undefined" if an error lacks .message; filter falsy (.filter(Boolean)).
- [nit][impl] worktree dedup-by-group Map built twice (worktreeInfo stores {paths,pr}, warningItems stores pr) — could drift; a shared groupWorktrees(docs) would keep lockstep (below extract threshold, low priority).
- [nit][impl] WT_CLEANUP_LABEL is a second terser label vocab for the same groups as WT_GROUP_META[g].label — worth a tie-together comment.
- [strength][impl] render-boundary escaping; pure DOM/fs-free warningItems reusing WT_CLEANUP_GROUPS/wtGroup; accessible affordance; realm-boundary-aware tests.
Two negative tests (clean → no icon; no warnbox) are appropriately paired with positive counterparts — sound, not vacuous.
