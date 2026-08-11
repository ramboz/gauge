---
slice: 011-03 — fallback card: global progress + discovered workstreams
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T17:42:12Z
prompt_source: review.py pr-review .../spec.md 011-03 public/index.html test/runtime.test.mjs --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 011-03. VERDICT: pass. Small, well-scoped; fallback gated on !active; pure summarizeDiscovered kept separate from markup; optional-chaining makes degrade-clean unthrowable.
SPECIFIC ISSUES:
- [nit][impl] AC3-compact test was vacuous (passed with feature reverted) — FIXED in reconciliation: merged with completed-treatment test + scoped chip assertion, red-on-revert confirmed.
- [nit][impl] AC4 <details><summary>specs</summary> assertion unfalsifiable — FIXED: removed; load-bearing 001-a/raw-path assertions retained.
- [nit][impl] discoveredRow step-string duplicates workstreamRow's (two call sites, below extract threshold — deferred).
- [nit][spec] fallback note copy imprecise for all-shipped sub-case (spec-mandated AC2 string — log only).
- [strength][impl] load-bearing comment on why gate is !active (distinct from 011-02's unresolved-specProgress fallback); pure done-treatment immune to zero-total steps.
