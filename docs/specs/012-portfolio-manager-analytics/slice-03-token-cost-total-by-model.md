---
status: DRAFT
dependencies: []
last_verified:
---

## Slice 012-03 — token cost: total + by-model

**Goal:** Each project card shows a **total token cost** and a **by-model**
breakdown, sourced from Claude Code transcripts (`~/.claude/projects`), deduped at
per-request grain and priced through a per-model table. This is the first cut of
spec 012's deliberate depth exception (cost goes deeper than the otherwise-shallow
manager lens). No deadline dependency.

**DoR:**
- ✅ Transcripts carry per-record `input/output/cache` tokens + `model` across ≥4
  model tiers (Anthropic + occasional local), ~3 months deep (spike 012-01,
  re-validated 2026-08-10).
- ✅ Cost analytics is a **new local telemetry source outside the source repos**,
  not the observation loop (spec.md `## Assumptions`).

**Acceptance Criteria:**

1. **Transcript adapter.** A read-only adapter enumerates a project's session
   `*.jsonl` files under the Claude Code projects root and extracts, per assistant
   record, the `usage` token fields and `model`. The projects root is
   configurable/overridable (tests point it at a fixture, not `~`).
2. **Per-request dedup (load-bearing).** Token totals are keyed on a unique
   request id and deduped globally across session files, because running totals
   repeat per record and resumed sessions replay earlier history — naive summing
   overcounts by up to ~3.4× (spec.md `## Assumptions`, developer-view finding).
   A test proves the deduped total is strictly below the naive sum on a
   replay-containing fixture.
3. **Per-model pricing table.** A per-model input/output/cache price table maps
   token counts to a cost; unpriced/unknown models are surfaced explicitly (an
   `unknown-model` bucket), never silently priced at 0.
4. **Path→project mapping is honest.** Sessions map to projects by the encoded
   path; unmapped/temp/probe paths and projects with no mapped sessions render
   cost `unknown`, not `$0` (spec.md `## Assumptions`).
5. **Card render.** The card stat row shows the total cost and a compact by-model
   split (e.g. a stacked bar or short legend); illustrative/sanitized figures only
   in any committed fixture or mockup (public repo).
6. **Deterministic + read-only.** Given a fixed fixture the cost is deterministic;
   the adapter never writes and never logs raw prompt text.

**DoD:**
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: extraction of usage+model, per-request dedup beats naive sum,
      unknown-model bucket, unmapped-project → unknown, and pricing math.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.
