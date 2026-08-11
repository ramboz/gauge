---
slice: 012-05 — team signals: human-vs-agent split + contributors
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T20:37:08Z
prompt_source: review.py implementation .../spec.md 012-05 <deliverables>
---

Compliance review of 012-05 — team signals: agent split + contributors. VERDICT: pass; 415/415 green.
AC1 agent-split deriver (share of Co-Authored-By: Claude commits over shared window). AC2 proxy caveat present ("~N%" + "(proxy)" label + tooltip). AC3 contributor count (distinct authors). AC4 unknown vs 0%: null only when window empty; real 0% when commits present but none agent-coauthored (tested). AC5 no-PII by construction (author names → Set → discarded; return shape has no name field; render-guard test). AC6 shared DEFAULT_VELOCITY_WINDOW_WEEKS, injected nowMs.
Reconciliation: architecture.md /api/data team join added. Regex line-anchored (kills quoted-body + "Claudette" false positives). Sub-1% floor ("< 1%" for tiny non-zero share). Stale test comment fixed.
