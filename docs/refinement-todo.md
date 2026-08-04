> Status: Active (reframed 2026-07-13 by
> [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)).
>
> Deferred decisions with concrete resolution triggers. Resolve hard-to-reverse
> choices through ADRs and link them here.

# Refinement Todo: Gauge

## Resolved foundations

- **Runtime and tests:** Node >= 18, ES modules, zero runtime dependencies,
  and `node:test`; see
  [ADR-0001](decisions/adr-0001-runtime-zero-deps.md).
- **Product and authority boundary:** Gauge is a central portfolio observer;
  source projects remain read-only systems of record; see
  [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md).
- **MVP appetite:** committed, maximum two weeks; see
  [local-portfolio-loop](releases/local-portfolio-loop.md).
- **Normalized observations and central history:** typed additive capability
  contract plus symmetric source/state isolation; see
  [ADR-0005](decisions/adr-0005-symmetric-source-state-isolation.md), which
  retains and corrects ADR-0004.

## Runtime retrofit foundation

### ~~Normalized observation and history contract~~ — RESOLVED 2026-07-13

**Decision needed:** versioned observation shape, provenance, freshness/error,
schema evolution, retention, and central instance-state location.

**Resolution trigger:** before spec 004 enters READY_FOR_IMPLEMENTATION.
**Resolved by:** [ADR-0005: Symmetric source and state isolation](decisions/adr-0005-symmetric-source-state-isolation.md),
which supersedes ADR-0004 while retaining its observation/history contract.

### Generic goal and deadline source

**Decision needed:** whether the first generic adapter uses one active GitHub
milestone, repository configuration, or both with explicit precedence.

**Resolution trigger:** before drafting the generic goal-adapter slice.

## MVP derivation policy

### Progress strategies

**Decision needed:** which sourced completion strategies are supported in the
two-week MVP and how each reports unsupported or unknown work.

**Resolution trigger:** after probing three real projects and before drafting
the progress/risk slice.

### Forecast confidence

**Decision needed:** minimum date/history evidence required for `on_track` or
`at_risk`; below it the only valid result is `unknown`.

**Resolution trigger:** after enough central observations exist to test a rule
against the three-project validation set.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md); this item resolves the
policy, not the placement.

### Cross-project attention overlay

**Decision needed:** smallest central policy that expresses portfolio intent
without duplicating project-local priorities—ordered projects, coarse tiers, or
deadline-plus-attention rules.

**Resolution trigger:** before implementing the global attention queue.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md), downstream of
forecast/risk; this item resolves the policy, not the placement.

## Collection and security

### Daily collection

**Decision needed:** local scheduler, GitHub Actions, or another central runner;
credential scope and failure visibility are part of the choice.

**Resolution trigger:** before automated daily writes to Gauge instance state.

**Shaping in progress (team tier):** the pull→push inversion in
[ADR-0007](decisions/adr-0007-invert-collection-central-pull-to-edge-push.md) and
[ADR-0008](decisions/adr-0008-ingest-identity-attestation-freshness.md), with
[spec 005](specs/005-central-observation-ingest-boundary/spec.md) (ingest) and
[spec 006](specs/006-edge-collection-client/spec.md) (edge client), reframes this
as edge-triggered push rather than a central runner. Both remain Proposed/DRAFT;
central pull stays the local-MVP default.

### Hosted small-team access

**Decision needed:** GitHub App registration, server-side session model,
organization/team membership revalidation window, hosting platform, and
collector credential separation.

**Resolution trigger:** after the local MVP ships and before follow-up 1 is
committed.

**Related:** the push topology
([ADR-0007](decisions/adr-0007-invert-collection-central-pull-to-edge-push.md),
[ADR-0008](decisions/adr-0008-ingest-identity-attestation-freshness.md)) is an
alternative to the "least-privilege scheduled collector" line in
[secure-small-team-hosting](releases/secure-small-team-hosting.md): edge clients
push with per-project credentials, so central needs no source access. The hosted
multi-tenant runtime and the ADR-0001 dependency/loopback question stay with that
release and are not resolved by ADR-0008.

## Optional ecosystem adapters

### Shaper target date

**Decision needed:** project-owned `target_date` field and semantics; do not
infer a deadline from appetite prose.

**Resolution trigger:** before drafting the Shaper adapter.

### Servo evidence mapping

**Decision needed:** stable export seam and typed mapping for suitability,
gate/regression state, and freshness. Servo scores never become delivery
completion.

**Resolution trigger:** after MVP usage demonstrates a need for evaluation
signals in Gauge.
## Project onboarding and multi-entry sources

### Convention discovery and multi-entry decomposition for non-flat projects

**PARTIALLY RESOLVED (spec 007):** shaped as
[spec 007](specs/007-project-shape-profiles/spec.md) with the contract pinned by
[ADR-0009](decisions/adr-0009-project-shape-profile-contract.md). Slice **007-01**
landed the single-entry **artifact-root** half (`project-profile-v1`;
`artifactRoot` + `specsDir`/`decisionsDir`/`statusProperty`), unblocking PATTERN B
(mystique `docs/opportunities/cwv`); slice **007-02** landed **multi-entry**
decomposition (`entries[]` → one repo yields N composite-id cards sharing the
umbrella git signal), unblocking PATTERN C (personalization-workspace's three
tracks). Only **007-03** discovery/onboarding remains open.

**Known limitation (from 007-02, follow-up):** an umbrella project's
`pinnedWorkstreams` propagate to *every* expanded entry, and pins resolve
repo-root-relative (not per-`artifactRoot`), so a pinned umbrella doc surfaces on
all N track cards. No corpus project pins today; per-entry pin scoping (or
suppressing umbrella pins on multi-entry expansion) is a small follow-up.

**Decision needed:** how gauge observes projects whose jig artifacts are not at
`<repoRoot>/docs/{specs,decisions}` and/or that host multiple sub-projects in one
repo. The Jig adapter currently hardcodes that layout and assumes one repo = one
portfolio entry. Two of three real validation patterns break: PATTERN B nested
sub-projects (mystique → `docs/opportunities/cwv/…`) and PATTERN C umbrella
multi-track workspace (personalization-workspace → `tracks/<name>/…`, no root
`docs/specs`, so the whole repo degrades to generic). Folder and status
conventions also vary (specs vs specifications; decisions vs adrs vs none; status
in a frontmatter property vs prose).

**Proposed shape:** an onboarding/profiling step (a skill run in the thin client)
that discovers each source's artifact roots, folder names, and status encoding
once and writes a per-project profile the thin client reads at report time when
hooks fire; one repo may yield N portfolio entries, each with its own goal and
progress. Projects that already declare their shape (personalization-workspace via
`repos.yaml` scope tags) should feed that in rather than be reverse-engineered —
aligns with the push/thin-client direction.

**Resolution trigger:** before onboarding any PATTERN B/C project for real, or when
generic goal/deadline collection is scheduled. Validate against mystique and
personalization-workspace (see the reference-project corpus in `docs/inbox.md`).

**Interaction:** a sub-project's git recency may span multiple external code repos,
which interacts with the freshness-from-git-recency work.
