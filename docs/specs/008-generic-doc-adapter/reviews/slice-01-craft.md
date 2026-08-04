---
slice: 008-01 — Flat layout + honest completion (jig preset unchanged)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:24:12Z
prompt_source: review.py pr-review
---

The slice implements a clean, additive `specLayout` capability (schema + runtime validator + flat reader) and a root-granularity, vocabulary-gated completion gate that reports honest `unknown` instead of a fabricated 0%. The new middle branch in `runJigAdapter` only diverts roots with no recognized delivery status, so every existing fixture stays byte-identical, and the flat reader shares `titleOf`/status resolution with the nested reader. Test coverage is strong and honest (deterministic fixture, tmpdir delivery-status cases, byte-identical regression, guarded read-only real-corpus smoke). No blockers.

Strengths:
- [strength] src/observation.mjs — three-way execution branch (no-specs→unknown; ≥1 recognized→supported/progressOf unchanged; specs-but-no-recognized→unknown) is a minimal fix for false-0% without disturbing existing cards; the load-bearing rationale comment keeps it safe to extend.
- [strength] src/scan.mjs — `titleOf` factored out and shared so flat/nested titles cannot diverge; layout-aware `hasJigEvidence` correctly gates the card on a real matching artifact (AC5).

Nits (reconciliation-log items, non-blocking):
- [nit] Document count smuggled through the freshness/resolution reason string forces a renderer to regex-parse a reason; track a structured-field follow-up.
- [nit] `specLayout: 'auto'` validates but silently falls through to nested until 008-02; a "reserved, treated as nested" note would remove surprise.
- [nit] `scanSpecsFlat` sorts twice (readdir sort redundant given final id sort); harmless.
- [nit] No test directly asserts a nested spec title; extraction fidelity rests on indirect byte-identical comparisons.
