---
slice: 014-03 — history-derived velocity + cost trends
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique round 2)
reviewed_at: 2026-08-18T22:56:23Z
prompt_source: review.py frame-critique
---

VERDICT: pass (frame-critique, round 2)

The round-1 hazards are honestly closed. A3 no longer claims cost.mjs reads
timestamps; it correctly states time-bucketing is net-new and that dedupeRecords
keeps first-by-filename-sort (arbitrary w.r.t. chronology), with replay-timestamp
stability unverified. AC1 makes replay-stable chronology a GATING probe whose
winner is the filename-sort survivor (the correct object to test), with an
explicit "degrade to unknown, never a plausible-but-wrong series" backstop. The
frame is internally coherent: if replays preserve the original timestamp, the
arbitrary dedup order becomes irrelevant, so replay-stability subsumes the
dedup-order hazard. Velocity correctly carved out as git-reconstructable.

Non-blocking notes carried to implementation (deviation log):
- Global-vs-window unknown: an AC1(b)/(c) failure (replays rewrite timestamps) is
  a GLOBAL contract failure -> whole cost trend to unknown, not "affected window";
  keep that distinct from AC3's per-record un-attributable-window degradation.
- Document which duplication path(s) the probe exercised (resume/replay vs
  context-compaction/forking) so the gate's scope is honest.
- Pin down that the new velocity TREND (accrued-observation window) is distinct
  from velocityFromTimestamps' existing 8-week bucket sparkline, not a rename.
