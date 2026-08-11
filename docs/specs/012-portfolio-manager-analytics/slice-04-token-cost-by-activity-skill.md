---
status: DRAFT
dependencies: [012-03]
last_verified:
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
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: phase bucketing, skill bucketing, unattributed fallback, and
      the buckets-sum-to-total invariant for both cuts.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.
