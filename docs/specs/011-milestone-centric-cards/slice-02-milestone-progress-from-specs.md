---
status: DRAFT
dependencies: [011-01]
last_verified:
---

## Slice 011-02 — milestone progress from referenced parent specs

**Goal:** The active milestone's progress bar reflects *its own* delivery — the
done/total of the **parent specs** its release doc references — replacing the
project-global bar for release-plan projects.

**DoR:**
- ✅ 011-01 landed (active milestone is derived and rendered).
- ✅ `scanSpecs` exposes per-spec status (verified in `src/scan.mjs`).

**Acceptance Criteria:**

1. **Spec reference parse.** A release doc's referenced specs are extracted by a
   `spec NNN` pattern and normalized to **parent spec ids** (`009-01` and `009`
   both count once as `009`); slices are never counted or shown.
2. **Rollup.** Milestone progress = done parent specs / total referenced parent
   specs, where "done" uses the existing spec-status rule. Abandoned/dropped
   specs are handled by a documented rule (excluded from the denominator) and the
   choice is stated in the deviation log.
3. **Rendered on the active milestone.** The active milestone's bar and count
   (e.g. "3 / 4 specs") reflect this rollup, not the project-global figure.
4. **Unknown, not zero.** A release that references no resolvable specs yields
   milestone progress `unknown` (Gauge's unknown-is-explicit rule) and the card
   falls back to the global bar for that project — never a fabricated 0%.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Tests cover: slice→parent dedupe, done/total rollup, abandoned-spec
      handling, and the no-resolvable-specs → unknown fallback.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed (compliance + craft). Deviation log + reconciliation sweep.
