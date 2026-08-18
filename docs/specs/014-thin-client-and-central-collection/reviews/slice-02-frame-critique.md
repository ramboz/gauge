---
slice: 014-02 — capture-validity hardening: honest RAG on captured history
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique round 5)
reviewed_at: 2026-08-18T23:55:37Z
prompt_source: review.py frame-critique
---

VERDICT: pass (frame-critique, round 5 — frame survives)

The corrected AC4 frame reconciles cleanly against grounding:
- Gate 2 split is real (derive.mjs:109 keys on the spliced live tail's execution
  freshness = gitFreshness(lastCommit, collectedAt), lib.mjs:351, STALE_AFTER_DAYS=14):
  fresh-but-flat -> pace fold -> at_risk('no-forward-progress') (:197);
  quiet (>14d) -> unknown('stale-evidence') (:109). "No false on_track off a frozen
  latest" is mechanically supported.
- No spurious scope-changed: live tail and stored captures share the single
  observeAll code path (server.mjs:34), so denom is computed identically — the
  splice can't fabricate a Gate-4 scope move on stable scope.
- Hygiene is forecast-neutral (pace is 2-endpoint, :162).

Two reconciliation notes applied to the slice (precision, not broken premises):
1. AC5 now states the >=2 bar is measured POST-splice (Gate 3 counts the tail);
   insufficient-history means 0 stored supported records or span < 1 day.
2. The "idempotent tail" edge case reworded: the tail is ALWAYS appended (never
   "skip when equal", which would reintroduce the frozen-latest false on_track);
   endpoint-based pace means the equal-value tail extends span without double-count.

Round history: R1 wrong pace mechanism; R2 dedup-belongs-in-014-01 + drop worktree
AC; R3 stall fix must be read-layer; R4 Gate-2 collision on quiet-vs-at_risk; R5 pass.
