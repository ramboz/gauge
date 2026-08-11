---
status: DONE
dependencies: [012-03]
last_verified: 2026-08-11
---

## Slice 012-04 — token cost: by-activity + by-skill

**Goal:** Extend the cost analytics (012-03) with the deeper cut the depth
exception calls for: cost attributed **by jig activity phase** (review / impl /
plan, from `[jig:phase=…]` tags) and **by skill** (from skill invocations), shown
in a project **detail tier** so the card stays uncluttered. Builds on 012-03's
deduped per-request base.

**DoR:**
- ✅ 012-03 landed the deduped per-request cost base and per-model pricing.
- ✅ Transcript records can be correlated with jig phase tags (`[jig:phase=…]`,
  emitted by `jig-telemetry.sh` at implementation/review time) and with skill
  invocations (spec.md manager-metrics catalog: cost-by-activity = J, cost-by-skill
  = J).

**Acceptance Criteria:**

1. **By-activity attribution.** Deduped per-request cost is bucketed by activity
   phase parsed from the `[jig:phase=…]` prompt tag (impl / compliance / craft /
   arch / code-health / reconciliation / plan); untagged requests fall into an
   explicit `unattributed` bucket, never dropped or misfiled.
2. **By-skill attribution.** Cost is bucketed by the skill in effect where a skill
   signal is available; requests with no skill signal go to `unattributed`.
3. **Detail-tier placement.** These breakdowns render in the project **detail
   tier**, not on the card face — the manager lens stays shallow everywhere except
   this deliberate cost depth (spec.md scope boundary).
4. **Reconciles to the total.** For any project, the sum of by-activity buckets
   (incl. `unattributed`) equals 012-03's deduped total; likewise by-skill. A test
   asserts this invariant.
5. **Unknown is explicit.** A project with no phase/skill signal shows the work as
   `unattributed`, not as zero-cost activity.

**DoD:**
- [x] All ACs pass; full suite green (no regressions). — 388/388.
- [x] Tests cover: phase bucketing, skill bucketing, unattributed fallback, and
      the buckets-sum-to-total invariant for both cuts.
- [x] Each new test shown to fail when the feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-04-compliance.md`, `reviews/slice-04-craft.md`).
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed. — see below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **Extends `src/cost.mjs` (reuses 012-03's dedup + pricing, never forks them).**
  Pure folds `costByActivity(records, priceTable)` and `costBySkill(records,
  skillBySession, priceTable)`: dedupe once via `dedupeRecords`, partition the
  usage-bearing records into disjoint buckets, then re-price each partition through
  `costFromRecords`. Because pricing is linear in tokens, **summed bucket totals
  reproduce the whole-set total by construction** (AC4 invariant, tested for both
  cuts incl. a mixed known/`unknown-model` case). Plus `buildSkillBySession`,
  `skillUsagePathForProject`, `readSkillUsageRecords`, and `attachCostBreakdown`.
- **Phase attribution.** `[jig:phase=X]` is read only from `role:'user'` records
  (string or `[{type:'text',text}]` content); state is per-`sessionId` in record
  order — a tag sets the current phase for subsequent usage records in that session
  until the next tag; no preceding tag → `unattributed`. Phases never borrow across
  sessions.
- **Skill join.** `session_id → skill_name` from `skill-usage.jsonl`
  `skill_invoked` entries (non-empty name, first wins); joined to the transcript's
  `sessionId`. Read from `<projectPath>/.claude/skill-usage.jsonl`; absent → all
  `unattributed`.
- **Detail-tier render.** `costDetailBlock`/`costBreakdownRow` render inside a
  collapsed `<details class="sect">` appended after the card face; `costBlock`
  (the card stat row) is unchanged. Labels are `esc()`'d (XSS-tested).
- **Reconciliation fix (from the review passes).** *3× transcript read per
  request* — both reviewers flagged that `projectTokenCost` +
  `projectCostByActivity` + `projectCostBySkill` each independently scanned/read/
  parsed/deduped the same transcripts. Added `projectCostBundle(path, root,
  priceTable, skillUsagePath)`: reads session files + dedupes **once**, reads
  skill-usage once, fans the single deduped set into the three folds, returns
  `{tokenCost, tokenCostBreakdown:{byActivity, bySkill}}`. `src/server.mjs` now
  calls it once per project (regression-guard test asserts the three separate
  combinators no longer appear in `server.mjs`). Folds + invariant unchanged. Also
  loosened the brittle exact-order import assertion to presence-based.
- **Accepted/logged nits (non-blocking).** (a) Records with a null/missing
  `sessionId` share one bucket key in both the phase-state map and the skill join —
  theoretical only (every real transcript record carries `sessionId`). (b) The
  transcript `sessionId` ↔ skill-log `session_id` join is validated against
  fixtures, not real corpus; if the fields ever diverge, affected records degrade
  to the explicit `unattributed` bucket — never a crash, never a silent mis-join.

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**: the
  read-layer-joins list now names the `tokenCostBreakdown: {byActivity, bySkill}`
  detail-tier join (`attachCostBreakdown`; partitions the same deduped set;
  `unattributed` bucket; buckets sum to `tokenCost`).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: read-layer join, not an
  observation-v1 field.
- **`docs/memory/glossary.md`** → **no-op**: activity/skill-attribution terms
  defined in the parent spec's manager-metrics catalog.
- **`CLAUDE.md` hot cache** → **no-op**: spec 012 still in flight; revisit at
  spec-close.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced (the request-path
  I/O item was resolved in-slice via `projectCostBundle`, not deferred).
