---
status: ABANDONED
dependencies: [003-01]
last_verified:
---

## Slice 003-02 — recency-expand-toggle

**Goal:** Keep the default Sessions view tight — just the running and
recently-active sessions — but let the owner reveal the older ones on a
project when she wants them, with an honest count of how many are hidden.
This is the "active-only by default, with a way to see more" interaction,
built entirely on the page from data 003-01 already emits.

**DoR:**
- ✅ 003-01 done: each session carries an `active` flag and each project a
  `sessionsTotal`, so active vs older is a client-side split with no rescan.

**Acceptance Criteria:**

1. **Default = active only.** Each card's Sessions section renders only
   `active` sessions by default (running or within the recency window),
   exactly as 003-01 ships.
2. **Show-older control.** When a project has ≥1 non-active session in the
   emitted list, a "show older" control appears; activating it reveals the
   remaining (non-active) sessions in the same section, ordered by
   last-activity descending. The control toggles back to hidden. No network
   request — purely client-side over the already-loaded data.
3. **Count summary.** The section header shows "N active · M older", where
   M counts the emitted non-active sessions; when `sessionsTotal` exceeds the
   emitted count (cap overflow from 003-01), a trailing "(+K not shown)"
   makes the truncation honest rather than silent.
4. **No-older case.** When every emitted session is active, no control and no
   "· M older" segment appear — just "N active" (or nothing, if the section
   is omitted for zero sessions).
5. **Tests.** Coverage for the header-count logic (active/older/overflow
   arithmetic) at whatever unit the page logic is testable at, consistent
   with how 002's page logic is covered; manual/browser verification of the
   toggle interaction noted in the deviation log.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Reviewed against spec — independent reviewer subagent; conditions
      closed.
- [ ] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice the owner can, per
project, expand past the recent set to the full recent-cap history and see
exactly how much is hidden — a complete, observable interaction on top of
003-01.

### Deviation log

_(to be written during reconciliation)_
