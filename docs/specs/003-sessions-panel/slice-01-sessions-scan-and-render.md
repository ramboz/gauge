---
status: DRAFT
dependencies: [002-01]
last_verified:
---

## Slice 003-01 — sessions-scan-and-render

**Goal:** On each project card, see a **Sessions** section: the Claude Code
sessions for that project, running-first, each showing its human title with
the worktree, branch, and relative last-activity as context, and a clear
badge on the ones running right now — all recomputed from the local session
store on every refresh, read-only and zero-dep. After this slice the owner
opens the dashboard and knows, per project, where she is working on what.

**DoR:**
- ✅ Store layout verified on disk (2026-07-13, Claude Code v2.1.205):
  running sidecars at `~/.claude/sessions/*.json` (`sessionId`+`cwd`);
  transcripts at `~/.claude/projects/<slug>/<uuid>.jsonl` with per-line
  `cwd`/`gitBranch` and a last `custom-title`→`customTitle`; last-activity
  from mtime. See spec `## Assumptions` A1–A3.
- ✅ Data-source decision recorded: snapshot-from-disk, not live/`gh`/archived
  flag (spec Overview + A4–A6).
- ✅ Existing scanner/server/page pipeline in place (002-01) to extend.

**Acceptance Criteria:**

1. **Session reader.** A reader enumerates sessions from the local session
   store — default `path.join(os.homedir(), '.claude')`, **overridable** (a
   `sessionStore` config field and/or an injectable path) so tests point at a
   fixture store. For each session it resolves `{ id, title, branch,
   worktree, running, lastActivity, active }`. Uses only `node:fs`/`node:os`
   (zero deps, per ADR-0001).
2. **Title resolution + fallback.** `title` = the last
   `{"type":"custom-title","customTitle":…}` line's value; when absent, the
   first `user`-type message's first line, trimmed (~80 chars); when that too
   is absent, the session `id`. A fixture with a `custom-title` yields it
   verbatim; one without falls back to the first message; an empty transcript
   falls back to the id.
3. **Running detection.** `running` is true **iff** a sidecar in
   `<store>/sessions/*.json` has a matching `sessionId`. Fixture: a session
   with a sidecar → `running:true`; one without → `running:false`.
4. **Project attribution + worktree.** Each session is attributed to the
   configured project whose expanded `path` equals or is a parent of the
   session's `cwd`. When the `cwd` is `<root>/.claude/worktrees/<name>`,
   `worktree` = `<name>`; when it equals the root, `worktree` = `null`.
   Sessions whose `cwd` matches no configured project are dropped. Fixture
   covers a main-root session and a worktree session under the same project.
5. **Active window + ordering + cap.** `active` = `running || (now −
   lastActivity ≤ SESSION_ACTIVE_DAYS)` (module const, default 7). Sessions
   are ordered running-first, then `lastActivity` descending, and the emitted
   list is capped at `SESSION_CAP` (default 20) per project; `sessionsTotal`
   records the pre-cap count so the page can show a "+N" overflow. Fixture:
   one running + one recent + one stale session order and flag correctly.
6. **JSON contract.** Each project result (jig-managed or not) gains
   `sessions: [{ id, title, branch, worktree, running, lastActivity, active }]`
   (branch `null` when `gitBranch` is absent/`HEAD`), plus `sessionsTotal`
   (number). Empty array when the project has no attributed sessions; a
   missing/unreadable store yields `[]` + a `warnings` entry, never a throw
   (A4 leniency).
7. **Performance.** Session scanning must not materially slow `/api/data`
   under the rescan-on-every-request model (vision perf constraint). Bound
   full transcript reads to the sessions actually emitted (filter by mtime +
   attribute + cap *before* reading bodies for title/branch), and resolve
   titles without loading whole multi-MB transcripts into memory (stream or
   bounded read). No unbounded read of all ~200 transcript dirs' contents.
8. **Rendering.** Each card shows a **Sessions** section: one row per
   **active** session (running-first), with the title prominent, a `●`
   running badge when `running`, and `branch` · `worktree` · relative
   last-activity ("3h ago") as secondary text. The section is omitted when a
   project has zero sessions. Rendering degrades gracefully when
   `sessions`/`sessionsTotal` are absent (older snapshot / non-updated page).
9. **Read-only + scope.** The feature writes nothing under `~/.claude`, spawns
   no subprocess (no `git`/`gh` for sessions), and renders titles + metadata
   only — never transcript body content beyond the first-line title fallback.
10. **Tests.** `node --test` green with a fixture session store under
    `test/fixtures/`: title resolution (all three fallbacks), running match,
    cwd attribution (main root + worktree + unmatched-dropped), active-window
    flag, cap + `sessionsTotal` overflow, and missing-store leniency.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions to 002's tests).
- [ ] Implementer test coverage exercises each AC with at least one fixture.
- [ ] Reviewed against spec — independent reviewer subagent; conditions
      closed.
- [ ] Frame-review pass run (spec carries real `## Assumptions`, A4 in
      particular — the store is not a stable contract).
- [ ] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice alone, the owner opens
the one dashboard URL and sees, per project, which sessions are running now
and what each is about — the whole "where am I working on what" value,
before the older-toggle or PR badges exist.

### Deviation log

_(to be written during reconciliation)_
