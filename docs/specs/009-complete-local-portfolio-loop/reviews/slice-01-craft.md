---
slice: 009-01 — Goal/deadline onboarding authoring
pass: craft
verdict: pass
reviewer: general-purpose (pr-review)
reviewed_at: 2026-08-05T17:57:37Z
prompt_source: review.py pr-review docs/specs/009-complete-local-portfolio-loop/spec.md 009-01 <deliverables>
---

VERDICT: pass
Clean, well-scoped. Standout: goal/deadline join kept at the read layer (joinProjectProfileFields), not
folded into observeAll/observation-v1, with a test asserting the persisted record stays untouched.
discover.mjs edge-purity preserved (existence-only, guarded by static import test). Runtime validators
derived from schema so they can't drift. XSS-safe card (esc). No blockers; all findings are [nit].
[nit][spec] config.mjs:106-112 — a profile with both entries[] and goal/deadline validates, but
expandEntries drops umbrella goal/deadline silently (single-entry is this slice's scope). Track as a
bounded reject-vs-thread follow-up in refinement-todo.
[nit][impl] observation.test.mjs static I/O guard slices the fn body by first unindented brace; a
reformat could weaken it. Defer-safe test-robustness nit.
