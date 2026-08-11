---
slice: 011-01 — active-and-next milestone from release Status
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T17:05:36Z
prompt_source: review.py reconciliation docs/specs/011-milestone-centric-cards/spec.md 011-01
---

Independent reconciliation review of slice 011-01.

VERDICT: pass. Deviation log faithful to landed code on every checked point
(milestone.mjs deriver + byPath extraction; lib.mjs parsers + stripDeadlineLabel;
scan.mjs no-extra-I/O enrichment; card Goal/Timebox render with old goal/deadline
+ per-spec <details> gone). Reconciliation sweep dispositions credible:
architecture.md /api/data updated (milestone join named), observation-v1 no-op
(read-layer join, ADR-0005/0006), CLAUDE.md no-op (spec in flight),
lightweight-decisions deferred with a concrete spec-close trigger. Principles OK
(derive-never-ask, zero-dep, unknown preserved); no doc scope-creep. 267/267 green.
