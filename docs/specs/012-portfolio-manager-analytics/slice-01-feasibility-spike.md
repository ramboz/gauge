---
status: DRAFT
dependencies: []
last_verified:
kind: spike
---

## Slice 012-01 — feasibility spike: what local data supports which metrics

**Goal:** Determine, before designing the analytics layer, which manager metrics
are actually derivable from local data today, which need a curated input, and
which need history to accrue — so the downstream slices build on evidence, not
aspiration.

**Question:** For the manager-metrics catalog (spec.md), how much is available
from local data (git, Claude Code transcripts, Gauge observation history, jig
telemetry, optional `gh`) right now, and what is the critical missing input?

**Time-box:** 0.5 day (mostly done in the exploration that produced this spec).

**Findings:** _(qualitative — this repo is public; per-project spend/velocity was
probed in-session but is not recorded here, per the project CLAUDE.md.)_
- **Token cost is the strongest new signal.** Claude Code transcripts
  (`~/.claude/projects`) carry per-message `input/output/cache` tokens + `model`,
  ~3 months deep, aggregatable per project. Cost = tokens × per-model pricing
  (several Anthropic tiers plus the occasional local/non-Anthropic model).
- **Velocity is available now from git**, differentiated by orders of magnitude
  across repos. Gauge's *own* observation history is a single snapshot — no time
  series yet; git commit cadence is the immediate proxy.
- **Human-vs-agent split** (via `Co-Authored-By: Claude`) is available and
  differentiated across the portfolio (single digits to ~80%).
- **Milestones** exist for only a minority of projects (release plans with
  `Status`); most fall back to overall spec progress.
- **The RAG / forecast / on-track / attention layer is 100% dark** because **no
  project has a deadline set** (goals are set for most). This is the single
  critical missing input.
- **jig `skill-usage.jsonl`** is a skill-routing/agent log — no tokens; not a
  cost source.

**Outcome:** _pending_ — expected: `spec 012 downstream slices unblocked` once
(1) the owner sets a real deadline on one project (Gauge recommended — it is the
only one with milestones, so goal+deadline+milestone+progress+RAG can all be
exercised together), and (2) the dashboard redesign direction (portfolio glance
→ card → detail tiers) is chosen. The raw layer (velocity/cost/team) can proceed
independently of the deadline input.

**DoD (spike):**
- [ ] Findings recorded above (done).
- [ ] Outcome set to one of `ADR-NNNN created` / `spec 012-NN unblocked` /
      `abandoned (reason)` once the owner picks the redesign direction and the
      test-deadline project.
