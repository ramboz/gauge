---
status: DONE
dependencies: [011-01]
last_verified: 2026-08-11
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
- [x] All ACs pass; full suite green.
- [x] Tests cover: fallback trigger (no releases), labelled global bar, discovered
      workstreams surfaced, and a project with neither releases nor discovered
      workstreams degrading cleanly.
- [x] Each new test shown to fail when the feature is removed. — held for 5/6
      after implementation; the 6th (vacuous AC3-compact test) was strengthened in
      reconciliation with red-on-revert evidence.
- [x] Reviewed (compliance + craft). Deviation log + reconciliation sweep. — both
      PASS (`reviews/slice-03-compliance.md`, `reviews/slice-03-craft.md`);
      reconciliation review below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **Render-only change in `public/index.html`.** Added two pure helpers next to
  `workstreamRow`: `summarizeDiscovered(discovered)` (→ `{title, steps, done}`,
  `done = steps.total>0 && steps.done===steps.total`) and `discoveredRow(item)`
  (compact title + `done/total`, with a `chip ok">done` badge when complete).
  `card()` branches on `!active`: the has-active-milestone path renders
  **byte-identical** to before this slice; only the no-active branch adds the
  labelled fallback note + discovered rows.
- **Fallback gated on `!active`, not on `!barProgress`/`!milestoneProgress`.**
  Deliberate: it distinguishes "no release plan at all" (this slice) from 011-02's
  "has a release but unresolved spec refs" fallback — both show a global bar but
  must not share the note. Documented in an inline comment.
- **Pinned `items` still rendered in the fallback branch (conservative).** AC3
  speaks only of discovered workstreams, but a project with no release plan could
  still have pinned runbooks (`items`); the fallback renders those via
  `workstreamRow` too rather than silently dropping them. Additive, not a scope cut.
- **Fallback note copy imprecise for the all-shipped/dropped sub-case (accepted).**
  The note is the AC2-mandated literal "No release plan — overall spec progress.";
  the `!active` trigger also covers a project whose releases are all
  `shipped`/`dropped` (a plan *did* exist). The wording is mildly inaccurate there,
  but the copy is spec-fixed and the code comment acknowledges it — accepted
  tradeoff, flagged by both reviewers.
- **Test-quality fixes (from the craft pass).**
  1. *Vacuous AC3-compact test* — it passed even with the fallback branch reverted
     (discovered items were already surfaced by the pre-slice merged `streams`).
     Merged it with the completed-treatment test and added a scoped assertion that
     only `discoveredRow` can satisfy (a partial item's row must NOT carry the
     `chip ok">done` markup, which `workstreamRow` never emits). Red-on-revert
     confirmed.
  2. *Unfalsifiable AC4 assertion* — removed the `<details><summary>specs</summary>`
     check (`card()` never emits that markup); kept the load-bearing `001-a` /
     raw-path absence assertions.

### Reconciliation sweep

- **`docs/architecture.md`** → **no-op**: no contract surface touched — the slice
  only reads existing `workstreams.value.discovered` and `p.milestone` shapes and
  renders them (compliance pass confirmed).
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: render-only, no new field.
- **`docs/memory/glossary.md`** → **no-op**: "discovered workstream" / "fallback"
  already in the parent-spec model; no new term.
- **`CLAUDE.md` hot cache** → **no-op**: spec 011 still in flight; revisit at
  spec-close (011-05).
- **Deferred nit (non-blocking)** → **deferred**: `discoveredRow` re-derives the
  `done/total` step string that `workstreamRow` also builds (two call sites, below
  the ADR-0002 extract-on-third-caller threshold). Logged, not extracted.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.
