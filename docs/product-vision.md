> Status: Active (filled 2026-07-13 from the design-session brief).
>
> Captures *why* this project exists, *for whom*, and *with what
> principles*. Architectural mechanics live in [architecture.md](architecture.md).

# Vision: project-dashboard

## Identity

- **Vision statement:** One local page that answers "where is every project
  and what's next" by reading the artifacts jig-managed projects already
  write — no new rituals, no manual updates.
- **Tagline:** project-dashboard (noun): compass, rendered persistent and
  cross-project.

## Target users

- **For:** a solo builder running several jig-managed projects in parallel
  who loses track of progress, sub-projects, and next actions across long
  Claude sessions with generated names.
- **Not for:** teams, remote/hosted use, or projects with no on-disk
  workflow artifacts (those render as "not jig-managed", nothing more).

## Core problem

Progress lives scattered across spec frontmatter, runbooks, release plans,
and chat transcripts. Claude reports a lot, all at once, per project — but
nothing aggregates across projects, and sub-project roadmaps (a runbook in a
worktree, five release plans) exceed what human memory can track.

- **Today's paths and where they fall short:**
  - Run `/compass` per project — accurate but ephemeral (chat-only) and
    single-project.
  - Re-open old sessions to remember state — session names are opaque;
    reading takes longer than the work.
  - Keep a manual board (Notion, paper) — rots immediately because it
    duplicates what the repo already knows.

## Competitive landscape

| Option | What it does | Where it falls short for this gap |
|---|---|---|
| `/compass` | honest per-project briefing | ephemeral, one project at a time |
| GitHub Projects | boards, issues | remote, manual sync, ignores jig artifacts |
| Notion/manual board | free-form | duplicates disk state, always stale |

**Where this project fits:** the only view fed 100% from artifacts that
already exist on disk, so it is never stale and costs zero upkeep.

## Scope

### Core features (prioritized)

1. Project cards: spec/slice progress, bug and todo counts, git dates.
2. Workstreams: runbooks and release plans per project, with next step and owner.
3. Compass narrative: last snapshot headline + next action per project.
4. Worktree-only-doc warning (docs at risk of silent loss).

### MVP scope

Features 1–4 = spec 002. Deferred to later specs: hours-worked estimation
from session files, evolution graphs from snapshot history, cross-project
"waiting on you / ready for Claude" queue, upstreaming into jig.

### Out of scope (deliberately)

- Any lifecycle mutation — read-only over other repos, like compass.
- LLM calls in the scanner — parsing only.
- Multi-user, auth, hosting.

## Use cases

- UC-1: the owner can see every project's spec/slice progress on one page.
- UC-2: the owner can see each project's workstreams with their next
  unchecked step and who owns it (her or Claude).
- UC-3: the owner can see each project's last compass headline, next
  action, and when it ran.
- UC-4: the owner is warned when a doc exists only in a worktree.
- UC-5: the owner can see, per project, which Claude Code sessions are
  recently active (and which are running now) and what each is about — so she
  knows where she is working on what, without re-opening opaquely-named
  sessions (spec 003).

## Stack

- **Runtime / language:** Node ≥ 18, ESM, **zero runtime dependencies**.
- **Platform commitments:**
  - Cloud target: none — local only (`localhost`).
  - Deployment shape: `node src/server.mjs`, no build step.
  - Package manager: npm (dev only; `node:test` for tests).
  - Database: none — rescan on every request.
  - Key external services: none.
- **Locked-in vs. still open:** zero-deps and local-only are locked
  (principles below); snapshot schema is versioned and open to extension
  (ADR-0001).

## Design principles & constraints

1. **Read-only over other repos.** The dashboard never writes outside its
   own repo; the only sanctioned external write is compass appending its
   own snapshot in the surveyed project.
2. **Deterministic.** Everything is parsed; same disk state → same page.
3. **Zero new rituals.** Every feature must work from artifacts that
   already exist; anything requiring new user habits is opt-in.
4. **Zero dependencies, one page.** Nothing to install, break, or update.
5. **Honest numbers.** ABANDONED is excluded from denominators, DEFERRED is
   shown as parked, unknown states are surfaced rather than guessed.

**Non-obvious constraints:** scanning ~30 worktrees per project must stay
fast (path comparison only, never content diff); the page must render
acceptably with a project that has 70+ specs.

## How new work enters

- **Prioritization model:** pain-driven, single stakeholder.
- **Spec-triggering rules:** a layer proves insufficient during the daily
  morning/evening compass ritual; or the jig-upstream PR conversation
  requires a contract change.

## Open questions

- Hours-worked estimation: session-file clustering threshold and privacy
  flag (deferred to a later spec; spec 003 became the sessions panel, which
  reads the same session store and can host the hours layer later).
- Pin-registry location if upstreamed into jig (central config vs per-doc
  frontmatter).
