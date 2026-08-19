> Status: Active target architecture (reframed 2026-07-13 by
> [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)).
>
> The POC runtime was retrofitted onto the Gauge boundary through
> [spec 004](specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md).

# Architecture: Gauge

## Architectural stance

Gauge is a local-first portfolio observer with an adapter boundary. Source
projects are read-only systems of record; Gauge owns only its private instance
configuration, observations, history, and derived portfolio views.

ADR-0001 fixes the MVP runtime at Node >= 18, ES modules, built-in tests, and
zero runtime dependencies. ADR-0003 fixes the product and authority boundary.
ADR-0005 retains ADR-0004's versioned observation/history contract while
requiring symmetric filesystem-identity isolation between instance state and
every configured source.

## Repository structure

```text
gauge/
├── schemas/                     # canonical versioned observation contracts
├── src/                         # config, observation core, state, adapters, delivery
├── public/                      # local single-page Gauge dashboard
├── scripts/                     # explicit central collection entrypoint
├── test/                        # unit/integration tests and synthetic project trees
├── docs/decisions/              # architectural authority
├── docs/specs/                  # Jig implementation lifecycle
├── docs/releases/               # Shaper release boundaries
├── gauge.config.example.json    # canonical version-1 instance registry
└── scaffold.json                # Jig scaffold metadata
```

Instance configuration and durable observations may live in the private Gauge
repository for the MVP, but runtime modules must treat their location as an
explicit instance-state boundary rather than assuming product code and user
data always share a repository.

## Target data flow

```text
project-owned sources
        |
        v
optional source adapters
        |
        v
versioned normalized observations
        |
        v
private Gauge instance history
        |
        v
deterministic derivation policies
        |
        v
local cards + global attention queue
```

Collection stops at source reads. No refresh, scan, or scheduled job writes to
configured project repositories.

## Module boundaries

### Registry and instance state

Owns project membership, source configuration, optional portfolio-priority
overlay, daily observations, and retention. It does not own project goals,
deadlines, or lifecycle state.

`src/config.mjs` normalizes `gauge.config.json` relative to the config file,
requires stable project ids, and provides deterministic legacy migration.
`src/state.mjs` validates observations and writes immutable JSON records beneath
the explicit `stateDir`; it never derives a write path from a source root.

**Self-owned write surfaces (spec 014 thin client).** Gauge writes to exactly two
places it owns, never a configured source repository: (1) its own instance state
(observations/history) under `stateDir`, always via `collectObservation`
(`src/state.mjs`) with its `assertDisjoint` source/state isolation; and (2) at
**install time only**, the user's own Claude Code config
(`~/.claude/settings.json`) to register the session-stop capture hook
(`scripts/install-hook.mjs`, spec 014-01) — the user's own tool configuration, not
a source repo. The `SessionEnd` capture hook itself (`scripts/session-stop-hook.mjs`)
writes only Gauge state via `collectObservation`; it observes each matched
project's `project.path` (main tree), never the session `cwd`, so unmerged
worktree state cannot enter the history. The read-only-source constraint
(ADR-0005) holds unchanged.

### Source adapters

Translate source evidence into normalized observations. Planned adapters are:

- goals and due dates are authored into the project profile by a curated
  onboarding step ([ADR-0011](decisions/adr-0011-goal-deadline-source-strategy.md),
  spec 009-01), not extracted at runtime; the generic GitHub milestone adapter is
  deferred with hosted/GitHub-push collection;
- Jig for specs, bugs, decisions, blockers, and eligible work;
- Shaper for release scope, cutline, risks, and readiness;
- Servo for evaluation suitability, gate/regression state, and freshness.

Adapters are optional and degrade to explicit unsupported/unknown signals. An
adapter cannot mutate its source or redefine another adapter's semantics.

### Observation/history contract

`schemas/observation-v1.schema.json` is canonical. `src/observation.mjs` derives
shared patterns/enums from it, validates the typed v1 repository, execution,
workstream, hygiene, and narrative capabilities, and preserves unknown
capability types or versions without letting v1 readers interpret them.

Adapters produce candidates. Exclusive signals require one candidate or an
explicit unambiguous policy; merge-safe signals retain contributor identity and
compose only compatible supported versions. Provenance and freshness remain
per adapter and signal. The superseded project-local Compass JSONL file is an
optional read-only Jig narrative input.

### Derivation engine

Gauge reads its observations through two layers over the shared
adapter → observation → history substrate, separated by time
([ADR-0006](decisions/adr-0006-two-layer-derivation.md)):

- **Current-state layer** — reads only the latest observation per project and
  renders the project card. This is the shipped path (`observeAll` in
  `src/observation.mjs`, consumed by `src/cli.mjs`, `src/server.mjs`, and
  `public/index.html`); it never reads history.
- **History-derived layer** — reads the observation series through
  `readObservationHistory()` (`src/state.mjs`) and folds it into observed pace,
  deadline confidence, categorical risk, forecast, and the cross-project
  attention ordering that ranks them. Landed as `src/derive.mjs` (spec 009-02):
  a zero-import pure fold — `deriveForecast(observations, deadline)` implements the
  ADR-0012 four-gate forecast/risk rule (`on_track`/`at_risk`/`unknown` + reason),
  and `attachForecasts(data, historiesByProjectId)` composes it across the
  portfolio. The **deadline is passed in by the caller** (like the registry set),
  so the module imports only observation helpers — never adapters, `src/scan.mjs`,
  `config.mjs`, or `profile.mjs` — and never writes. The cross-project attention
  ordering (spec 009-03, ADR-0013) extends this same module downstream of
  forecast/risk: `attentionQueue(data)` folds the per-project forecast reads into a
  deterministic five-tier lexicographic ranking (at_risk → stale/blocked →
  needs-owner-input → awaiting-evidence → on_track; within-tier by deadline
  proximity), keyed on the derived read — never owner-assigned importance.

Policies are deterministic, independently testable, and explain their evidence.
Missing dates or insufficient history cannot yield `on_track` or `at_risk`, and
the `collection.status` envelope is never derivation evidence.

**History source — reconstructed and captured (ADR-0017, refining ADR-0006).**
The history the derivation layer folds over is not only forward-accumulated
snapshots. The full `progress(t)` series already exists in **git** (each spec's
status transition is timestamped), so it can be **reconstructed** by walking
commit history — the "insufficient-history" gate is a *code* limitation, not a
data one. Going forward, capture is **event-driven and owned by the thin
client**: a Claude Code `Stop`/`SessionEnd` hook writes an observation snapshot
per session end (dense, forward, derive-never-ask). "Central collection" is
aggregation of those captures, not scheduled/manual pull. Division of labour:
**git = the past** (optional backfill seed), **session-stop capture = the
future** (thin client), **Gauge = read + derive** (never captures on a source's
behalf).

**Manager-lens analytics (ADR-0017; [spec 012](specs/012-portfolio-manager-analytics/spec.md)).**
The manager view derives, at milestone granularity: RAG health; a countable
attention row (PRs-awaiting-merge via `gh` · specs-in-flight · blockers, the
last *approximate* pending jig#195); git velocity; human-vs-agent split; and
**token-cost analytics** by model / activity / skill sourced from Claude Code
transcripts (`~/.claude/projects`), which **must dedup at per-request grain**
(naive summing overcounts materially). Slice/session/task depth is out of scope
— the engineer daily-driver's job.

### Delivery

`src/cli.mjs`, `src/server.mjs`, and `public/index.html` consume the canonical
observation envelope. The page gates every known capability by exact v1 and
isolates malformed cards. The HTTP server binds to loopback. Authenticated
hosting is a separate release and trust boundary; it must protect both rendered
HTML and underlying data.

## Landed POC bridge

Spec 004 retained the useful POC behavior behind the Gauge boundary:

- direct Jig reads live behind the optional Jig adapter;
- generic projects produce valid repository observations and explicit unknown
  or unsupported signals;
- scans remain read-only while the explicit collector writes central immutable
  history;
- `scripts/snapshot.mjs` retains its compatibility filename but no longer
  accepts or performs source-project writes;
- progress, workstreams, pins, worktree warnings, and tolerant ingestion remain.

Goal/deadline are authored into the project profile via the curated onboarding
step (spec 009-01, ADR-0011) and joined onto the current-state read path at the
read/render layer (`joinProjectProfileFields`), leaving the observation-v1
contract untouched. Forecast/risk derivation landed as `src/derive.mjs`
(spec 009-02, ADR-0012); the global attention queue landed in the same module
(spec 009-03, ADR-0013). `/api/data` now carries a per-project
`forecast: {state, reason}` plus a top-level `attention` ranking. **Spec 009
completes the committed local pull loop.** Scheduled daily runs and the
edge-push topology (specs 005/006) remain deferred; collection stays manual pull.

## Contract surfaces

- **Configuration:** `gauge.config.json` version 1; legacy
  `dashboard.config.json` normalizes with one actionable warning.
- **Project profile:** `schemas/project-profile-v1.schema.json`
  ([ADR-0009](decisions/adr-0009-project-shape-profile-contract.md)) — an
  optional per-project shape declaration (`artifactRoot` and `specsDir` /
  `decisionsDir` / `statusProperty` overrides) carried inline in
  `gauge.config.json` for the pull path (config-inline wins), with a
  source-owned `gauge.profile.json` reserved as the spec-006 push seam. Absent
  profile ⇒ the flat `docs/{specs,decisions}` default, byte-identical to
  pre-profile behavior. An optional `entries[]` (spec 007-02) makes one repo
  yield **N portfolio entries**: each entry (`id`, `label`, `artifactRoot` +
  overrides) expands at config normalization into a composite-id
  (`<baseId>-<entryId>`) card scoped to its own artifact root, sharing the
  umbrella repo's git signal. The profile also carries optional authored
  `goal`/`deadline` (each `{value, provenance}`; spec 009-01, ADR-0011) that the
  runtime reads as literals; an `entries[]` item may declare its **own**
  `goal`/`deadline` (spec 010-01, single-sourced from the schema `$defs` so the
  entry and top-level shapes cannot drift), falling back to the parent profile's
  value when the entry declares none — so per-track forecast/risk/attention work
  for multi-entry projects, not just single-entry ones. Profile *production* is automated by the
  read-only discovery module `src/discover.mjs` (spec 007-03): it introspects a
  source and authors a drop-in profile, preferring the source's own
  self-declaration (a `tracks/*` layout, `repos.yaml` `scope:` tags) over
  heuristic nested-root detection. The module is pure and edge-reusable
  (no central-only imports) so spec 006's edge skill can self-profile a project.
- **Normalized observations:**
  `schemas/observation-v1.schema.json`, with independently versioned typed
  capability records.
- **Local HTTP:** `/` serves the Gauge page; `/api/data` returns the canonical
  portfolio observation envelope, each project additionally carrying read-layer
  joins — the profile `goal`/`deadline` (009-01), a derived
  `forecast: {state, reason}` (009-02), and a derived `milestone: {active, next}`
  selected from the project's release-plan `## Status` (011-01, `attachMilestones`
  in `src/milestone.mjs`) — where `active` additionally carries a `specProgress`
  done/denominator rolled up from the specs its release doc references (011-02,
  reusing `progressOf`; the release workstream carries its `body` for that parse),
  and every `active`/`next` milestone carries `referencedSpecs` (the parsed parent
  spec ids that release references, 011-05) so worktrees/PRs can be joined to their
  milestone(s) — plus a per-project `velocity: {perWeek, buckets}` git commit-cadence
  read-layer join (012-02, `attachVelocity` in `src/velocity.mjs`; `null` when git
  is unavailable or the window is empty) and a per-project `tokenCost` join
  (012-03, `attachTokenCost` in `src/cost.mjs`) — total + by-model spend derived
  from Claude Code transcripts under a configurable `GAUGE_TRANSCRIPTS_ROOT`,
  deduped at per-request grain and priced via an illustrative table with an explicit
  `unknown-model` bucket; `null` when no sessions map — plus a
  `tokenCostBreakdown: {byActivity, bySkill}` detail-tier join (012-04,
  `attachCostBreakdown`) that partitions the *same* deduped record set by
  `[jig:phase=…]` activity and by `skill-usage.jsonl` skill (each with an explicit
  `unattributed` bucket; buckets sum to `tokenCost`), plus a per-project
  `team: {agentCoauthoredPct, commitCount, contributorCount}` git-derived join
  (012-05, `attachTeamSignals` in `src/team.mjs`; the agent share is a labelled
  proxy over the `Co-Authored-By: Claude` trailer, author identities never
  surfaced; `null` when no commits in the window) — that are not part of the
  observation-v1 record, plus a
  top-level `attention` array (009-03): the deterministic cross-project attention
  ranking.
- **CLI:** `npm run scan` and `npm run onboard` are read-only (`onboard`
  prints a proposed profile-v1 document to stdout, detection source/notes to
  stderr); `npm run collect` owns durable central writes.
- **Adapter inputs:** source-owned files/APIs, always read-only and explicitly
  versioned where Gauge defines an export seam.

## Security boundary

- Bind the MVP server to loopback.
- Keep credentials out of observations, logs, fixtures, and generated pages.
- Scope collection credentials read-only to selected repositories.
- Treat project names, deadlines, blockers, and history as private data.
- Hosted access requires server-side authentication and authorization.

## Open architecture decisions

See [refinement-todo.md](refinement-todo.md). Generic goal selection,
collection scheduling, forecast thresholds, attention policy, and hosted
delivery remain open behind the landed observation/history foundation.
