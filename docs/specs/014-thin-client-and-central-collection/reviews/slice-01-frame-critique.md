---
slice: 014-01 — session-stop capture hook + auto-installer
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique round 4)
reviewed_at: 2026-08-18T23:50:15Z
prompt_source: review.py frame-critique
---

VERDICT: pass (frame-critique, round 4)

Frame survives; all load-bearing assumptions reconcile against grounding:
- observeProject observes the matched project's project.path (main tree);
  gitInfo runs read-only rev-parse/rev-list/log, so AC3's "never writes within
  project.path" holds and unmerged worktree state cannot enter progress(t).
- collectObservation runs assertDisjoint before every write (state.mjs) — the
  read-only-source boundary is inherited, not newly asserted.
- Pace is endpoint-based over (latestFraction - earliestFraction)/spanDays
  (derive.mjs:162) — density-invariant, confirming the owner-settled
  "capture unconditionally, accept honest at_risk" decision: added flat captures
  are forecast-neutral, and currency/hygiene are correctly handed to 014-02.

Non-blocking reconciliation notes (carry to implementation):
- Missed-trigger coverage gap (not wrong): a git worktree created OUTSIDE
  project.path yields a cwd under no project.path -> clean AC2 no-op, no capture.
  Note if external worktrees are in scope. Content is always the main tree
  regardless of session location.
- A2 ("session end is a reasonable cadence") remains a marked, unresolved
  assumption — acceptable because density-invariance + 014-02 currency absorb
  both clustering and idle-gap failure modes.

Rounds 1-3 (needs-changes) drove: non-regression framing, content-dedup removal
(owner decision), worktree-observation grounding. This round confirms the
converged unconditional-capture frame.
