---
slice: 011-04 — warnings collapse to a header ⚠ icon + tooltip
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T17:58:55Z
prompt_source: review.py implementation .../spec.md 011-04 public/index.html test/runtime.test.mjs
---

Compliance review of 011-04 — warnings → header ⚠ icon + tooltip. VERDICT: pass; 299/299 green.
AC1 ⚠ gated on warningItems().length (clean project = no icon, tested). AC2 tooltip plain-language, worktree name but no doc path (no-path assertion loops every item + card HTML). AC3 old .warnbox block + CSS fully removed (non-vacuous vs pre-slice). AC4 tabindex=0 + role=img + aria-label + title + :focus outline (not hover-only). No vacuous tests.
Minor (→ deviation log): collection-status item interpolates raw e.message; if a source error message embedded a path it would surface (source error text, not a constructed path; esc-safe). Tooltip wording folds "stale" into the "forgotten" label vs the spec's e.g. example.
