---
slice: 009-02 — Forecast/risk derivation
pass: arch
verdict: pass
reviewer: general-purpose (arch-review)
reviewed_at: 2026-08-05T18:54:23Z
prompt_source: review.py arch-review docs/specs/009-complete-local-portfolio-loop/spec.md 009-02 <deliverables>
---

VERDICT: pass
ADR-0006 import boundary trivially closed: src/derive.mjs has ZERO imports (structurally unbreakable);
deadline is a caller-passed parameter; all I/O stays in server.mjs; observation-v1 contract untouched;
collection.status never consulted (AC4 by construction). attachForecasts in derive.mjs is the correct
seam (cross-project fold is derivation policy; the composition point 009-03 will extend). Nits (log-only):
attachForecasts couples to the current-state read's object shape (project.id/deadline.value) at the
composition boundary — caller-passed data, not an import, so boundary intact; naming drift. Carry the
two-read-layer coupling as a one-line deviation note so 009-03 inherits it deliberately.
