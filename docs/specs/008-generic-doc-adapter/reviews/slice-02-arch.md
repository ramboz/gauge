---
slice: 008-02 — Auto-detect + discovery emits `specLayout`
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:49:00Z
prompt_source: review.py arch-review
---

Both load-bearing design choices are sound. (1) The new `src/scan.mjs → src/discover.mjs` import is strictly one-directional and preserves discover.mjs's edge-purity contract: importing `detectLayout` out of discover does not change what discover imports (still only node builtins + `safeProjectId` from config.mjs), the AC5 purity guard still holds, and there is no cycle (scan → discover → config → profile has no path back to scan). (2) `detectLayout` as the single shared heuristic is the right call — routing both the adapter's `auto` resolution and discovery's emission through one function makes "cannot diverge" real; mixed→nested / indeterminate→nested defaults plus emitting `specLayout` only for `flat` keep nested output byte-identical to 007-03. The byte-identical invariant is airtight because `resolveLayout` only calls `detectLayout` when `specLayout === 'auto'`, so the existing default-`nested` corpus never invokes detection.

Strengths: nested-before-flat precedence (A3); reader + evidence gate both route through `resolveLayout`; `specLayout` attached only when flat with identical key order for nested.

Nits (reconciliation-log items, non-blocking):
- [nit] `detectLayout` (a read-time heuristic reused by the adapter) lives inside the discovery module whose header frames its responsibility as authoring profiles; documented dual use, but a tiny shared layout util would keep discover's purpose crisp. Trade-off, not a defect.
- [nit] `hasFlat` treats any non-README top-level `.md` under specs/ as flat evidence (only when zero `<dir>/spec.md` exist); a nested repo mid-authoring with a stray NOTES.md and no spec.md yet would emit `specLayout: flat`. Acceptable indeterminate state.

Reconciliation notes: capture the scan→discover architectural coupling as intentional single-source-of-truth; capture that `auto`-opt-in is the mechanism behind ADR-0010 invariant (1). No architecture.md change needed — the existing derive-layer boundary note constrains derive.mjs, not scan.mjs.

VERDICT: pass
