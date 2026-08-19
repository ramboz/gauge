---
status: DONE
dependencies: [014-01]
last_verified: 2026-08-18
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-04 — live-session "running now" enrichment (optional)

**Goal:** Add an **optional** "running now" indicator to the card, sourced from a
**thin-client-owned active-session marker** — a `SessionStart` hook writes a marker
when a session begins, 014-01's `SessionEnd` hook clears it when the session ends,
and **liveness is the session transcript's mtime** (which Claude Code advances as
it writes, for free — no per-turn hook). The set of markers whose transcript mtime
is recent is "running now." Enriches the derived "in flight" signal with what is
actually active right now, degrading cleanly to today's branch/worktree/draft-PR
derivation when no markers exist. This is the seam to the engineer daily-driver;
the manager view must never hard-depend on it.

**Design note (frame-critique, 4 rounds — converged):** (1) no *passive* source
reliably reports "active now", so the thin client **creates** the signal via a
start/end bracket. (2) A window over write-once `startedAt` can't separate crash
from long-run. (3/4) A `Stop`-hook heartbeat would fix liveness but imposes a
**per-turn write-side tax** on the engineer's session (`Stop` fires every turn,
runs mid-conversation, participates in the block/continue protocol) — unacceptable
for a signal that "must never hard-depend" on that tool. **Resolved at the design
level: liveness = the transcript file's mtime.** Claude Code writes the JSONL
transcript continuously, so its mtime is a **free, hook-less, continuous** activity
signal (finer than turn-end). Two hooks only: `SessionStart` (create marker,
recording `transcriptPath`) + 014-01's `SessionEnd` (clear). **Owned residual:**
mtime advances at **write-event cadence** (per JSONL append), not continuously, so
liveness is a proxy with a **bounded** cadence gap — both an *open-but-idle*
session and a long *active-but-write-silent* operation (a multi-minute tool call
between `tool_use` and `tool_result`) can read "not running" once past the window.
Sized ≥ the expected max inter-write gap; accepted because the signal is
optional/additive/absent-safe and never a hard status. A crashed session's
transcript stops advancing → correctly stale. See spec `## Assumptions` A4.

**DoR:**
- ✅ Assumption **A4 converged** (spec `## Assumptions` A4): thin-client-owned
  marker, liveness = `transcriptPath` mtime, **no `Stop` hook** (no per-turn tax).
  First task re-confirms the `SessionStart` payload includes `cwd` + a
  `transcriptPath` (`transcript_path`) and that its mtime tracks activity — the
  cheap re-probe (`SessionEnd`'s payload is A1-verified; `SessionStart` is the
  open bit).
- ✅ Slice 014-01 landed (its `SessionEnd` hook + installer are the home this slice
  extends: `SessionEnd` also clears the marker; the installer also registers the
  `SessionStart` hook — still two hooks, no `Stop`).

**Acceptance Criteria:**

1. **SessionStart writes an active marker.** A `SessionStart` hook writes a marker
   `{session_id, cwd, transcriptPath, startedAt}` under `<stateDir>/active-sessions/`
   (or equivalent), mapping cwd → project the same way 014-01 does. Observable: a
   marker file appears when a session starts in a configured project's tree.
2. **SessionEnd clears the marker (extends 014-01).** The 014-01 `SessionEnd` hook
   removes the matching marker by `session_id`. Observable: start → end leaves no
   marker; the two hooks bracket cleanly.
3. **Liveness from transcript mtime (no hook).** At read time a marker's liveness
   is its `transcriptPath` **mtime** — not a stored/refreshed field — so no
   per-turn hook is needed. Observable: after the transcript is written, the
   derived liveness advances; a marker whose transcript is untouched does not. The
   liveness lookup `stat`s the transcript (never reads its content).
4. **"Running now" from live markers.** A project with a marker whose transcript
   mtime is within the staleness window shows a "running now" indicator; a project
   with none (or only stale markers) does not. Computed in the read layer as a pure
   fold over `(marker, mtime)` pairs (mirroring `attachVelocity`), one `/api/data`
   join.
5. **Stale markers never read as "running" (bounded residual, honestly owned).** A
   marker whose transcript mtime is older than a documented staleness window
   (`RUNNING_STALE_AFTER`, a named constant) is excluded from "running now". Note
   transcript mtime advances at **write-event cadence** (per JSONL record append:
   assistant message, `tool_use`, `tool_result`), **not continuously** — so a long
   **active-but-write-silent** operation (a multi-minute build/bash/generation that
   writes `tool_use`, runs silently, then writes `tool_result`) can transiently
   read "not running" during that silent window. The window is therefore sized **≥
   the expected max inter-write gap**, accepting a **bounded** false-negative on
   long silent operations. This is the same irreducible cadence residual any
   hook/filesystem liveness proxy carries (the `Stop`-heartbeat had a turn-end
   version); it is safe because the signal is **optional/additive/absent-safe** and
   never a wrong *hard* status. Both directions tested with fixtures that set the
   transcript file's mtime (fixtures exercise the window arithmetic, not the live
   write cadence — the residual is owned, not closeable).
6. **Enriches, never overrides, "in flight".** The live signal augments the
   existing in-flight derivation (branches/worktrees/draft PRs) additively — the
   derived signal remains the base; the marker adds the "active now" fact.
7. **Absent-safe by construction.** With no `active-sessions/` directory,
   unreadable markers, an empty set, or a marker whose `transcriptPath` no longer
   exists, the card renders exactly today's behavior (no "running now", in-flight
   from derivation) with no error and no `unknown` regression. A test runs the full
   read layer with markers absent and asserts byte-for-byte parity with the
   pre-slice card for the in-flight region.
8. **Read-only and private.** Markers hold no source-repo writes and no session
   content beyond `{session_id, cwd, transcriptPath, startedAt}` — the read layer
   only `stat`s the transcript, never reads it — no transcript text, no PII.

**Edge cases to cover explicitly:** a long-running session still writing its
transcript (recent mtime → reads running, no false-negative — AC5); a crashed/idle
session whose transcript mtime is old (excluded — AC5); a marker whose
`transcriptPath` no longer exists on disk (treated as not-running / absent-safe,
never throws — AC7); `SessionStart` in a project not in the Gauge config (no marker
/ ignored at read time); a `SessionEnd` with no matching marker (no-op, never
errors); two concurrent sessions in one project (both markers, "running now" once);
marker directory absent entirely (absent-safe, AC7); a marker read that throws
(caught, degrades to absent).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases above are covered explicitly.
- [x] Each new test has been shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice the owner sees which projects
have work running right now — a live, glanceable fact the point-in-time board
could not show — while a machine without the source sees no regression.

### Deviation log (after reconciliation)

1. **Implemented directly in the main loop** (session-limit continuity).
   Independent review stayed fresh-context subagents (compliance + craft + arch).
2. **Converged design implemented.** `src/session-marker.mjs` (pure
   `runningProjectIds` fold + `attachRunningNow` join + `markerFilename` +
   `RUNNING_STALE_AFTER_MS = 15min`, plus the `readActiveSessionMarkers` /
   `clearMarker` I/O wrappers). `scripts/session-start-hook.mjs` writes a 4-field
   marker under `<stateDir>/active-sessions/` (atomic; isolation contract mirrors
   014-01 — no stdout, never disrupts start, stderr diagnostic + exit 0);
   014-01's `SessionEnd` hook clears it via `clearMarker`. Liveness = the
   transcript's **mtime** (`statSync` only — never reads content, AC8). Read-layer
   join composes **alongside** the forecast live-tail splice (a separate additive
   boolean join, per the 014-03 arch note — no double-appended `now` endpoint).
   Absent-safe throughout (AC7): missing dir / malformed marker / missing
   transcript → nobody running, today's card unchanged.
3. **Hook-install generalized (extends 014-01).** `installHook`/`uninstallHook`/
   `hasHook` gained an `event` param (default `SessionEnd`, so 014-01 is
   unchanged); the installer registers **both** the SessionEnd capture hook and
   the SessionStart marker hook, and uninstall drops an event key that fully
   empties — restoring the exact pre-install shape for a Gauge-created event.
   Two 014-01 installer tests were updated (the installer now registers 2 hooks) —
   honest reflection of the extension, not weakened coverage.
4. **Review nits addressed post-review (all non-blocking).** (a) craft+compliance:
   the server marker-I/O loop was source-asserted only → **extracted
   `readActiveSessionMarkers`** (I/O wrapper mirroring `gitVelocity`) and added
   behavioral cross-platform tests for the malformed-skip / missing-transcript-null
   / absent-dir branches. (b) compliance darwin-skip: the AC2 clear logic was
   **extracted to `clearMarker`** and unit-tested cross-platform; the remaining
   integration test's darwin-skip is now documented (it drives `stopRun`'s
   darwin-only capture step). (c) craft+arch: **renamed `parseSessionEndPayload`
   → `parseHookPayload`** (event-agnostic). (d) `startedAt` is stored as
   identity/provenance, intentionally unused for liveness (AC3 = mtime) — noted so
   it is not later "cleaned up".
5. **Recorded follow-ups (`docs/refinement-todo.md`).** Stale-marker GC / bounded
   `active-sessions/` scan (arch — a crashed session's marker lingers; correct via
   stale-mtime but unreaped); a shared `src/hook-io.mjs` scaffold before a **4th**
   hook (craft — two hooks is within the ADR-0002 inline-mirror budget today).
6. **AC7 byte-parity** is satisfied by decomposition (pure absent-safe fold + card
   render with `runningNow:false` → no badge), consistent with the project's
   source-match convention for `/api/data` joins (no slice boots the server), now
   reinforced by the behavioral `readActiveSessionMarkers` tests.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No front-door change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out. |
| `docs/product-vision.md` | `no-op` | The optional live-session seam is in-scope (thin-client enrichment); no scope drift. |
| `docs/architecture.md` | `no-op` | ADR-0005 (write only to stateDir), ADR-0006 (pure fold + read-layer I/O), read-only-observer identity all upheld (arch pass concurred). |
| Primer surfaces (`CLAUDE.md`/`AGENTS.md`/templates) | `updated` | Spec 014 CLOSES with this slice → primer hygiene applied at close-out (below). |
| `docs/inbox.md` | `no-op` | Nothing resolved/added. |
| `docs/refinement-todo.md` | `updated` | Added the stale-marker-GC and hook-io-scaffold follow-ups. |
| `docs/memory/**` | `no-op` | No new durable term beyond the deviation log; memory-sync at spec close. |
| `docs/decisions/` / ADR index | `no-op` | No ADR: additive optional signal, no schema change, no load-bearing decision with rejected alternatives beyond the recorded converged design. |

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] Primer hygiene per spec 025-01 rule (spec 014 closes with this slice —
      compress the Active-build entry to the shipped release + status-board Notes).
