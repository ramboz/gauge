---
status: DONE
dependencies: [011-01]
last_verified: 2026-08-11
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
- [x] All ACs pass; full suite green. — 282/282.
- [x] Tests cover: slice→parent dedupe, done/total rollup, abandoned-spec
      handling, and the no-resolvable-specs → unknown fallback.
- [x] Each new test shown to fail when the feature is removed. — red confirmed
      per implementer TDD log (git-stash on the impl file).
- [x] Reviewed (compliance + craft). Deviation log + reconciliation sweep. — both
      PASS (`reviews/slice-02-compliance.md`, `reviews/slice-02-craft.md`);
      reconciliation review below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices and review nits.

- **Rollup extends `src/milestone.mjs`.** Added `extractReferencedSpecNumbers(text)`
  (AC1 — `\bspec\s+(\d+)(?:-\d+)?\b` captures the parent number, discards the
  slice suffix, dedupes), `milestoneSpecProgress(releaseBody, specs)` (AC2/AC4),
  and a `specItemsOf` execution lookup mirroring the existing structural pattern.
  `attachMilestones` now attaches `active.specProgress` (null when nothing
  resolves). `src/scan.mjs` carries the release doc's `body` on its workstream
  item so the parse needs no second read.
- **Abandoned-spec denominator rule (AC2, stated as required).** Milestone
  progress **reuses `progressOf` from `src/lib.mjs` verbatim** — it does not invent
  a second done rule. Under that rule, **ABANDONED specs are excluded from the
  denominator** (`denom = total − abandoned`), identical to the project-global
  bar. So `1 done, 1 abandoned, 1 draft` → `1/2`, not `1/3`.
- **Intra-module import (intentional).** `milestone.mjs` now imports `progressOf`
  from `lib.mjs` — a pure helper importing a sibling pure helper (precedent:
  `src/discover.mjs`). This is not an ADR-0001 runtime dependency (that rule is
  about external/npm deps); it is the correct way to satisfy "reuse the existing
  rule, don't invent a second one."
- **`denom === 0` falls back to the global bar (extension beyond literal AC4).**
  When every resolved referenced spec is abandoned, `progressOf` returns a
  non-null object with `denom: 0, pct: null`. The card treats this the same as
  "no resolvable specs" — nothing measurable to show — and falls back to the
  project-global bar (`public/index.html`, guard `active?.specProgress?.denom>0`).
- **Global-bar count-text spacing shifted (benign side effect).** Unifying the bar
  template changed the project-global count from `3/4 specs done` to
  `3 / 4 specs done` (spaces around the slash). No test pinned the old spacing;
  the new spacing matches the spec-012 mockup convention (`18 / 22 specs`).

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**: the
  milestone-join bullet now notes `active.specProgress` (011-02 rollup via
  `progressOf`) and the `body` field carried on release workstreams.
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE).
- **`schemas/observation-v1.schema.json`** → **no-op**: `specProgress` is a
  read-layer join, not an observation-v1 field (same boundary as the 011-01
  milestone join).
- **`docs/memory/glossary.md`** → **no-op**: no new domain term.
- **`CLAUDE.md` hot cache** → **no-op**: spec 011 still in flight; revisit at
  spec-close (011-05).
- **Deferred hardening (craft nits, non-blocking)** → **deferred**: (1) spec-number
  matching is literal 3-digit; an unpadded `spec 11` would not resolve to `011-…`
  (safe today — every release doc and spec id is zero-padded). Strip-leading-zeros
  normalization would remove the footgun. (2) The AC4 "no resolvable refs → global
  50%" test is a weak sentinel (passes even without the feature); the real guards
  are the AC3 `doesNotMatch(/10%/)` and the `denom===0` tests. Both logged for a
  future hardening pass; neither blocks.
- **`docs/inbox.md`** → **no-op**: nothing out of scope surfaced.
