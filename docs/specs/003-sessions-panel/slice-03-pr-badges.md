---
status: DEFERRED
dependencies: [003-01]
last_verified:
---

## Slice 003-03 — pr-badges

**Resolution trigger:** when PR state is wanted on session rows, AND the
`gh`-subprocess-vs-bridge question below is decided (likely via a short ADR).

**Goal (deferred):** On a session row whose branch has an associated GitHub
PR, show a small badge with the PR number and state (OPEN / MERGED / CLOSED),
so the owner can see at a glance which sessions are "in review" vs "still
working" without leaving the dashboard.

**Why deferred.** PR state is the one useful field that is **not on disk**
(spec `## Assumptions` A6). Surfacing it needs a `gh` call per candidate
branch. ADR-0001 explicitly sanctions `node:child_process` and the scanner
already spawns `git`, so `gh` is *permitted* — but it adds real cost the MVP
shouldn't pay yet:

- **Latency + rate:** a `gh pr view` per branch, on the rescan-on-every-
  request path, against the 30+ worktrees per project the vision calls out —
  needs caching/batching to not blow the perf budget.
- **Coupling + auth:** depends on `gh` being installed and authenticated;
  degrades to "no badge" when absent, which must be graceful.
- **Alternative not yet chosen:** a session-store *bridge* (a Claude session
  — e.g. the `snapshot.mjs --all --auto` routine — writes the fully-assembled
  session list, PR state included, into a `docs/status/` JSONL the scanner
  reads) would get correct PR/archived data without the scanner reverse-
  engineering or spawning `gh` on the hot path. That trade (freshness-on-scan
  vs freshness-on-Claude-run) is the decision this trigger waits on.

**Open questions to resolve at un-defer:**
- `gh` on the scan path (with a TTL cache) vs the routine-snapshot bridge?
- Which branches even get a lookup — only sessions shown, only non-running,
  only those ahead of `main`?
- Does resolving PR state re-open the true "archived" question (a merged PR
  is the strongest signal a session is done)?

### Deviation log

_(n/a while DEFERRED)_
