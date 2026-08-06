---
status: Accepted
dependencies: [adr-0001, adr-0003, adr-0006, adr-0007]
last_verified: 2026-08-03
frame_review: true
---

# ADR-0009: Project-shape profile contract — location, precedence, and one-repo→N-entries

## Status

Accepted (2026-08-03)

Unblocks [spec 007](../specs/007-project-shape-profiles/spec.md) (project-shape
profiles). Scoped to how Gauge learns a source's *shape*; it does not change the
observation contract, the two-layer derivation (ADR-0006), or the push transport
(ADR-0007/0008). Like those ADRs it is buildable under ADR-0001 (the profile is
JSON, normalized like `gauge.config.json`).

**Owner acceptance (2026-08-03):** the "one contract, both homes" option with
config-inline precedence was chosen directly by the owner during shaping.

## Context

Gauge's Jig adapter hardcodes the artifact layout to `<repoRoot>/docs/{specs,bugs,decisions,releases}`
and assumes **one repository is one portfolio entry**. Both break on the real
validation corpus (`docs/inbox.md`): `mystique` keeps its jig artifacts under
`docs/opportunities/cwv/…` (Pattern B), and `personalization-workspace` keeps
three sub-projects under `tracks/<name>/…` with no root `docs/specs` (Pattern C).

Specs 005 (central ingest) and 006 (edge client + skill) are the **transport**
halves of the pull→push inversion; neither addresses *project shape*, and both
still assume the adapter knows where a project's artifacts are. Any fix therefore
needs a shape contract that **both** the central pull collector (`src/observation.mjs`,
today) and the relocated edge skill (spec 006, later) consume. Three decisions
must be settled before spec 007's first slice can be built: where the profile
lives, which home wins when both are present, and how one repository yields
multiple portfolio entries.

Verified constraints (probed 2026-08-03):

- `src/config.mjs` already normalizes `gauge.config.json` per project and resolves
  paths relative to the config file; a `profile` object slots into that path with
  no new dependency (ADR-0001).
- `observation.project.id` is constrained to `^[a-z0-9][a-z0-9-]{0,63}$`
  (`schemas/observation-v1.schema.json`), so any multi-entry id scheme must stay
  within it.
- Pattern B/C sub-projects use standard jig conventions (`status:` frontmatter,
  `specs`/`decisions` folder names) in non-standard **locations** — so the
  load-bearing fields are the artifact root and the entry set, with folder/status
  overrides optional.

## Decision Options Considered

### Location & precedence

- **A. Config-inline only.** Profile lives only in `gauge.config.json`. Smallest
  surface, but the push seam (a source-owned profile the edge skill reads) is left
  undesigned until spec 006 needs it.
- **B. Source-owned only.** Profile always lives in the source repo
  (`gauge.profile.json`); config references it by path. Most project-authority-pure
  and push-native, but requires a file in every source before pull works, and puts
  a Gauge artifact inside a read-only source.
- **C. One contract, both homes.** A single versioned `project-profile-v1`
  document, readable **either** inline in `gauge.config.json` (pull/MVP producer)
  **or** from a source-owned `gauge.profile.json` (spec-006 push seam). Config-inline
  wins when both are present.

### One-repo→N-entries identity

- **D. Separate config entries per sub-project** sharing a repo path. Explicit, but
  duplicates the repo path N times and scatters one project's shape across N
  config blocks.
- **E. A single profile with an `entries[]` list.** One config entry expands into N
  observations; each entry carries `id` / `label` / `artifactRoot`. Composite id
  `<baseId>-<entryId>` stays within the id pattern; the repository/git signal is
  shared from the umbrella repo, execution/workstreams are per entry.

## Recommended Decision

**Location & precedence — C (one contract, both homes; config-inline wins).**
Define `schemas/project-profile-v1.schema.json` as the single versioned contract.
For the pull/MVP path a project declares its profile **inline** in
`gauge.config.json`; the identical contract can also live as a source-owned
`gauge.profile.json` for spec 006's edge skill to emit and read. When both are
present, **config-inline takes precedence** (the operator's local view wins over a
source-declared default, and it keeps the MVP fully operable without writing into
any source — honoring ADR-0003's read-only-source guarantee). "Declared once,
honored by whichever transport runs" is preserved because the schema — not a
config convenience field — is the contract.

**One-repo→N-entries — E (`entries[]` with composite ids).** A profile may carry an
optional `entries` array; a profile without it is a single entry (the Pattern A/B
case). Each entry expands into its own observation with a composite id
`<baseId>-<entryId>` (pattern-valid), its own `artifactRoot`-scoped
execution/workstreams, and a **shared** repository/git signal from the umbrella
repo. Per-entry git recency across a track's external `repos.yaml` repos is **not**
resolved here (see Open questions / D3).

Profile v1 field set (minimal, extensible): `artifactRoot` (default `"docs"`),
optional `specsDir` / `decisionsDir` / `statusProperty` overrides (defaults
`specs` / `decisions` / `status`), and optional `entries[]` (`id`, `label`,
`artifactRoot`, plus the same optional overrides). A runtime validator agrees with
the schema, mirroring the observation-v1 dual-validation pattern.

## Consequences

**Becomes easier:**

- Observing Pattern B/C projects: `mystique` and `personalization-workspace` become
  first-class without touching the observation contract or derivation.
- A single shape contract consumed by both transports — the pull collector today,
  the edge skill later — with no divergence.
- Keeping sources read-only: the MVP never writes a profile into a source (inline
  config carries it); the source-owned file is opt-in for the push era.

**Becomes harder:**

- Two homes mean a precedence rule to document and test (config-inline wins).
- `config.mjs` gains profile normalization/validation, and the observe path gains
  one-config-entry→N-observation expansion with composite ids and per-entry state
  directories (must preserve ADR-0005 disjointness/containment).
- A profile can drift from a project's real layout; discovery/onboarding
  (slice 007-03) mitigates by generating it from the source.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **A1 — a `profile` slots into config normalization with no new dependency.**
  Verified by reading `src/config.mjs` (per-project normalization, path resolution
  relative to the config file) and ADR-0001. The profile is JSON parsed like the
  rest of the config.
- **A2 — composite ids stay pattern-valid.** `<baseId>-<entryId>` with kebab ids
  satisfies `^[a-z0-9][a-z0-9-]{0,63}$` (schema-verified) as long as combined
  length ≤ 64; enforced at normalization time.
- **A3 — folder/status overrides are unexercised by today's corpus.** Verified:
  Pattern B/C specs use `status:` frontmatter and `specs`/`decisions` folders. The
  override fields exist for generality and are exercised by synthetic fixtures
  until a real project needs them.

## Kill criteria

- If config-inline precedence proves confusing in practice (operators expect the
  source-declared profile to win), flip precedence rather than keep a rule that
  surprises — but do so via a superseding ADR, not silent behavior drift.
- If multi-entry composite ids collide with real project ids or overflow the id
  pattern for realistic track names, revisit option D (explicit per-entry config
  entries) before shipping 007-02.
- If a shared umbrella-repo git signal makes track cards misleading (a track is
  active while the umbrella is quiet, or vice-versa), the per-entry recency
  question (D3) becomes blocking for 007-02 rather than deferrable.

## Open questions

- **Per-entry git recency (D3).** Whether a track card's recency should come from
  the umbrella repo or its `scope`-tagged external repos in `repos.yaml`. Deferred
  to the freshness/forecast line (interacts with the #5 git-recency work).
- Whether the source-owned `gauge.profile.json` is committed to the source or lives
  in an ignored path — an operational detail for spec 006, not fixed here.
- Whether discovery (007-03) should ever *write* a source-owned profile, or only
  ever emit a config-inline block (default: emit config-inline; writing into a
  source stays opt-in and out of the read-only MVP).

## Amendments

- **2026-08-06 (spec 010-01) — `entries[]` items may carry `goal`/`deadline`.**
  The one-repo→N-entries contract (D/E above) originally gave each entry only
  `id` / `label` / `artifactRoot` (+ the `specsDir` / `decisionsDir` /
  `statusProperty` / `specLayout` overrides), and authored `goal`/`deadline`
  ([ADR-0011](adr-0011-goal-deadline-source-strategy.md)) lived only at the
  top level of the profile. That left every multi-entry (Pattern B/C) card
  unable to carry a goal or deadline, so it was pinned at attention tier 3
  regardless of delivery evidence. Slice 010-01 adds an optional `goal` and
  `deadline` to each `entries[]` item — the **same object shape** as the
  top-level fields, single-sourced from the schema's `$defs` so the two cannot
  drift — with fallback to the parent profile's value when the entry declares
  none (mirroring the existing per-entry override→profile fallback for the
  other fields). This is additive and backward-compatible (a profile with no
  entry-level goal/deadline normalizes byte-identically to pre-010) and does
  **not** change ADR-0011's authoring policy: values remain human-curated
  literals, never inferred from source prose. No `project-profile-v1` version
  bump. See
  [spec 010](../specs/010-multi-entry-goal-deadline/spec.md).
