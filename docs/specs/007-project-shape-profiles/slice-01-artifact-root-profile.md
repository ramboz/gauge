---
status: DRAFT
dependencies: [adr-0009]
last_verified:
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 007-01 — Explicit artifact-root profile (Pattern B)

**Goal:** A versioned project profile lets the Jig adapter read a project whose
jig artifacts live under a non-root path, so `mystique`'s `docs/opportunities/cwv`
sub-project renders its real progress (~12 specs, 26 ADRs) instead of a generic
card or a misleading `0/2` — with zero change to flat projects that carry no
profile.

**DoR:**
- ✅ ADR-0009 (D1: profile contract location & precedence) accepted, fixing where
  the profile lives (`gauge.config.json`-inline for pull; source-owned file as the
  spec-006 seam) and the v1 field set.
- ✅ Probe confirms `mystique` real roots (`docs/opportunities/cwv/{specs,decisions}`)
  and that its specs use standard `status:` frontmatter (spec `## Assumptions`).

**Acceptance Criteria:**

1. **Profile v1 is a canonical, dual-validated contract.**
   `schemas/project-profile-v1.schema.json` defines: `artifactRoot` (string,
   default `"docs"`), and optional `specsDir` / `decisionsDir` /
   `statusProperty` overrides (defaults `specs` / `decisions` / `status`). A
   runtime validator agrees with the schema on a malformed-value matrix, mirroring
   the `observation-v1` pattern. No new runtime dependency (ADR-0001).
2. **Config accepts and normalizes a per-project profile.** `src/config.mjs`
   accepts a `profile` on a project entry (per ADR-0009), resolves `artifactRoot`
   relative to the project path, and rejects a malformed profile with one
   actionable error. A project with no `profile` normalizes exactly as today.
3. **The adapter reads roots from the profile.** `src/scan.mjs` derives its
   artifact roots from the resolved profile (`<root>/<artifactRoot>/{specs,decisions,…}`)
   rather than a hardcoded `docs`. With no profile, output is **byte-identical**
   to current behavior (default `artifactRoot: "docs"`) — verified against the
   existing `proj-jig` fixture observation.
4. **Pattern B renders real progress.** Observing `mystique` with
   `profile.artifactRoot = "docs/opportunities/cwv"` yields a **supported**
   execution signal whose spec count matches the real `cwv/specs` set (not
   generic, not `0/2`), and the `jigManaged` evidence check (spec 006-adjacent /
   #6) fires on the real root. `jig` / `gauge` / `servo` / `shaper` (no profile)
   are unchanged.
5. **Read-only holds.** Collection performs no writes to the source (existing
   invariant re-verified for the non-root path).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage: schema/runtime agreement, config normalization (valid + malformed
      profile), no-profile identity, and a synthetic nested-root fixture (plus a
      real-corpus smoke against `mystique`).
- [ ] Reviewed by `reviewer` subagent (compliance) + `pr-review` (craft) + arch pass.
- [ ] Deviation log + Reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` "Project onboarding and multi-entry sources" entry
      updated (07-01 resolves the artifact-root half).

**Anti-horizontal-phasing check:** After this slice, a user points a config
entry at `mystique` with one `artifactRoot` line and the dashboard shows a real
`cwv` progress card that was previously generic — end-to-end, observable value.

### Deviation log (after reconciliation)

_Filled during reconciliation._

### Reconciliation sweep

_Filled during reconciliation._
