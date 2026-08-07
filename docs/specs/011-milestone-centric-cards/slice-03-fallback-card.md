---
status: DRAFT
dependencies: [011-01]
last_verified:
---

## Slice 011-03 — fallback card: global progress + discovered workstreams

**Goal:** A project with **no release plan** (the common case: jig, shaper, cwv)
renders an honest fallback — the project-global spec progress bar, labelled as a
fallback, plus the discovered checklist workstreams (the ≥3-checkbox docs already
scanned) — instead of an empty milestone area.

**DoR:**
- ✅ 011-01 landed (card distinguishes has-release-plan from not).
- ✅ `scanWorkstreams` already returns `discovered` checklist workstreams.

**Acceptance Criteria:**

1. **Fallback trigger.** A project with zero release plans (or none that yield an
   active/next milestone) shows the fallback layout, not the milestone layout.
2. **Global bar, labelled.** The fallback shows the project-global spec
   done/total bar with a clear "no release plan — overall spec progress" note, so
   it is not mistaken for milestone progress.
3. **Discovered workstreams surfaced.** The discovered checklist workstreams are
   listed compactly (title + step count), replacing the currently-empty
   workstreams area. Completed (all-checkboxes-done) discovered items follow the
   same active/next-vs-done treatment where a status is inferable; where it isn't,
   they are simply listed.
4. **No per-spec list, no path noise.** As with the milestone card, the fallback
   shows no `<details>` spec list.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Tests cover: fallback trigger (no releases), labelled global bar, discovered
      workstreams surfaced, and a project with neither releases nor discovered
      workstreams degrading cleanly.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed (compliance + craft). Deviation log + reconciliation sweep.
