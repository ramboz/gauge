---
status: DRAFT
dependencies: [007-01]
last_verified:
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-03 — Profile discovery and onboarding

**Goal:** A read-only onboarding step introspects a source — and prefers a
source's own self-declaration (`repos.yaml` scope tags, a `tracks/*/specs`
layout) — to author a valid profile, so a Pattern B/C project is configured
without hand-writing artifact roots or entries.

**DoR:**
- ✅ 007-01 DONE (profile v1 contract + adapter consumption); 007-02 DONE
  strongly preferred so discovery can emit multi-entry profiles.

**Acceptance Criteria:**

1. **A discovery command proposes a profile.** `node scripts/onboard.mjs --path <repo>`
   (wired as `npm run onboard`) inspects a source **read-only** and prints a
   proposed profile-v1 document: detected artifact root(s), folder names, and —
   for umbrella repos — candidate `entries`.
2. **Declaration wins over guessing.** When the source self-declares structure (a
   `repos.yaml` with `scope:` tags, or a `tracks/*/{specs,decisions}` layout),
   discovery derives entries from that declaration rather than heuristics —
   honoring project authority (ADR-0003).
3. **Output is drop-in and valid.** The proposed profile validates against
   `project-profile-v1` and can be pasted into `gauge.config.json` unedited;
   discovery on `personalization-workspace` proposes the 3-track multi-entry
   profile, and on `mystique` proposes the `docs/opportunities/cwv` (+
   `superpowers`) root(s).
4. **Discovery is read-only and non-collecting.** It emits a profile only; it
   performs no source writes and no observation collection (the invariant and the
   separation of concerns both hold).
5. **Reusable at the edge.** The discovery logic is a pure module with no
   central-only assumptions, so [spec 006](../006-edge-collection-client/spec.md)'s
   edge skill can reuse it to self-profile a project at onboarding time.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage: heuristic discovery (nested roots), declaration-driven discovery
      (`repos.yaml` / `tracks/*`), profile-v1 validity of output, read-only
      assertion, and real-corpus smokes (mystique + personalization-workspace).
- [ ] Reviewed (compliance + craft).
- [ ] Deviation log + Reconciliation sweep produced.
- [ ] `docs/refinement-todo.md` entry marked RESOLVED (07 closes the onboarding item).

**Anti-horizontal-phasing check:** After this slice, a user runs one command
against a real Pattern C repo and gets a ready-to-paste profile that renders its
tracks — the hand-authoring cost from 01/02 disappears.

### Deviation log (after reconciliation)

_Filled during reconciliation._

### Reconciliation sweep

_Filled during reconciliation._
