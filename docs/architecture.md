> Status: Active target architecture (reframed 2026-07-13 by
> [ADR-0003](decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)).
>
> The shipped POC is being retrofitted through
> [spec 004](specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md).

# Architecture: Gauge

## Architectural stance

Gauge is a local-first portfolio observer with an adapter boundary. Source
projects are read-only systems of record; Gauge owns only its private instance
configuration, observations, history, and derived portfolio views.

ADR-0001 currently fixes the MVP runtime at Node >= 18, ES modules, built-in
tests, and zero runtime dependencies. ADR-0003 fixes the product and authority
boundary. The normalized observation schema remains a required follow-up ADR,
so this document names responsibilities without pre-deciding its fields.

## Repository structure

```text
gauge/
├── src/                         # current scanner/server; target core + adapters
├── public/                      # local single-page dashboard
├── scripts/                     # POC utilities and future collection entrypoints
├── test/                        # unit/integration tests and synthetic project trees
├── docs/decisions/              # architectural authority
├── docs/specs/                  # Jig implementation lifecycle
├── docs/releases/               # Shaper release boundaries
├── dashboard.config.example.json# current POC configuration example
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

### Source adapters

Translate source evidence into normalized observations. Planned adapters are:

- generic GitHub milestone/metadata for goals and due dates;
- Jig for specs, bugs, decisions, blockers, and eligible work;
- Shaper for release scope, cutline, risks, and readiness;
- Servo for evaluation suitability, gate/regression state, and freshness.

Adapters are optional and degrade to explicit unsupported/unknown signals. An
adapter cannot mutate its source or redefine another adapter's semantics.

### Observation/history contract

A versioned contract will carry source identity, provenance, collection time,
freshness/error state, and typed signals. Schema evolution and retention require
an ADR before spec 004 implementation. The superseded project-local Compass
JSONL file may be read only as a temporary legacy input.

### Derivation engine

Computes progress strategies, observed pace, deadline confidence, categorical
risk, and attention ordering. Policies are deterministic, independently
testable, and explain their evidence. Missing dates or insufficient history
cannot yield `on_track` or `at_risk`.

### Delivery

The MVP is an HTTP server bound to loopback plus one local page. Authenticated
hosting is a separate release and trust boundary; it must protect both rendered
HTML and underlying data.

## Current POC bridge

The shipped code still scans configured local Jig roots directly, reads
project-local Compass history, and rescans on browser refresh. During spec 004:

- direct Jig reads move behind the Jig adapter;
- generic projects become valid Gauge projects;
- observations/history move beneath the instance-state boundary;
- the source-repository snapshot writer is removed, disabled, or converted to
  an instance writer;
- useful progress, workstream, warning, and tolerant-ingestion behavior stays.

## Contract surfaces

- **Configuration:** current `dashboard.config.json`; replacement/migration
  behavior belongs to spec 004.
- **Normalized observations:** ADR required before implementation.
- **Local HTTP:** `/` and `/api/data` are inherited POC surfaces; spec 004 may
  evolve their payload while preserving one actionable migration path.
- **Adapter inputs:** source-owned files/APIs, always read-only and explicitly
  versioned where Gauge defines an export seam.

## Security boundary

- Bind the MVP server to loopback.
- Keep credentials out of observations, logs, fixtures, and generated pages.
- Scope collection credentials read-only to selected repositories.
- Treat project names, deadlines, blockers, and history as private data.
- Hosted access requires server-side authentication and authorization.

## Open architecture decisions

See [refinement-todo.md](refinement-todo.md). The normalized observation and
central history contract is the next blocking decision; adapter precedence,
collection scheduling, forecast thresholds, and hosted delivery follow behind
it.
