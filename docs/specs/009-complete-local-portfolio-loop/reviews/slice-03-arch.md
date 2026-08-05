---
slice: 009-03 — Global attention queue
pass: arch
verdict: pass
reviewer: general-purpose (arch-review)
reviewed_at: 2026-08-05T19:23:33Z
prompt_source: review.py arch-review docs/specs/009-complete-local-portfolio-loop/spec.md 009-03 <deliverables>
---

VERDICT: pass
attentionQueue extends src/derive.mjs exactly where ADR-0006 places it (history-derived layer, downstream
of forecast/risk, pure fold over attachForecasts output). All four invariants hold: derive.mjs still
zero-import; attentionQueue mutates nothing (fresh entries throughout); registry project-id set arrives via
caller data; observation-v1 untouched. server->derive->dashboard flow clean; I/O stays in server. Nits
addressed: shared forecast ref -> copy; tierOf malformed-forecast default -> tier 2 "verify" (was tier 5
on_track — honesty fix, "never coerce unknown to healthy"). Reconciliation: flip architecture.md
forward-looking "will extend" phrasing to landed-tense at spec-009 close-out.
