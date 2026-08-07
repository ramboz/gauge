---
status: DRAFT
dependencies: []
last_verified:
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
- [ ] All ACs pass; full suite green (no regressions).
- [ ] Tests cover: shipping-wins-over-committed, committed-as-active,
      shipped/dropped excluded, tie-break determinism, appetite→unknown, and the
      no-active-milestone degradation.
- [ ] Each new test shown to fail when the feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Reconciliation review passed.
