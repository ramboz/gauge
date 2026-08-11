---
status: DONE
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
- **Re-validated 2026-08-10** against the live corpus (jig · gauge · servo ·
  shaper · mystique · personalization-workspace), all findings hold and two
  sharpen: transcripts carry per-record `input/output/cache` tokens + `model`
  across ≥4 model tiers (Anthropic + one local); git velocity, agent-coauthor
  ratio, and contributor count are all present and differentiated across every
  repo; `skill-usage.jsonl` confirmed token-free. **Sharpened:** the
  release-plan (`## Status`) milestone convention exists in **only one** corpus
  project (Gauge itself) — so the spec-progress **fallback is the dominant path**,
  not the exception. **Confirmed:** no project carries a curated onboarding
  deadline; the only ISO dates anywhere are Gauge's two release-plan *appetites*
  (2026-08-14 / 08-28), which `deriveForecast` does not read — so the
  RAG/forecast/attention layer stays dark portfolio-wide.

**Outcome:** `spec 012 downstream slices unblocked` (owner decisions, 2026-08-10).
Both gating decisions are now made:
- **Test-deadline project — Gauge.** The owner will set a real curated deadline
  on Gauge (its committed release, 2026-08-14, is the natural appetite), so
  goal + deadline + milestone + progress + RAG can be exercised together on one
  dogfooded card. This lights up the RAG/forecast/attention slices, which stay
  `unknown` until the deadline is actually written into Gauge's onboarding config.
- **Redesign direction — incremental, not a rebuild.** [Spec 011](../011-milestone-centric-cards/spec.md)
  **lands standalone** for the committed release; spec 012's raw analytics layer
  is then **layered into** that card (011's card is the middle tier), rather than
  folding 011 into a from-scratch glance→card→detail redesign. The layered IA is
  approached incrementally.

**What each downstream layer is cleared to build:**
- **Raw layer (velocity / cost by model·activity·skill / team / milestone-or-fallback)**
  — unblocked **now**; no deadline dependency. Cost must dedup at per-request grain
  (see `## Assumptions` in spec.md).
- **RAG / forecast / on-track / attention layer** — unblocked **once the Gauge
  deadline is set**; honest `unknown` everywhere until then.

**DoD (spike):**
- [x] Findings recorded above (done; re-validated against the live corpus 2026-08-10).
- [x] Outcome set to `spec 012 downstream slices unblocked` (2026-08-10) — owner
      picked the redesign direction (011 standalone, 012 layered in) and the
      test-deadline project (Gauge).
