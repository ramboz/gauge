---
status: DRAFT
dependencies: [014-01]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-04 — live-session "running now" enrichment (optional)

**Goal:** Add an **optional** "running now" indicator to the card, sourced from a
**thin-client-owned active-session marker** — a `SessionStart` hook writes a
marker when a session begins, 014-01's `SessionEnd` hook clears it when the
session ends, and the set of live markers is "running now." Enriches the derived
"in flight" signal with what is actually active right now, and degrades cleanly to
today's branch/worktree/draft-PR derivation when no markers exist. This is the
seam to the engineer daily-driver; the manager view must never hard-depend on it.

**Design note (frame-critique, A4 reframed):** there is **no passive source** that
reliably reports "active session now" — `SessionEnd` proves session *end* is
observable, not active-now, and a transcript-mtime heuristic is stale-prone. So
the thin client **creates** the signal via a start/end bracket, grounded on the
same verified hook contract as 014-01 (`SessionStart` is a registered hook event
carrying `cwd`/`session_id` on stdin). See spec `## Assumptions` A4.

**DoR:**
- ✅ Assumption **A4 reframed and grounded** (spec `## Assumptions` A4): the
  signal is thin-client-owned (SessionStart marker written under `stateDir`,
  cleared by the 014-01 SessionEnd hook), not a hoped-for passive source. First
  implementation task re-confirms the `SessionStart` payload (cwd/session_id)
  against the installed Claude Code version — the cheap re-probe, not an open
  question.
- ✅ Slice 014-01 landed (its SessionEnd hook + installer are the home this slice
  extends: SessionEnd also clears the marker; the installer also registers the
  SessionStart hook).

**Acceptance Criteria:**

1. **SessionStart writes an active marker.** A `SessionStart` hook writes a marker
   `{session_id, cwd, startedAt}` under `<stateDir>/active-sessions/` (or
   equivalent), mapping cwd → project the same way 014-01 does. Observable: a
   marker file appears when a session starts in a configured project's tree.
2. **SessionEnd clears the marker (extends 014-01).** The 014-01 `SessionEnd`
   hook removes the matching marker by `session_id`. Observable: start → end
   leaves no marker for that session; the two hooks bracket cleanly.
3. **"Running now" from live markers.** When a project has a live (non-stale)
   marker, the card shows a "running now" indicator; a project with none does
   not. Computed in the read layer as a pure fold over the marker set (mirroring
   `attachVelocity`), one `/api/data` join.
4. **Enriches, never overrides, "in flight".** The live signal augments the
   existing in-flight derivation (branches/worktrees/draft PRs) additively — the
   derived signal remains the base; the marker adds the "active now" fact.
5. **Absent-safe by construction.** With no `active-sessions/` directory,
   unreadable markers, or an empty set, the card renders exactly today's behavior
   (no "running now", in-flight from derivation) with no error and no `unknown`
   regression. A test runs the full read layer with markers absent and asserts
   byte-for-byte parity with the pre-slice card for the in-flight region.
6. **Stale markers never read as "running".** A marker whose `startedAt` is older
   than a documented **staleness window** (a crashed session that never cleared)
   is excluded from "running now" — never a false positive. The window is a named
   constant, not a buried literal.
7. **Read-only and private.** Markers hold no source-repo path writes and no
   session content beyond `{session_id, cwd, startedAt}` — no transcript text, no
   PII — consistent with the private-data constraint.

**Edge cases to cover explicitly:** SessionStart in a project not in the Gauge
config (no marker, or ignored at read time); a crashed session leaving a stale
marker (excluded past the window); a SessionEnd with no matching marker (no-op,
never errors); two concurrent sessions in one project (both markers, "running
now" once); marker directory absent entirely (absent-safe, AC5); a marker read
that throws (caught, degrades to absent).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [ ] Each new test has been shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice the owner sees which projects
have work running right now — a live, glanceable fact the point-in-time board
could not show — while a machine without the source sees no regression.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
