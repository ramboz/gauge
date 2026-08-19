---
slice: 014-04 — live-session "running now" enrichment (optional)
pass: arch
verdict: pass
reviewer: general-purpose (arch)
reviewed_at: 2026-08-19T04:27:00Z
prompt_source: review.py arch-review
substrate: not-shown
applied_skill: none
---

PASS. Read-only-observer identity honored (marker written only under stateDir/active-sessions; read path stat-only, no transcript content — ADR-0005/AC8). Pure/impure split textbook (runningProjectIds/attachRunningNow pure; I/O in readActiveSessionMarkers + server). Composition with the live-tail splice genuinely separate (attachRunningNow is a distinct additive boolean join, no double-appended now endpoint). Hook-install generalization backward-compatible; uninstall empty-key deletion correct. Optional/absent-safe by construction; zero new deps (ADR-0001). Nit recorded in refinement-todo: stale-marker GC / bounded active-sessions scan for beyond-MVP session volume. Owned residual (transcript-mtime write-event cadence) honestly documented.
