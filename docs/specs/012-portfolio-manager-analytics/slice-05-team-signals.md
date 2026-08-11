---
status: DONE
dependencies: []
last_verified: 2026-08-11
---

## Slice 012-05 — team signals: human-vs-agent split + contributors

**Goal:** Each project card shows two git-derived team signals: the
**human-vs-agent split** (share of commits carrying the `Co-Authored-By: Claude`
trailer) and a **contributor count / bus-factor** read. Both are raw-layer signals
the spike cleared to build now; no deadline dependency.

**DoR:**
- ✅ The agent-coauthor split is present and differentiated across the portfolio
  (~11%–85% in the corpus; spike 012-01, re-validated 2026-08-10).
- ✅ Contributor count ranges from solo to large shared teams (2–94 authors in the
  corpus) — bus-factor is meaningfully differentiated.

**Acceptance Criteria:**

1. **Agent-split deriver.** Over a trailing window, compute the share of commits
   whose body carries `Co-Authored-By: Claude` (case-insensitive), as a percentage.
   Read-only over git.
2. **Honest proxy caveat.** The metric is labelled/typed as a proxy: the
   `Co-Authored-By: Claude` trailer undercounts other agent tooling (spec.md
   `## Assumptions`); the card must not present it as an exact agent-authorship
   measure.
3. **Contributor count.** Compute distinct commit authors over the window as a
   bus-factor signal; render alongside the split.
4. **Unknown is explicit.** No commits in the window (or no git) → both signals
   render `unknown`, never `0%` / `0 authors` shown as a healthy reading.
5. **No PII on the card.** Author identities are not surfaced verbatim on the card
   — only the aggregate percentage and count.
6. **Deterministic + windowed.** Fixed repo state + clock → deterministic output;
   the window is a documented parameter shared with 012-02's velocity window.

**DoD:**
- [x] All ACs pass; full suite green (no regressions). — 415/415.
- [x] Tests cover: split computation over a mixed fixture, all-human → low split,
      empty-window → unknown, contributor count, and the no-PII render.
- [x] Each new test shown to fail when the feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-05-compliance.md`, `reviews/slice-05-craft.md`).
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed. — see below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **New module `src/team.mjs`** (mirrors `src/velocity.mjs`): pure
  `teamFromCommits(commits, nowMs, windowWeeks=DEFAULT_VELOCITY_WINDOW_WEEKS)` (the
  window constant is *imported* from `velocity.mjs`, not redefined — AC6), thin git
  wrapper `gitCommitRecords` / combinator `gitTeamSignals(root, nowMs, windowWeeks)`,
  and `attachTeamSignals` read-layer join. Wired into `/api/data` in `src/server.mjs`
  reusing the **same `velocityNowMs` clock capture** as the velocity read (one
  consistent instant per request); rendered in `public/index.html` (`teamBlock` /
  `teamHeadline`).
- **Git fetch format.** `git log --since --format=%ct%x1f%an%x1f%B%x1e` — `\x1f`/`\x1e`
  control-byte delimiters (robust against newlines/pipes in commit text); `%an` is
  read only to COUNT distinct authors and is discarded, never rendered.
- **No-PII by construction (AC5).** `teamFromCommits` returns exactly
  `{agentCoauthoredPct, agentCoauthoredCount, commitCount, contributorCount}` — no
  author-shaped field exists anywhere in the pipeline, pinned by a
  JSON-serialization test and a card-render guard using a hostile `authorNames`
  field that must never surface.
- **Unknown vs 0% (AC4).** `null` only when the window is empty (no commits / no
  git); real activity with no agent-coauthored commits → a genuine `0%`, not unknown.
- **Reconciliation fixes (from the review passes).**
  1. *Trailer regex false positives* — `/co-authored-by:\s*claude/i` substring-matched,
     so a body that merely *quotes* the trailer (a revert echoing an original message)
     or a human named "Claude"/"Claudette" was counted as agent-coauthored. Tightened
     to line-anchored `/^co-authored-by:\s*claude\b/im`; tests prove a quoted-in-body
     mention and a "Claudette Dubois" co-author are NOT counted while a real trailer is.
  2. *Sub-1% split honesty* — a tiny non-zero share (e.g. 1/300 = 0.33%) rounded to
     `~0%` (reads as "no agent involvement"). Added `agentCoauthoredCount` (raw
     unrounded) + `teamHeadline`: `pct>0 → ~N%`; else `count>0 → < 1%`; else `0%`.
     Mirrors velocity's `< 0.1 commits/wk` / cost's `< $0.01` precedent. Tests added.
  3. *Stale test comment* — corrected a misleading "patched below" comment on a
     human-only fixture commit.
- **Accepted note (non-blocking).** The `Co-Authored-By: Claude` split remains a
  labelled **proxy** (spec.md `## Assumptions`): it undercounts other agent tooling
  and, even line-anchored, cannot distinguish Claude from a hypothetical human
  co-author whose trailer name is exactly "Claude". The card labels it `(proxy)`.

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**: the
  read-layer-joins list now names the per-project `team: {agentCoauthoredPct,
  commitCount, contributorCount}` git-derived join (`attachTeamSignals`,
  `src/team.mjs`; labelled proxy over the `Co-Authored-By: Claude` trailer; author
  identities never surfaced; `null` when the window is empty).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: read-layer join, not an
  observation-v1 field.
- **`docs/memory/glossary.md`** → **no-op**: "human-vs-agent split" / "bus factor"
  defined in the parent spec's manager-metrics catalog.
- **`CLAUDE.md` hot cache** → **no-op**: spec 012 still in flight (only 012-06
  remains); revisit at spec-close.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.
