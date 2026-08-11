---
status: DONE
dependencies: []
last_verified: 2026-08-11
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
- [x] All ACs pass; full suite green (no regressions).
- [x] Tests cover: extraction of usage+model, per-request dedup beats naive sum,
      unknown-model bucket, unmapped-project → unknown, and pricing math.
- [x] Each new test shown to fail when the feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-03-compliance.md`, `reviews/slice-03-craft.md`).
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed. — see below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **New module `src/cost.mjs`** (mirrors `src/velocity.mjs`'s pure-fold + thin-I/O
  + `attach*` shape): `encodeProjectPath` (Claude Code's non-alnum→`-`, no
  run-collapsing), `dedupeRecords` (global, keyed `requestId ?? message.id`,
  first-occurrence wins), `costFromRecords(records, priceTable)` (pure: dedupe →
  tally per model → price; unpriced → one `unknown-model` bucket `usd:null`, sets
  `hasUnknownModel`; empty → `null`), thin `sessionFilesForProject` /
  `readTranscriptRecords` (missing dir/file → `[]`, malformed line skipped),
  `projectTokenCost(path, projectsRoot, priceTable)`, and
  `attachTokenCost(data, byId)`. Wired into `/api/data` via `src/server.mjs`
  (`GAUGE_TRANSCRIPTS_ROOT` override); rendered in `public/index.html`
  (`costBlock` / `costHeadline` / `costLegendEntry` / `fmtUsd`).
- **Cache-aware pricing.** `input`, `cacheWrite` (`cache_creation_input_tokens`),
  and `cacheRead` (`cache_read_input_tokens`) are priced through separate rates
  (Anthropic's exclusive-buckets model — no double-count). `DEFAULT_PRICE_TABLE`
  is a clearly-marked **illustrative** constant (public repo; not real rates).
- **Reconciliation fixes (from the review passes).**
  1. *Sub-cent cost honesty* — a real `totalUsd > 0` that rounds to `$0.00` read
     as "free" (the "0-as-healthy" shape, same as 012-02's velocity precedent).
     Added `costHeadline`: renders `< $0.01` (composing to `< $0.01+` with the
     unknown-model floor marker); true `unknown` (null) unchanged. Red-on-revert
     tests added.
  2. *Redundant server ternary* — collapsed to `projectTokenCost(project.path,
     transcriptsRoot)` (undefined already triggers the default param).
  3. *`requestCount` mislabel* — it counted usage-less user turns; renamed
     `recordCount` (unsurfaced field, no other references).
- **Accepted/logged nits (non-blocking).**
  (a) *First-wins on differing usage is deliberately untested* — replayed records
  carry byte-identical usage by construction (the fixture and data model), so
  first/last/any are equivalent; a differing-usage transcript shape is not
  expected. Noted so a future shape change is a conscious revisit.
  (b) *Synchronous unbounded transcript read per `/api/data` request* — fine for
  the committed local single-user manual-pull MVP, but real blocking I/O with no
  cache; **deferred to the thin-client/central release** (it won't survive that
  topology unchanged), out of scope here.

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**: the
  read-layer-joins list now names the per-project `tokenCost` join (`attachTokenCost`,
  `src/cost.mjs`; `GAUGE_TRANSCRIPTS_ROOT`-configurable, per-request deduped,
  illustrative pricing + `unknown-model` bucket, `null` when no sessions map).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: `tokenCost` is a read-layer
  join sourced from Claude Code transcripts (a new local telemetry source, spec.md
  `## Assumptions`), not an observation-v1 field.
- **`docs/memory/glossary.md`** → **no-op**: the token-cost/per-request-dedup terms
  are defined in the parent spec + its Assumptions.
- **`CLAUDE.md` hot cache** → **no-op**: spec 012 still in flight; revisit at
  spec-close.
- **`docs/inbox.md`** → **no-op**: the sync-unbounded-read SRE item is logged in the
  deviation log against the thin-client/central release, not a fresh inbox entry.
