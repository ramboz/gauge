# Glossary

> Status: Draft (wizard-generated)
>
> Domain terms and project-specific vocabulary for Gauge. Loaded on demand
> when the hot cache (CLAUDE.md) misses. Update via `/jig:memory-sync` or when
> `jig-memory-scan` surfaces an unknown reference.
>
> When `jig-memory-scan` flags an unrecognized capitalized reference, the user
> provides the definition once and `memory-sync` writes it here. High-frequency
> terms (referenced ≥3 times in a session) are promoted to the CLAUDE.md hot cache.

<!-- Terms below, alphabetical. Format: ## TERM, followed by definition prose. -->

## Adapter

An optional, read-only translator from a project-owned source such as GitHub,
Jig, Shaper, or Servo into Gauge's normalized observation contract. Gauge must
remain useful when any particular adapter is absent.

## Attention queue

Gauge's explained cross-project ordering of what deserves attention next. It
may use blockers, human-required actions, active work, deadlines, and a small
portfolio overlay, but it never rewrites project-local priority.

## Candidate resolution

The deterministic rule that turns adapter candidates into one signal: select
one unambiguous candidate, merge compatible merge-safe candidates with
contributor identity, or remain unknown with an explicit reason.

## Capability signal

An independently versioned, typed observation record such as `repository@1` or
`execution@1`. Adapters contribute candidates; readers consume only
type/version pairs they understand, and unknown types or versions remain
preserved but uninterpreted.

## Forecast confidence

The evidence level supporting a deadline-risk classification. Missing dates,
stale evidence, or insufficient history produce `unknown`, not `on_track` or
`at_risk`.

## Gauge

The central, private cross-project delivery dashboard defined by ADR-0003. It
owns portfolio observations and recommendations while source projects retain
their goals, deadlines, priorities, and lifecycle state.

## Instance state

Gauge-owned private data: project registry, adapter configuration, daily
observations, retained history, and optional portfolio-priority overlay. Its
location is explicit and independent from every surveyed source repository.

## Observation

A versioned, provenance-bearing record of one project's source evidence at a
point in time. Observation v1 contains a stable record/project identity,
collection summary, adapter provenance, typed independently versioned
capability signals with candidates and resolution evidence, extensions, and
structured errors. Immutable records live only in Gauge instance state.

## Progress strategy

A named deterministic rule for deriving progress from one source's semantics.
Strategies stay source-aware rather than collapsing unrelated units into a
single opaque percentage.

## Source project

A repository Gauge observes without modifying. It remains authoritative for
its own goal, deadline, local priority, and engineering or release lifecycle.

## Project profile
A versioned, optional per-project shape declaration (schemas/project-profile-v1.schema.json, ADR-0009) telling the Jig adapter where a source's jig artifacts live and how to read them: artifactRoot (default 'docs') plus specsDir/decisionsDir/statusProperty overrides. Carried inline in gauge.config.json for the pull path (config-inline wins over a source-owned gauge.profile.json, which is the spec-006 push seam). Absent profile = the flat docs/{specs,decisions} default, byte-identical to pre-profile behavior. Landed by spec 007-01; entries[] (one repo to N portfolio entries) is reserved for 007-02.
