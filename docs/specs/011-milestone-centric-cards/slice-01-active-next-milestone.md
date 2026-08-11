---
status: DONE
dependencies: []
last_verified: 2026-08-11
---

## Slice 011-01 — active-and-next milestone from release Status

**Goal:** For a project that has release plans, the card leads with its **active
milestone** (title = the goal, appetite = the deadline, inline) and a compact
**Next** list, derived from each release's `## Status`; the project description
"goal" and the per-spec list are removed. (Milestone-specific progress arrives in
011-02; until then the existing global bar is reused.)

**DoR:**
- ✅ `scanWorkstreams` emits release plans as `kind: 'release'` with parsed body
  (verified present in `src/scan.mjs`).
- ✅ The read layer (`/api/data`) can carry new per-project fields (as it does
  for goal/deadline/forecast).

**Acceptance Criteria:**

1. **Active-milestone derivation.** From a project's release plans, exactly one
   **active** milestone is selected: the release whose `Status` is `shipping`,
   else `committed`; if several share the winning status, the deterministic tie-break
   is documented and stable (e.g. lexicographic by filename). Releases with
   status `shipped` or `dropped` are never active or next.
2. **Next list.** All `candidate` releases (plus any `committed` releases not
   chosen as active) are exposed as "next", in a stable order; `shipped`/`dropped`
   are excluded.
3. **Goal = active title; description gone.** The card renders the active
   milestone's title as the goal line; the project-description goal (ADR-0011
   prose) is no longer rendered on the card.
4. **Deadline = appetite, inline.** The active milestone's appetite is rendered
   inline with it as timebox text; when the appetite is absent or "TBD", it
   renders `unknown` — never a fabricated date, never blank.
5. **No per-spec list.** The `<details>` spec list is removed from the card.
6. **Graceful when no active milestone.** A project whose only releases are
   `shipped`/`dropped` (or which has release plans that don't parse a status)
   shows no active milestone and no crash — it degrades to the fallback handled
   in 011-03 (this slice must not break such a card).

**DoD:**
- [x] All ACs pass; full suite green (no regressions). — 267/267.
- [x] Tests cover: shipping-wins-over-committed, committed-as-active,
      shipped/dropped excluded, tie-break determinism, appetite→unknown, and the
      no-active-milestone degradation.
- [x] Each new test shown to fail when the feature is removed. — red confirmed
      before each implementation step (implementer TDD log).
- [x] Reviewed by `reviewer` subagent (compliance + craft). — both PASS
      (`reviews/slice-01-compliance.md`, `reviews/slice-01-craft.md`).
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] Reconciliation review passed.

### Deviation log (after reconciliation)

Original ACs above are unchanged; this records what the implementation did
differently and why.

- **New pure module `src/milestone.mjs`.** `selectActiveMilestone` /
  `selectNextMilestones` / `attachMilestones`, a read-layer fold mirroring
  `derive.mjs`'s `attachForecasts`/`attentionQueue` composition. Chosen over
  client-side derivation so the ACs are unit-testable without the DOM.
- **Release enrichment in `src/lib.mjs` + `src/scan.mjs`.** Added
  `parseReleaseStatus` / `parseReleaseAppetite` pure parsers; `scanWorkstreams`
  enriches each `kind: 'release'` workstream with `status`/`appetite` from the
  file it already read (no extra I/O).
- **Label = "Timebox:" not "Deadline:" (AC4).** The appetite is rendered inline as
  `Timebox: <text>`, matching the spec's "timebox text" wording and keeping it
  distinct from the concrete profile `deadline` (still consumed unchanged by
  `derive.mjs`'s forecast/attention, just no longer echoed on the card).
- **Replaced (not merely extended) four 009-01 goal/deadline card tests.** AC3
  removes the project-description goal/deadline render path, so the tests
  asserting it were rewritten to the new milestone-centric shape (7 new 011-01
  render tests). Faithful update, flagged to and accepted by the compliance pass.
- **Generic `workstreams` section left in place.** The full "workstreams = active
  + next only" redesign is spread across 011-03/04/05; this slice's 6 ACs don't
  require removing the generic list, so the active release still appears once more
  there. Intentional minimal-scope choice, not an oversight.
- **Reconciliation nit fixes (from the craft pass).**
  1. *Double-label wart* — on real plans the appetite text leads with a bold
     "Deadline: …", which rendered as `Timebox: Deadline: 2026-08-14.`. Added
     `stripDeadlineLabel` in `lib.mjs` so `parseReleaseAppetite` strips a leading
     "Deadline:" label; added a regression test (red→green confirmed). `unknown`
     behavior for TBD/absent is unchanged.
  2. *Comparator duplication* — extracted a shared `byPath` comparator in
     `milestone.mjs` and dropped a redundant `.slice()` after a `.filter()`.

### Reconciliation sweep

- **`docs/architecture.md` — Contract surfaces (`/api/data`)** → **updated**:
  the read-layer-joins bullet now names the derived `milestone: {active, next}`
  join (`attachMilestones`, `src/milestone.mjs`) alongside the 009-01/02/03 joins,
  closing the compliance pass's contract-surface note.
- **`docs/specs/README.md` status board** → **updated** (regenerated on the DONE
  transition).
- **`schemas/observation-v1.schema.json`** → **no-op**: `milestone` is a
  read-layer join, not an observation-v1 field (same boundary as goal/deadline
  and forecast — ADR-0005/0006).
- **`docs/memory/glossary.md`** → **no-op**: no new domain term; "milestone /
  workstream = a shaper release plan with a `## Status`" is already the model in
  the parent spec.
- **`CLAUDE.md` hot cache** → **no-op**: spec 011 is still in flight (only 011-01
  DONE); no closed-spec compression or load-bearing invariant change to migrate
  yet. Revisit on spec-close (011-05).
- **`docs/decisions/lightweight-decisions.md`** → **deferred (nudge)**: the
  `Timebox:` card label and the strip-"Deadline:"-label rendering are UI-copy
  choices; captured here in the deviation log rather than a separate entry, since
  the full card copy is still being shaped across 011-02..05. Promote to a
  lightweight decision at spec-close if the labels stabilize.
- **`docs/inbox.md`** → **no-op**: no out-of-scope items surfaced during
  implementation.
