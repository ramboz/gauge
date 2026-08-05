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
  attention ordering that ranks them. It is not built yet; it lands in a
  dedicated module (`src/derive.mjs`, or `src/derive/` if it grows) that imports
  only the history reader and observation-contract helpers, never adapters or
  `src/scan.mjs`, and never writes to a source or to instance state.

Policies are deterministic, independently testable, and explain their evidence.
Missing dates or insufficient history cannot yield `on_track` or `at_risk`, and
the `collection.status` envelope is never derivation evidence.

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
contract untouched. Scheduled daily runs, forecast/risk derivation, and the
global attention queue remain later spec-009 slices; collection stays manual pull.

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
  runtime reads as literals. Profile *production* is automated by the
  read-only discovery module `src/discover.mjs` (spec 007-03): it introspects a
  source and authors a drop-in profile, preferring the source's own
  self-declaration (a `tracks/*` layout, `repos.yaml` `scope:` tags) over
  heuristic nested-root detection. The module is pure and edge-reusable
  (no central-only imports) so spec 006's edge skill can self-profile a project.
- **Normalized observations:**
  `schemas/observation-v1.schema.json`, with independently versioned typed
  capability records.
- **Local HTTP:** `/` serves the Gauge page; `/api/data` returns the canonical
  portfolio observation envelope.
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
