---
status: DRAFT
dependencies: []
last_verified:
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
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: split computation over a mixed fixture, all-human → low split,
      empty-window → unknown, contributor count, and the no-PII render.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.
