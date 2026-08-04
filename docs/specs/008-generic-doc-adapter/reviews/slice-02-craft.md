---
slice: 008-02 — Auto-detect + discovery emits `specLayout`
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:49:00Z
prompt_source: review.py pr-review
---

The slice cleanly delivers `specLayout: auto` read-time resolution and discovery emission of a detected `flat` layout, factored around a single shared `detectLayout` in the pure `discover.mjs` so the reader, the evidence gate, and the discovery emitter cannot diverge. Detection is deterministic (nested-first, mixed→nested per ADR-0010 A3; empty→nested), read-only, wired end-to-end through config.mjs. Tests assert exact emitted profile shape, 007 nested identity, byte-identical auto-vs-explicit reads, and purity. No blockers.

Strengths:
- [strength] One `detectLayout` shared between discovery emission and adapter read-time `auto` resolution; `hasJigEvidence` reuses the same `resolveLayout` so gate and reader always agree.
- [strength] Discovery emits concrete `specLayout: 'flat'` (never `auto`), a deterministic drop-in; nested stays byte-identical.
- [strength] `auto`-resolved reads asserted deepEqual to explicit nested/flat reads — strong regression guard.

Nits (reconciliation-log items, non-blocking):
- [nit] The "attach specLayout only when flat" rule is implemented in two places (`entriesFrom` and the single-entry `discoverHeuristic` branch); a tiny shared helper would prevent a future one-sided change.
- [nit] For an `auto` profile `detectLayout` runs twice per scan (hasJigEvidence + scanSpecs), each a fresh readdirSync; harmless for corpora in scope; explicit nested/flat short-circuit entirely.
- [nit] Real-corpus smoke hardcodes a machine-specific path and skips when absent; the proj-mixed fixture already carries the equivalent shape, so the smoke's unique value is only the untouched-real-source read-only assertion.

No scope deviations observed.
