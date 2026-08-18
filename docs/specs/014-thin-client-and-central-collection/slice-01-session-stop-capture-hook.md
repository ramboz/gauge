---
status: DRAFT
dependencies: [adr-0017]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 014-01 — session-stop capture hook + auto-installer

**Goal:** Ship the thin client's write path — a Claude Code `Stop`/`SessionEnd`
hook that, on session end, maps the session's working directory to a configured
Gauge project and writes one observation snapshot to Gauge's own history — plus
an installer that auto-registers the hook in `~/.claude/settings.json`
(idempotent, backed-up, reversible). After this slice, a project's history grows
on its own as sessions end, with no manual `npm run collect`.

**DoR:**
- ✅ Assumption **A1** (Stop/SessionEnd payload exposes session cwd + can run a
  Node script) is verified against the real Claude Code hook as the first task —
  the mapping key is confirmed before the hook is built on it. If A1 is false,
  the confirmed alternate key (env var / explicit hook arg) is recorded here and
  the ACs below re-read against it before implementation proceeds.
- ✅ `collectObservation` (`src/state.mjs`) and `observeProject`
  (`src/observation.mjs`) exist and write validated snapshots — confirmed
  (used by `scripts/snapshot.mjs` today).
- ✅ Owner decision recorded: installer **auto-writes** into
  `~/.claude/settings.json` (vs. print-and-paste).

**Acceptance Criteria:**

1. **Hook writes a snapshot on session end.** A hook entrypoint
   (`scripts/session-stop-hook.mjs` or equivalent) invoked as a Claude Code
   `Stop`/`SessionEnd` hook resolves the session's working directory, matches it
   to a configured project by `project.path` (containment, longest-prefix wins
   for nested entries), and writes exactly **one** observation record for that
   project via the existing `collectObservation` path. Observable: a new
   `<stateDir>/observations/<projectId>/<stamp>-<recordId>.json` appears after a
   session ends in a configured project's tree.
2. **Unmatched sessions are a clean no-op.** A session whose cwd is under no
   configured project writes nothing, exits `0`, and emits a single diagnostic
   line to stderr (never stdout, never a thrown error that could disrupt Claude
   Code's shutdown). The hook never blocks or delays session exit on failure.
3. **Read-only-source boundary preserved.** The hook writes only under the
   configured `stateDir`; it performs the same `assertDisjoint` source/state
   isolation `collectObservation` already enforces. A test asserts a hook run
   never writes within any configured `project.path`.
4. **Installer auto-registers idempotently.** An installer command (e.g.
   `npm run install-hook`) adds the hook registration to
   `~/.claude/settings.json`: it **backs up** the existing file first, is
   **idempotent** (re-running does not duplicate the entry or clobber unrelated
   settings), and preserves valid existing JSON. Observable: after two runs, the
   settings file contains exactly one Gauge hook entry and all pre-existing keys
   intact.
5. **Uninstall / reversibility.** The installer supports removing the hook entry
   (e.g. `--uninstall`), restoring settings to their pre-install shape for the
   Gauge entry (unrelated settings untouched). Observable: install → uninstall
   leaves the Gauge hook entry absent and other keys unchanged.
6. **Failure is isolated.** A malformed config, an unreadable `stateDir`, or a
   snapshot-write error surfaces as a stderr diagnostic and a non-disruptive exit
   — it never corrupts `~/.claude/settings.json` and never aborts the session.

**Edge cases to cover explicitly:** cwd exactly equal to `project.path`; nested
configured entries (child project inside a parent path); a session in a
`.claude/worktrees/*` linked worktree of a configured project; a first-ever
install where `~/.claude/settings.json` does not yet exist; a settings file that
is present but not valid JSON (refuse + diagnostic, never silent overwrite).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases listed above are covered explicitly.
- [ ] Each new test has been shown to fail when its feature is removed (mutate,
      watch it go red, restore).
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice a Gauge owner installs one
hook and their project history then accrues automatically at each session end —
an end-to-end, owner-visible capability (self-updating history), not scaffolding
for a later slice.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
      If it adds an install command, add/update its row/notes.
