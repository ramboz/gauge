---
status: DONE
dependencies: [adr-0017]
last_verified: 2026-08-18
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 014-01 — session-stop capture hook + auto-installer

**Goal:** Ship the thin client's write path — a Claude Code **`SessionEnd`** hook
that, on session end, maps the session's working directory (`cwd`, from the
hook's stdin JSON) to a configured Gauge project and writes one observation
snapshot to Gauge's own history — plus an installer that auto-registers the hook
in `~/.claude/settings.json` (idempotent, backed-up, reversible). After this
slice, a project's history grows on its own as sessions end, with no manual
`npm run collect`.

**Contract (verified 2026-08-18 — spec `## Assumptions` A1):** the `SessionEnd`
hook receives `{cwd, session_id, transcript_path, hook_event_name, exit_reason}`
on **stdin**, runs `node scripts/…`, and registers under
`hooks.SessionEnd[].hooks[]` (`{type:"command", command, timeout?}`). Trigger is
`SessionEnd` (once/session), **not** `Stop` (per-turn). SessionEnd hooks share a
**~1.5s budget** (override via per-hook `timeout`); failure is non-blocking.

**Scope boundary (frame-critique, 3 rounds — owner decision 2026-08-18):** the
hook **captures unconditionally** on every session end; there is **no
content-dedup**, because round 3 established (against `src/derive.mjs:162`) that
this would be counterproductive:
- `deriveForecast`'s pace is computed from two window **endpoints** and is
  **density-invariant** — the *number* of flat points between endpoints cannot
  change the forecast, so deduping them buys nothing for correctness.
- A project being worked whose **milestone progress is flat as its deadline nears
  genuinely reading `at_risk` is honest** — the RAG chip doing its job, not a
  false alarm to suppress (owner-confirmed semantics).
- Content-dedup would **freeze the latest capture's timestamp**, which would
  *mask* a real stall (the opposite of the goal) — so it is explicitly rejected.

So install makes RAG **more accurate**, not regressive: it grows honest forward
history and lets a stalled project decay to `at_risk` as it should. **Grounded
design fact (kept):** the hook observes the matched project's `project.path` (main
tree) via `observeProject` (`gitInfo(project.path)`, `observation.mjs:671`), not
the session `cwd` (cwd only *matches* the project) — so unmerged worktree state
never enters `progress(t)`. Two concerns 014-01 hands to **014-02**: (i) pure
**storage hygiene** — coalescing byte-identical consecutive captures to one record
while **advancing** its timestamp (forecast-neutral; never freezing, so stalls stay
visible); (ii) forecast **currency** — a read-layer live-tail splice so `latest`
reflects "now". 014-01 captures honestly; 014-02 hardens hygiene + currency.

**DoR:**
- ✅ Assumption **A1 resolved** (verified via docs + local `settings.json`
  probe). First implementation task is a **cheap re-confirm** of the exact field
  names + timeout budget against the installed Claude Code version (they can
  drift), not an open investigation. **The re-confirm also checks cwd *value*
  semantics** (frame-critique secondary): that the payload `cwd` is the stable
  session root, so cwd → `project.path` matching is reliable for non-standard
  launches (session started from a parent that is itself a configured project, or
  spanning projects), not merely that the field is present.
- ✅ `collectObservation` (`src/state.mjs`) and `observeProject`
  (`src/observation.mjs`) exist and write validated snapshots — confirmed
  (used by `scripts/snapshot.mjs` today).
- ✅ Owner decision recorded: installer **auto-writes** into
  `~/.claude/settings.json` (vs. print-and-paste).
- ✅ Local grounding: `~/.claude/settings.json` already carries a **populated
  `SessionEnd` group** (+8 other hook events) → the installer must merge into the
  existing array, never create-or-clobber (AC4).

**Acceptance Criteria:**

1. **Hook writes a snapshot on session end.** A hook entrypoint
   (`scripts/session-stop-hook.mjs` or equivalent) invoked as a Claude Code
   **`SessionEnd`** hook reads the stdin JSON, resolves the session's `cwd`,
   matches it to a configured project by `project.path` (containment,
   longest-prefix wins for nested entries), and writes exactly **one**
   observation record for that project via the existing `collectObservation`
   path. Observable: a new
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
4. **Installer merges idempotently into existing hooks.** An installer command
   (e.g. `npm run install-hook`) adds the Gauge entry into the **existing**
   `hooks.SessionEnd` array (which is already populated on a real machine — see
   DoR): it **backs up** the file first, is **idempotent** (re-running does not
   duplicate the entry), and preserves every unrelated hook group and top-level
   key byte-for-byte. Observable: after two runs, `settings.json` contains
   exactly one Gauge SessionEnd hook and all pre-existing hook events / keys
   intact.
5. **Hook stays within the SessionEnd time budget.** The snapshot write is fast
   and **atomic** (temp-file + rename, mirroring `collectObservation`'s
   `atomicRecord`); the registration sets an explicit `timeout` if the write can
   approach the ~1.5s shared budget. Observable: the hook completes well under
   its configured timeout on a representative project; a slow/failed write is
   non-blocking and never leaves a partial record.
6. **Uninstall / reversibility.** The installer supports removing the hook entry
   (e.g. `--uninstall`), restoring settings to their pre-install shape for the
   Gauge entry (unrelated settings untouched). Observable: install → uninstall
   leaves the Gauge hook entry absent and other keys unchanged.
7. **Failure is isolated.** A malformed config, an unreadable `stateDir`, or a
   snapshot-write error surfaces as a stderr diagnostic and a non-disruptive exit
   — it never corrupts `~/.claude/settings.json` and never aborts the session.

**Edge cases to cover explicitly:** cwd exactly equal to `project.path`; nested
configured entries (child project inside a parent path); a session in a
`.claude/worktrees/*` linked worktree of a configured project; a first-ever
install where `~/.claude/settings.json` does not yet exist; a settings file that
is present but not valid JSON (refuse + diagnostic, never silent overwrite).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
      Edge cases listed above are covered explicitly.
- [x] Each new test has been shown to fail when its feature is removed (mutate,
      watch it go red, restore).
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch; frame-critique
      per `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice a Gauge owner installs one
hook and their project history accrues forward on its own at each session end — an
end-to-end, owner-visible capability (self-updating history). It is a net
**improvement**, not a regression: the RAG chip becomes *more* accurate, honestly
reading `at_risk` for a project whose milestone isn't advancing as its deadline
nears — the chip doing its job. 014-02 then adds storage hygiene and exact
forecast currency on top.

### Deviation log (after reconciliation)

Original ACs preserved above. Implementation notes:

1. **Pure/I/O split (additive to the spec's file list).** Per the "factor pure
   logic for testability" instruction, the logic was split into pure cores
   `src/session-hook.mjs` (`parseSessionEndPayload`, `matchProjectForCwd`) and
   `src/hook-install.mjs` (`buildHookEntry`/`installHook`/`uninstallHook`/`hasHook`)
   with I/O in `scripts/session-stop-hook.mjs` + `scripts/install-hook.mjs` —
   mirroring the existing `src/backfill.mjs` + `scripts/backfill.mjs` split. Not a
   deviation from any AC; additive structure.
2. **Reconciliation fixes applied (review nits).** (a) The registered hook command
   now quotes the script path (`node "<path>"`, via `JSON.stringify`) so a home dir
   with a space does not break it (craft nit). (b) The installer no longer clobbers
   an existing `.bak`, so the *pristine* pre-Gauge original survives a second
   install — keeps AC6 reversibility honest (compliance/craft/arch nit). (c) The
   stale `run()` comment was corrected and `run()` is now covered by two in-process
   tests (also the clean 014-04 extension seam). All witnessed; suite 535 green.
3. **AC4 "byte-for-byte" is semantic, not literal.** The installer reserializes the
   whole settings file as 2-space JSON, so unrelated *values* are preserved exactly
   and the raw pristine original survives in `.bak`, but a user file with tabs / a
   different key order is reformatted. Substantive intent (no data loss, no clobber)
   is met.
4. **Deferred (logged, not fixed).** (a) `matchProjectForCwd` uses `path.resolve`
   string-prefix containment, not `realpath` inode identity like `state.mjs` — a
   symlinked `cwd` could miss the match, but the consequence is a clean no-op
   (missed capture), never corruption. (b) `installHook` idempotency keys on
   `command` only, so re-running with a different `--timeout` is a no-op rather than
   an update — acceptable. (c) `parseArgs` is now a 4th verbatim caller
   (`docs/inbox.md` updated with the ADR-0002 deferral). (d) The spawn-based
   integration tests carry `skip: platform !== 'darwin'` (mirrors
   `test/snapshot.test.mjs`); the pure-logic and new in-process `run()` tests are
   portable, so cross-platform coverage of the capture path exists regardless.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entry-point change (install is `npm run install-hook`, an additive script). |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` on the DONE transition (close-out). |
| `docs/product-vision.md` | `no-op` | No scope/behavior drift; the thin-client capture path is already in the vision/ADR-0017. |
| `docs/architecture.md` | `updated` | Recorded the two self-owned write surfaces (Gauge state via `collectObservation`; install-time `~/.claude/settings.json`), preserving the read-only-source boundary (arch-review reconciliation note). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / templates | `deferred` | Spec 014 is still in flight (3 slices open); primer compression happens when the spec closes, not per-slice. |
| `docs/inbox.md` | `updated` | Recorded `install-hook` as the 4th `parseArgs` caller against the existing shared-CLI-helper item (ADR-0002 deferral). |
| `docs/refinement-todo.md` | `no-op` | No new deferred *decision*; the parseArgs extraction lives in the existing inbox item. |
| `docs/decisions/` / ADR index | `no-op` | No new load-bearing decision or boundary change beyond what ADR-0017/0005 already cover (the install-time write surface is documented in architecture.md, not a new decision). |
| `docs/memory/**` | `no-op` | No new durable domain term or dead-end learning from this slice worth persisting. |

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule (only if this slice closes the spec).
      If it adds an install command, add/update its row/notes.
