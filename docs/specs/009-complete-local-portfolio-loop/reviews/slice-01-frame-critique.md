---
slice: 009-01 — Goal/deadline onboarding authoring
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2nd pass)
reviewed_at: 2026-08-05T17:38:06Z
prompt_source: review.py frame-critique .../spec.md 009-01 <slice>
---

VERDICT: pass (2nd pass)

Frame-critique on slice 009-01. First pass returned needs-changes: the tested-deterministic
ACs (hint precedence, re-onboard non-clobber merge) conflicted with ADR-0011's human/Claude-assisted
prose comprehension, and an auto-merge would break discover.mjs's edge-purity (verified: onboard.mjs
is a config-blind stdout emitter; profile is config-inline; discover imports only node builtins +
safeProjectId).

Resolved by scoping the slice's tested runtime surface to the deterministic parts:
- AC2 surfaces candidate source ARTIFACTS by existence in precedence order (an authoring pointer),
  never a parsed value.
- AC3 forbids any prose->date code path.
- AC4 is propose-only (stdout / drop-in when none exists) and never overwrites an existing authored
  profile, so no runtime merge is added and discover.mjs edge-purity is preserved.
- The prose->value comprehension is declared a human/Claude-assisted authoring workflow, out of
  unit-test scope (first ## Assumptions bullet), matching ADR-0011 Option C.
- DoD coverage re-scoped to match.

Two non-load-bearing wording nits noted; the Goal-wording nit ("values"->"candidate artifacts") was
applied post-verdict. The ADR-0011 cutline reconciliation (GitHub-milestone Include->deferred) remains
carried in the DoD, routed through shaper:cutline / owner approval.
