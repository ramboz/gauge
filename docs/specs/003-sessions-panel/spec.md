---
status: ABANDONED
use_cases: [UC-5]
---

# Spec 003: Sessions panel

> **Retired 2026-07-13 by
> [ADR-0003](../../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md).**
> The unimplemented session-centric expansion belongs to the superseded local
> Jig-dashboard frame. Revisit only through a new Gauge-shaped spec if
> portfolio attention routing later demonstrates the need.

## Overview

A per-project view of the Claude Code sessions the owner has going, so she
knows *where she is working on what* without re-opening opaque, generated
session names. This is the vision's own pain, restated: sessions have
"opaque names", and "reading takes longer than the work"
(see [product-vision.md](../../product-vision.md) → Core problem, UC-5).

Each project card gains a **Sessions** section listing that project's
sessions — the human **title** foregrounded (the only field that reliably
tells the truth), with the worktree folder, branch, running state, and last
activity as secondary context. Foregrounding the title while showing the
worktree + branch is deliberate: those three routinely disagree when a
worktree is reused — e.g. a worktree folder `feature-ui`, on branch
`claude/triage-candidates`, running a session titled "Investigate flaky
test" — and the panel's job is to make that legible.

**Data source (grounded, not assumed — verified on disk 2026-07-13).** The
session data the owner sees in the app is assembled by Claude Code's session
layer from the local session store. The dashboard scanner reads that same
store directly, on disk, with zero runtime deps — consistent with
[ADR-0001](../../decisions/adr-0001-runtime-zero-deps.md) (`node:fs`/`os`
only) and the read-only boundary (vision principle 1). Two sources:

- `~/.claude/sessions/*.json` — one small sidecar **per running process**
  (keyed by PID), carrying `sessionId` + `cwd`. Presence here == *running
  now*. (Verified: the sidecar for session `a4d3a213…` matched exactly the
  session Claude Code reports as running.)
- `~/.claude/projects/<cwd-slug>/<uuid>.jsonl` — the transcript, one per
  session. Every line carries `cwd` + `gitBranch`; the human title is the
  last `{"type":"custom-title","customTitle":…}` line (verified byte-for-byte
  against the app's title); last-activity is the file mtime.

This is a boundary extension worth naming: the scanner, which today reads
only inside configured project roots, gains a **read-only** pass over a
global user-level store (`~/.claude`), attributing each session back to a
configured project by `cwd`. It writes nothing there.

**Why snapshot-from-disk, and what was rejected.** A live read via Claude
Code's session tool is impossible from the scanner — the dashboard server is
a plain `node:http` process with no such client. Reconstructing from disk is
the only option that keeps zero-deps and the existing rescan-on-request
pipeline. Two fields are deliberately left out of the MVP: **PR state** (not
on disk — needs a `gh` subprocess; permitted by ADR-0001 but deferred, 003-03)
and the app's **explicit archived flag** (not present in any readable on-disk
store — grepped 2026-07-13). "Active" is therefore defined by **recency +
running**, which is disk-computable and matches the real intent ("where am I
working *now*") without depending on a flag we cannot see.

## Assumptions

Load-bearing claims, marked by grounding (ADR-0020 discipline). Verified
items were probed on disk on 2026-07-13 (Claude Code v2.1.205).

- **A1 (verified).** Running sessions are enumerable from
  `~/.claude/sessions/*.json`; each sidecar carries `sessionId` + `cwd`;
  presence == running.
- **A2 (verified).** Title = the last `custom-title` entry's `customTitle`
  in the session transcript; `gitBranch` + `cwd` are present on transcript
  lines.
- **A3 (verified).** Last-activity is recoverable as transcript file mtime.
- **A4 (assumption — unverified across versions).** The store layout and
  field names (`sessions/*.json`, `custom-title`/`customTitle`, `gitBranch`)
  are **not a stable public contract** and may change between Claude Code
  versions (probed only on v2.1.205). The reader must therefore be lenient —
  skip malformed/absent data, never throw, degrade to a fallback title —
  mirroring ADR-0002's snapshot leniency. This assumption is what makes this
  spec's slices carry a frame-review concern.
- **A5 (verified absent).** No explicit "archived" flag exists in any
  readable on-disk store under `~/.claude` — so the MVP cannot honor it.
- **A6 (assumption).** PR number/state is not on disk; surfacing it needs a
  `gh` subprocess (deferred, 003-03).

## Non-goals

- **Honoring the app's explicit archived/unarchived flag** — not readable on
  disk (A5); the recency window stands in for it.
- **PR badges on session rows** — deferred (003-03); needs `gh`.
- **Opening, resuming, renaming, or reading the body of a session** — the
  panel is read-only and shows titles + metadata only. The first transcript
  line is read *only* as a title fallback, never rendered as content.
- **Hours-worked estimation** from session-file clustering — a separate later
  spec (vision open question).
- **Sessions for projects absent from `dashboard.config.json`** — the panel
  covers configured projects only, like every other card section.

## Decomposition

**SPIDR axis: thin-vertical-first, then Interface polish.** Slice 003-01
delivers the whole feature end-to-end at its minimum — scan the store →
attribute to projects → render a Sessions section showing what's running and
recently active. Slice 003-02 is an Interface split (minimal → polish): the
"show older" expander and count summary. Slice 003-03 (PR badges) is a
Data-enrichment slice, **deferred** behind the `gh` decision. Splitting the
reader from the rendering was rejected as horizontal phasing — a scanner
field with no panel delivers no observable value.

### Slices

1. **`003-01 sessions-scan-and-render`** — the scanner reads the local
   session store, attributes each session to a configured project (main root
   or `.claude/worktrees/<name>`), and emits a `sessions` array per project;
   each card renders a Sessions section (title + running badge + branch +
   worktree + relative last-activity), running-first, showing active
   (running or within the recency window) sessions by default.
   *(See [slice-01-sessions-scan-and-render.md](slice-01-sessions-scan-and-render.md).)*
2. **`003-02 recency-expand-toggle`** — a per-card "show older" control that
   reveals sessions outside the recency window (up to the cap), plus an
   "N active · M older" summary. Client-side only; the data from 003-01
   already carries the `active` flag and the overflow total.
   *(See [slice-02-recency-expand-toggle.md](slice-02-recency-expand-toggle.md).)*
3. **`003-03 pr-badges`** — **DEFERRED.** PR number/state badge on session
   rows whose branch has an open/merged PR, via a `gh` subprocess.
   *(See [slice-03-pr-badges.md](slice-03-pr-badges.md).)*

Deferred to a later spec (see vision → open questions): hours-worked
estimation from session-file clustering; evolution of session activity over
snapshot history; honoring the app's explicit archived flag if Claude Code
ever exposes it in a readable on-disk store.
