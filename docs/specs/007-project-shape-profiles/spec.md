---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 007: Project-shape profiles

## Overview

Gauge's Jig adapter hardcodes the artifact layout to `<repoRoot>/docs/{specs,bugs,decisions,releases}`
and assumes **one repository is one portfolio entry**. Both assumptions break on
real projects in the validation corpus (`docs/inbox.md`):

- **Pattern B — nested sub-projects.** `mystique` keeps its real jig artifacts
  under `docs/opportunities/cwv/{specs,decisions}` (12 specs, 26 ADRs) and
  `docs/superpowers/specs`; the repo root has only two incidental spec dirs.
  Gauge either sees it as generic or renders a misleading `0/2`.
- **Pattern C — umbrella multi-track workspace.** `personalization-workspace`
  keeps three self-contained sub-projects under `tracks/{rtb,offer-management,contextual-experimentation}/{specs,decisions}`
  (11 specs, 14 ADRs total) and has **no** root `docs/specs`; gauge sees the
  whole umbrella as a single generic card, blind to all three tracks.

This spec adds a **project profile**: a small, versioned, transport-agnostic
document that declares a source's *shape* — where its jig-style artifacts live,
which folder/status conventions it uses, and how many portfolio entries it
yields. The adapter reads the profile instead of assuming the flat default.

The profile is deliberately **produced-once, consumed-by-either-transport**: the
central pull collector (`src/observation.mjs`, today) and the edge collection
skill relocated to the project ([spec 006](../006-edge-collection-client/spec.md),
later) both read the same profile. A project's shape is declared once; whichever
transport runs honors it. This is why the contract — not a `gauge.config.json`
convenience field — is the deliverable.

### Boundary

- **In scope:** the profile contract (a versioned schema), its consumption by the
  current pull adapter, and the dashboard rendering that follows (real cards for
  Pattern B/C). Profile *production* is hand-authored in 007-01/02 and automated
  (discovery/onboarding) in 007-03.
- **Out of scope (unchanged):** the push transport and ingest (specs 005/006);
  the two-layer derivation and any forecast/risk/attention policy (ADR-0006);
  the read-only-source guarantee (ADR-0003) — the profile describes shape, it
  never mutates a source. The thin-client *emission* of a profile stays with
  spec 006; this spec only guarantees the contract is emittable there.

### Relationship to existing work

Specs 005 (central ingest) and 006 (edge client + skill) are the **transport**
halves of the pull→push inversion ([ADR-0007](../../decisions/adr-0007-invert-collection-central-pull-to-edge-push.md)).
Neither addresses *project shape* — both still assume the adapter knows where a
project's artifacts are. This spec supplies the missing shape contract that both
transports consume, and honors project authority (ADR-0003): the profile is
project-owned shape that Gauge reads, never structure Gauge invents. No new
runtime dependency is introduced (ADR-0001): the profile is JSON, normalized like
`gauge.config.json`.

## Assumptions

Verified by probe (2026-08-03):

- The adapter's artifact roots are hardcoded to `<root>/docs/...` in
  `src/scan.mjs` (`scanSpecs`, `scanBugs`, `scanWorkstreams`, `countRefinement`).
- `mystique` real artifacts: `docs/opportunities/cwv/{specs,decisions}` (12 / 26)
  and `docs/superpowers/specs`; root `docs/specs` has 2 incidental dirs.
- `personalization-workspace`: `tracks/<name>/{specs,decisions}` (11 specs / 14
  ADRs across three tracks), no root `docs/specs`, self-declares its repos and
  each repo's owning track via a `repos.yaml` manifest (`scope:` tags).
- Pattern B/C sub-projects use **standard jig conventions** — `status:`
  frontmatter and `specs`/`decisions` folder names — only in **non-standard
  locations**. So the load-bearing need for the real corpus is *artifact-root*
  and *multi-entry*, not folder-name/status-encoding variance.

Unverified — carried, not asserted:

- **A1 (folder/status variance is real but unexercised).** Projects using
  `specifications`/`adrs` folder names or prose-encoded status exist in principle
  (per the user), but no project in the current corpus does. The profile carries
  optional overrides for them; 007-01 validates the *defaults-match-jig* path and
  leaves the override path exercised by synthetic fixtures only until a real
  project needs it.
- **A2 (per-entry git recency).** For a multi-entry / umbrella repo, whether a
  card's git recency should come from the umbrella repo or the track's
  `scope`-tagged external repos is unresolved; MVP assumes umbrella-repo recency.
  Deferred to the freshness/forecast line — see D3.

## Decomposition

**SPIDR axis: Data, then Path.** Split first by how much shape the profile
expresses — a single explicit artifact root (007-01) before N-entry
decomposition (007-02) — then by how the profile is *produced* — hand-authored
in config (01–02) before discovered/onboarded (007-03). Each slice turns a real
card that is currently wrong or missing into a correct one, so each is vertical
and independently visible on the dashboard. Happy path (author a correct profile)
first; automation last. **No spike:** the unknowns (roots, conventions,
self-declaration) are already probed; each slice ships working behavior.

## Slices

- [007-01 — Explicit artifact-root profile (Pattern B)](slice-01-artifact-root-profile.md)
- [007-02 — Multi-entry decomposition (Pattern C)](slice-02-multi-entry-decomposition.md)
- [007-03 — Profile discovery and onboarding](slice-03-profile-discovery-onboarding.md)

## Open decisions (ADR candidates — resolve during shaping/implementation)

- **D1 — profile contract location & precedence (ADR-0009 candidate, load-bearing).**
  Where the profile lives and who wins: inline in `gauge.config.json` per project
  (pull, today) vs a source-owned profile file the edge skill reads (push,
  spec 006) vs Gauge's private `stateDir`. *Recommendation:* one versioned
  contract (`schemas/project-profile-v1.schema.json`) readable from either
  location; config-inline is the MVP producer and a source-owned
  `gauge.profile.json` is the spec-006 seam. This is load-bearing (a wire/config
  contract that both transports depend on) and should be pinned by ADR-0009
  before 007-01 lands.
- **D2 — one-repo→N-entries identity & state layout.** How multiple entries from
  one repo are identified and stored: composite id `<baseId>-<entryId>` (satisfies
  `^[a-z0-9][a-z0-9-]{0,63}$`), a shared repository/git signal, per-entry
  execution/workstreams. Interacts with `observation.project.id` and the
  per-project `stateDir` layout. Resolve in 007-02 (may fold into ADR-0009).
- **D3 — per-entry git recency across external repos (deferred).** A track's code
  lives in `repos.yaml`-declared external repos; MVP uses umbrella-repo recency.
  Defer per-repo recency to the freshness/forecast line (interacts with #5).

## Cutline note

This capability is **not** part of the committed local-portfolio-loop MVP (which
assumed flat, single-repo projects). It is the enabling capability that lets
Gauge observe the real validation corpus. **007-01** is the minimal, high-value
fix (unblocks Pattern B) and is the recommended first cut; **007-02** (Pattern C
multi-entry) stretches toward the vision's explicitly-future "concurrent
goals / multi-source" line and is appetite-dependent; **007-03** (discovery)
removes the hand-authoring cost once 01/02 prove the contract.
