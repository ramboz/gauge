---
status: Accepted
dependencies: []
last_verified: 2026-08-06
frame_review: true
---

# ADR-0015: Worktree lifecycle state via a local push-proxy

## Status

Accepted (2026-08-06)

## Context

ADR-0014 made worktree hygiene report the docs that live only in a worktree and
are genuinely at risk. A flat "N documents exist only in a worktree" collapses
three situations the owner wants told apart: (1) in-flight work that lives only
on a local worktree, (2) in-flight work that also has an open PR, and (3) stale
worktrees that were forgotten, have no PR, and never landed. The first two are
normal; the third is the cleanup signal.

Distinguishing them needs two facts per worktree: does an open PR exist, and is
the branch still active. "Open PR" is a GitHub concept, but Gauge's committed MVP
is a **local pull** product with a hard no-runtime-dependencies rule (ADR-0001)
and a bias to work offline. An always-on GitHub read on every ~120s refresh adds
latency, rate-limit exposure, and an auth/network dependency to a loop that is
otherwise purely local. `gh` is installed and authed on the development machine,
so a real PR lookup is *possible* — the question is whether it belongs in the
collection loop.

## Decision Options Considered

### Option A: Real PR lookup via `gh`, always on
- **Pros:** Ground truth — actual open/closed/merged PR state, with URLs.
- **Cons:** A network call per repo on every refresh; rate-limit and latency
  exposure; a hard dependency on `gh` + auth + connectivity in a local-pull
  product. Degrades to "unknown" whenever offline.

### Option B: Real PR lookup via `gh`, opt-in per project
- **Pros:** Keeps the default local/offline; ground truth where enabled.
- **Cons:** Still owns the GitHub dependency and its failure modes; adds config
  surface; the interesting signal is off by default.

### Option C: No GitHub calls — a local git push-proxy
- **Pros:** Fully local and offline; no new dependency, no network, no auth. A
  worktree whose HEAD is reachable from a non-mainline `origin/*` ref is almost
  always one with an open (or recently-closed) PR, which is a good-enough proxy
  for "this work is shared, not just local."
- **Cons:** A proxy, not ground truth — it cannot tell an open PR from a merged
  or closed one, and a pushed branch with no PR reads as "likely a PR". No PR
  URL to link to.

## Recommended Decision

Adopt **Option C** (owner's call). Each unmerged, doc-bearing worktree carries
two **orthogonal** facts on every `worktreeOnlyDocs` entry — a recency `state`
and a `pushed` flag — deliberately kept independent so recency applies to pushed
worktrees too (a remote ref commonly lingers after a PR is merged or closed, so
short-circuiting to "pushed" would let a long-abandoned pushed worktree
masquerade as an open PR — the one blind spot that would defeat the cleanup goal):

- `state`: **active** (last commit within **7 days**, matching Gauge's compass
  window), **stale** (no commit within it), or **unknown** (recency
  indeterminate; never coerced to a healthier state — Gauge's unknown-is-explicit
  principle).
- `pushed`: HEAD reachable from a non-mainline remote-tracking ref (matched by
  commit, so detached HEADs work). Offline proxy for "this work is shared —
  likely a PR".

The UI composes the two into groups, most-actionable first:

| pushed | state | group | reading |
|---|---|---|---|
| no | stale | **forgotten** | local only, quiet — clean up |
| yes | stale | **pushed but quiet** | remote ref lingering — likely a merged/closed PR whose worktree wasn't removed |
| no | active | **in flight** | local only, recent |
| yes | active | **in review** | pushed + recent — likely an open PR |

Implemented in `src/scan.mjs` (`worktreePushed`, `worktreeRecency`); lands in the
commit carrying this ADR.

## Consequences

**Becomes easier:**
- The three situations the owner named are visually distinct; forgotten
  worktrees (stale) are called out for cleanup, separate from healthy in-flight
  work.
- Stays fully local and offline — no GitHub dependency, no per-refresh network
  call, consistent with the local-pull MVP and ADR-0001.

**Becomes harder:**
- "pushed" is a proxy. Keeping recency orthogonal means a *quiet* pushed worktree
  is correctly called out as "pushed but quiet — likely a merged/closed PR", but
  a *recent* pushed branch that was never PR'd (or whose PR just closed) still
  reads as "in review — likely an open PR". If that residual misleads in
  practice, revisit Option A/B behind an optional adapter.
- No PR URL to click through to; identifying the PR is left to the worktree name.
- Detecting "pushed" adds one `git branch -r --contains` per doc-bearing
  worktree (lazy — merged/empty worktrees pay nothing).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- The push-proxy classification was validated against the live portfolio: on the
  real repos, `mystique-pr-*` review worktrees classify as **pushed**,
  `spec-096-jig-ceremony` (local, recent) as **active**, and `sad-jepsen`
  (local, June commit) as **stale** — matching intent.
- The 7-day window reuses the value already used for compass staleness
  (`src/scan.mjs`), not a new invented threshold.

## Kill criteria

- If "pushed" routinely mislabels merged/closed-PR branches as likely-open and
  that erodes trust in the cleanup signal, move to a real `gh` lookup behind an
  optional adapter (Option A/B).
- If the per-worktree `git branch -r --contains` cost becomes measurable on a
  repo with many worktrees, memoize per repo across a project's entries.

## Open questions

None.
