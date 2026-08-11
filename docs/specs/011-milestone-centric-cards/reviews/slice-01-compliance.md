---
slice: 011-01 — active-and-next milestone from release Status
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T16:57:44Z
prompt_source: review.py implementation docs/specs/011-milestone-centric-cards/spec.md 011-01 <deliverables>
---

Independent compliance review of slice 011-01 — active-and-next milestone from release Status.

VERDICT: pass. All six ACs met; full suite green (266/266, verified via npm test).

Per-AC: AC1 active = shipping??committed, lexicographic path tie-break (milestone.mjs:27, tested); AC2 next = candidate+committed-not-active, active excluded by path; AC3 goal=active.title, project-description goal no longer rendered; AC4 appetite inline, TBD/absent→unknown; AC5 per-spec <details> removed (paired positive assertion keeps test honest); AC6 graceful no-active (shipped-only/unparsed/empty/undefined → null, no crash).

Non-blocking notes (→ reconciliation): (1) docs/architecture.md /api/data contract-surface prose does not yet mention the new milestone:{active,next} join; (2) low-confidence edge — a second concurrent `shipping` release that loses the tie-break is excluded from both active and next (matches AC2 literal wording, not a violation).

Tests substantive, not vacuous. No blocking issues.
