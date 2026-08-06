---
status: Accepted
dependencies: []
last_verified: 2026-08-06
frame_review: true
---

# ADR-0016: Optional GitHub PR resolution over the push-proxy

## Status

Accepted (2026-08-06)

## Context

ADR-0015 classifies worktrees with a fully-local **push-proxy**: a worktree whose
HEAD is on a non-mainline remote ref is treated as "likely an open PR". That ADR
deliberately made no GitHub call, and named its own escape hatch — "if the proxy
misleads in practice, revisit a real `gh` lookup **behind an optional adapter**".
This ADR builds exactly that hatch. The proxy cannot tell an open PR from a
merged/closed one, or from a pushed-but-never-PR'd branch; a real lookup can, and
can surface the PR number and URL to click through to. The constraint is
unchanged: the default must stay offline and dependency-free (local-pull MVP,
ADR-0001), so any GitHub call is strictly opt-in and must degrade cleanly.

## Decision Options Considered

### Option A: Keep the push-proxy only (ADR-0015 status quo)
- **Pros:** Nothing to build; stays offline.
- **Cons:** No way to distinguish open/merged/closed/no-PR; no link. The proxy's
  known residual (a recent pushed branch reads "in review" even with no open PR)
  is never resolvable.

### Option B: Optional `gh` resolution, proxy as the fallback
- **Pros:** When enabled and `gh` succeeds, the real PR (state + URL) replaces the
  guess; when disabled, missing, unauthed, offline, or non-GitHub, it silently
  falls back to the proxy. Off by default preserves the offline default. Works
  for enterprise GitHub too, since `gh` infers the host from the remote.
- **Cons:** A second, optional code path and a config/env surface; a network call
  per repo on each refresh **when enabled**.

### Option C: Always-on `gh` resolution
- **Pros:** Simplest model — one source of truth.
- **Cons:** Rejected in ADR-0015 for good reason: a hard GitHub dependency and a
  per-refresh network call in a local-pull product.

## Recommended Decision

Adopt **Option B** (owner request). PR resolution is gated by
`resolvePullRequests` (a global config boolean, default `false`) or the
`GAUGE_RESOLVE_PRS=1` env override. When on, each repo's PRs are fetched **once**
per scan via `gh pr list --state all --json number,url,state,headRefName,headRefOid`
(the runner is injectable, so tests need no network), indexed by head branch and
head commit — an OPEN PR wins a reused branch — and each doc-bearing worktree is
matched by branch (or by commit for a detached HEAD). Each flagged doc then
carries an optional `pr` field:

- an object `{number, url, state}` — the matched PR;
- `null` — resolution ran but this worktree has no PR;
- **absent** — resolution was off or `gh` failed → the UI uses the ADR-0015 proxy.

The fetch is lazy (only if resolution is on **and** at least one doc is flagged),
and any `gh` failure returns null for the whole repo so hygiene never breaks.
When a `pr` is present it is authoritative: an OPEN PR renders "in review" with a
clickable `PR #N`; anything else (merged/closed/none) routes to the cleanup group.

Implemented in `src/scan.mjs` (`indexPullRequests`, `resolveRepoPullRequests`,
`matchPullRequest`) and `src/config.mjs`; lands in the commit carrying this ADR.

## Consequences

**Becomes easier:**
- Where enabled, "likely an open PR" becomes a confirmed PR with a link, and the
  proxy's residual ambiguity (merged/closed/no-PR misread as in-review) is
  resolved.
- Works against enterprise GitHub with no extra config — `gh` resolves the host
  from the repo's remote (verified: an Adobe `git.corp.adobe.com` PR resolved).

**Becomes harder:**
- A second code path to keep coherent with the proxy, and a config/env surface.
- When enabled, one `gh` network call per repo (with ≥1 flagged doc) per refresh;
  no caching across refreshes yet, so a slow/rate-limited `gh` slows collection
  for that repo (it still degrades to the proxy on failure).

**Known limitations (accepted):**
- **Global, not per-project.** ADR-0015's escape hatch said "opt-in *per
  project*"; this implements a single global `resolvePullRequests` applied to all
  entries. Adequate for a single-owner portfolio; per-project granularity is a
  later refinement if repos need different treatment.
- **Enabled-but-failed looks like disabled.** An absent `pr` covers both "off"
  and "on but `gh` failed", so a network/auth failure silently reverts to the
  proxy with no marker — exactly when resolution was wanted. A "resolution
  attempted but failed" indicator is a deferred, additive visibility fix.
- **Fork false-match.** Matching is by `headRefName` then `headRefOid`, with no
  `headRepositoryOwner`; a fork PR reusing a local branch name could match the
  wrong PR. Rare for a single-owner portfolio; add an owner filter if it bites.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- Verified against the live portfolio with resolution on: `spec-096-jig-ceremony`
  resolved to `github.com/ramboz/jig` PR #194 (OPEN) and `mystique-pr-4008` to an
  enterprise `git.corp.adobe.com` PR #4077 (OPEN) — confirming `gh` host
  inference and the branch/commit match both work.
- `gh pr list --json` fields (`number,url,state,headRefName,headRefOid`) were run
  against a real repo, not assumed.

## Kill criteria

- If keeping the two paths coherent proves error-prone, or the per-refresh `gh`
  cost is unacceptable even opt-in, drop back to proxy-only (ADR-0015) or add
  cross-refresh caching / a background refresh.
- If a future non-`gh` PR source is wanted, this should move behind a named
  adapter rather than growing more `gh`-specific branches.

## Open questions

- Caching: PRs are re-fetched every refresh when enabled. A short TTL cache is
  the obvious next step if this sees real use; deferred until then.
