---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 010: Multi-entry goal/deadline

> Reserved on 2026-08-06 via `workflow.py new`.

## Overview

[Spec 009](../009-complete-local-portfolio-loop/spec.md) shipped the local
portfolio loop: a per-project **goal + deadline**
([ADR-0011](../../decisions/adr-0011-goal-deadline-source-strategy.md)), a
history-derived **forecast/risk** read, and the cross-project **attention
queue** ([ADR-0013](../../decisions/adr-0013-attention-overlay-policy.md)).
[Spec 007](../007-project-shape-profiles/spec.md) shipped the project-shape
**profile** ([ADR-0009](../../decisions/adr-0009-project-shape-profile-contract.md)),
including the **multi-entry** decomposition (ADR-0009 D2): one repository whose
`profile.entries[]` expands into N portfolio cards, each with its own
`artifactRoot` — the shape that makes nested sub-projects (Mystique's
`docs/opportunities/cwv` + `docs/superpowers`) and umbrella multi-track
workspaces (Personalization's `tracks/*`) visible as first-class cards.

These two features do not currently compose. `goal` and `deadline` are declared
**only at the top level** of `project-profile-v1` — the `entries[]` item schema
has no `goal`/`deadline` field, and config normalization (`expandEntries` in
`src/config.mjs`) builds each expanded entry-project's profile from a fixed set
of scalar fields that **excludes** goal/deadline. The consequence: every
multi-entry card is structurally locked out of the spec-009 loop. It can never
carry a goal, its `deadline` is permanently absent, its forecast is fixed at
`unknown (deadline-unknown)`, and it sits permanently in attention **tier 3
("needs a deadline set")** — regardless of how much delivery evidence the track
actually has. In the 2026-08-06 reference-corpus run, the five richest-progress
cards (Mystique CWV 12/24, Mystique Superpowers 0/98, and the three
Personalization tracks) were exactly the ones that could not participate in
forecast/risk/attention.

This spec closes that gap: **an `entries[]` item can declare its own `goal` and
`deadline`**, validated identically to the top-level fields and threaded through
config expansion onto each entry-project, so the existing read-layer join
(`joinProjectProfileFields`) and derivation layer (`attachForecasts`,
`attentionQueue`) light up per track with **no change to the read/derive
layers**. An entry that declares neither inherits the parent profile's
goal/deadline when present — matching how every other entry field already falls
back to the profile — and otherwise stays exactly as it is today (absent, honest
`unknown`).

This is additive and backward-compatible: a profile with no entry-level
goal/deadline (and no parent goal/deadline) validates and normalizes exactly as
it does pre-010. It does **not** touch ADR-0011's authoring policy (goal/deadline
are still human-curated literals, never derived from source prose), the
observation-v1 contract, or the forecast/attention math — it only lets the
multi-entry shape reach the fields the single-entry shape already reaches.

### Current state (verified 2026-08-06 against the worktree source)

Three probes established the change seams, so the design rests on read code, not
supposition:

- The read layer already keys goal/deadline off each **normalized project**, so
  no read/derive change is needed once expansion threads the fields.
  `joinProjectProfileFields` (`src/observation.mjs:728`) attaches
  `profile.goal`/`profile.deadline` per project id; `attachForecasts`
  (`src/derive.mjs:168`) reads `entry.project.deadline?.value`. Expanded
  entry-projects are ordinary single-entry projects downstream (`expandEntries`
  returns normalized project objects), so a per-entry profile carrying
  goal/deadline flows to the join unchanged.
- `expandEntries` (`src/config.mjs`) today constructs `merged` from exactly
  `{artifactRoot, specsDir, decisionsDir, statusProperty, specLayout}` and calls
  `resolvedSingleProfile`, which copies `goal`/`deadline` **only if present on
  `merged`** — so they are currently always dropped for entries. This is the
  single normalization seam to change.
- `validateEntry` (`src/profile.mjs`) derives its allowed fields from
  `ENTRY_SCHEMA.properties` and treats every entry field as a non-empty string;
  goal/deadline are objects, so — exactly as `validateProfile` already does for
  the top-level fields — they need explicit object validation, not the generic
  string check. The existing `validateGoalOrDeadline` helper is reusable as-is.

## Assumptions

None.

_No unverified load-bearing assumption remains — every load-bearing claim was probe-verified and recorded in `### Current state` above, so this section is empty by the risk-gated rule and the frame-critique trigger stays default-off._

## Decomposition

**SPIDR axis: Rules (single slice).** The change is one coherent rule —
"the goal/deadline contract that applies to a single-entry profile also applies
to an entry" — expressed across three thin seams (schema, validator, config
expansion) that only deliver value together and share one test surface. Splitting
by Data (goal-only, then deadline-later) would be horizontal phasing: goal and
deadline are the same object shape, the same validator helper, and the same
expansion line, so a goal-only slice would ship half a mechanism with no
independent user value and force the deadline half to re-touch every one of the
same files. One vertical slice crosses schema → validator → config → read-layer
join → visible per-track forecast/attention on the dashboard.

Spike was not needed: the seams and their behavior were established by executed
probes (see `## Assumptions`), not left open.

## Slices

- [010-01 — entry-level goal/deadline](slice-01-entry-goal-deadline.md)
