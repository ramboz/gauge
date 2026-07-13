---
status: Superseded
dependencies: []
last_verified: 2026-07-13
frame_review: true
---

# ADR-0004: Central observation and history contract

## Status

Accepted (2026-07-13)
Superseded by [ADR-0005](./adr-0005-symmetric-source-state-isolation.md) (2026-07-13)

## Context

Gauge must separate source-owned project state from the private portfolio
history it derives. The inherited runtime returns Jig-shaped objects directly
and its snapshot command appends Compass records inside each surveyed project.
That violates ADR-0003's central-authority boundary and gives generic projects
no honest representation.

Spec 004 needs one contract shared by the scanner, local HTTP API, browser,
collector, and future adapters. The contract must preserve provenance and
unknown/error states, remain useful without Jig, work with Node >= 18 and zero
runtime dependencies, and allow product code and private instance data to move
into separate repositories later.

## Decision Options Considered

### Option A: Keep adapter-native objects and project-local journals
- **Pros:** Smallest code change; preserves the POC payload and Compass writer.
- **Cons:** Keeps Jig as the implicit product model, distributes history across
  source repositories, and gives every new adapter a different caller contract.

### Option B: Central JSON Schema observations as immutable record files
- **Pros:** Portable, inspectable, versioned, atomically writable, and
  independent of any adapter or database. It fits the zero-dependency local
  runtime and avoids a shared append boundary.
- **Cons:** Requires explicit normalization, migration behavior, and a runtime
  validator that stays aligned with the schema artifact; large histories use
  more directory entries than one journal file.

### Option C: Store normalized rows in an embedded database
- **Pros:** Strong querying, transactions, indexes, and future retention tools.
- **Cons:** Adds a runtime dependency and migration system before the MVP has
  proven that immutable record history is insufficient.

## Recommended Decision

Choose **Option B**.

### Instance registry

The canonical configuration file is `gauge.config.json`, version 1. It names an
explicit `stateDir` plus projects with stable `id`, display `label`, source
`path`, optional workstream pins, and enabled adapters. Relative `stateDir`
values resolve from the configuration file's directory, never from a source
project. The default is `.gauge` beside the configuration file.

The legacy `dashboard.config.json` shape remains readable during spec 004. It
normalizes deterministically to version 1, derives a project id from the label
or source-directory name, enables the Jig adapter, and emits one actionable
migration warning. Derived-id collisions fail with an instruction to add
explicit ids.

Project ids are lowercase filesystem-safe slugs matching
`^[a-z0-9][a-z0-9-]{0,63}$`. Legacy derivation lowercases text, replaces every
non-alphanumeric run with one hyphen, and trims hyphens; an empty result,
invalid explicit id, or duplicate id is a configuration error. Before any
write, Gauge resolves the state root and destination canonically, proves the
destination remains beneath the state root, and refuses a `stateDir` located
inside any configured source project. These checks are part of the no-source-
write invariant, not caller hygiene.

### Observation v1

`schemas/observation-v1.schema.json` is the canonical artifact for the internal
data shape. Each observation contains:

- `schemaVersion: 1`;
- `recordId`: a unique identifier generated with Node's built-in
  `crypto.randomUUID()`;
- `project`: stable `id`, display `label`, and source `path`;
- `collectedAt`: an ISO-8601 timestamp;
- `collection`: a conservative `ok`, `partial`, or `error` envelope summary;
- `provenance`: source revision when available plus each attempted adapter;
  every adapter records its own `ok`, `unsupported`, or `error` status,
  collection time, source timestamp/revision, and `fresh`, `stale`, `unknown`,
  or `error` freshness with a reason when it is not fresh;
- `signals`: an additive array of source-neutral, independently versioned
  capability records. Each record has `type`, `version`, `supported`,
  `unsupported`, `unknown`, or `error` status, candidate contributors and
  resolution policy, signal-level freshness/provenance, and a typed value when
  supported;
- `extensions`: optional adapter-namespaced details that callers must not need
  for the shared project card;
- `errors`: structured collection errors, never silently coerced to empty or
  healthy values.

Unknown properties are allowed for additive evolution. Readers reject an
unknown `schemaVersion`; a breaking shape change increments the version and
ships an explicit reader migration. Runtime validation and tests must exercise
the same required fields and enums as the schema without adding a production
dependency.

The observation envelope and each capability evolve independently. Adding a
new capability type is additive and does not increment the observation
`schemaVersion`; a breaking change to a capability increments only that
record's `version`. Readers ignore unknown capability types for presentation
while preserving them in stored observations. Spec 004 defines
`repository@1`, `execution@1`, `workstreams@1`, `hygiene@1`, and `narrative@1`.
The generic milestone adapter will define `goal@1` in its own spec against
probed GitHub evidence, without changing this top-level contract.

There is no cross-adapter “best timestamp.” Consumers use the freshness and
provenance of the adapter that produced each signal. The envelope summary is
`error` only when no usable observation can be produced, `partial` when any
enabled adapter is stale/unknown/error/unsupported, and `ok` only when every
enabled contributing adapter is fresh. It is an operational collection summary,
not evidence for progress, deadline, or risk derivation.

Goal and execution capabilities are deliberately orthogonal. A project-owned
milestone adapter can add a goal record while Jig supplies an execution record
at the same time; forecast consumers join those signals without transferring
freshness or authority between them. The Jig adapter maps specs into
`execution@1` using the named `jig-specs` strategy,
including progress units and status-bearing items; maps release/runbook rows
into `workstreams`; maps worktree-only documents into `hygiene`; and maps legacy
Compass input into `narrative`. A non-Jig project still produces the same
observation and repository signal while the other v1 capabilities report
`unsupported` or `unknown`. The local API and shared card consume these
canonical signals, not `extensions.jig`. This is the proof that the envelope
normalizes semantics rather than merely wrapping a Jig payload.

Adapters produce candidates; adapter iteration order never resolves a signal.
For exclusive/scalar capability types such as goal or execution, the resolved signal
records all candidates plus one `selected` candidate and the policy reason. A
project may configure `signalPolicies.<capability>` with an adapter id or named
strategy. With exactly one supported candidate Gauge selects it; with multiple
supported candidates and no explicit policy Gauge reports the signal as
`unknown` with `ambiguous-signal-source`. For merge-safe collections such as
`workstreams` and `hygiene`, Gauge retains contributor identity on every entry
and sorts deterministically by adapter id plus stable entry id. It never adds
unlike units or drops contributor provenance. This defers product-specific
precedence while making multi-adapter behavior deterministic and explainable.

### Central history

The collector writes one validated observation to
`<stateDir>/observations/<project-id>/<timestamp>-<record-id>.json`, creating
only directories beneath `stateDir`. The filename timestamp is UTC and
filesystem-safe; history order is `collectedAt`, then `recordId`. Normal scans
may return observations without persisting them; the explicit collector owns
durable writes. Gauge never writes to a configured source path. The collector
performs the id, containment, and source-overlap checks before creating the
state directory or opening a record file.

Each record is first created exclusively as a temporary sibling, fully written
and fsynced, then committed with a same-directory hard link to the final unique
filename. Link creation is atomic and no-replace: `EEXIST` never overwrites
history. The directory is fsynced after the link and the temporary name is then
removed. Readers ignore temporary siblings and validate every committed `.json`
record. An invalid committed record is a structured history error, never
silently treated as absent. Concurrent collectors use different record ids and
never append to or replace a shared file.

Gauge does not claim this protocol works on every Node-supported filesystem.
Before its first durable write, the collector runs the same-directory
capability probe beneath `stateDir`: exclusive temporary create, file fsync,
no-replace hard link (including an expected `EEXIST` collision), directory
fsync, read-back, and cleanup. Any unsupported operation returns an explicit
`unsupported-state-filesystem` environment error before collection. There is no
rename-over-existing fallback and no claim for network/object-backed mounts
that fail the probe. The guarantee is bounded to atomic visibility and the
filesystem's acknowledged fsync contract; device loss beyond that contract is
outside the local MVP.

An executed 2026-07-13 probe on the current `darwin` local temporary filesystem
passed same-directory hard-link creation, no-replace collision behavior,
directory fsync, and byte-for-byte read-back using only Node built-ins. The
collector test suite repeats the protocol in its temporary state root.

History is immutable in v1. There is no automatic pruning in the MVP; a later
retention decision may compact or archive records without changing source
authority. The POC `docs/status/compass-history.jsonl` file is an optional
read-only Jig-adapter input and is never a Gauge write target.

### Non-Jig compatibility probe

On 2026-07-13 an executed Node probe mapped GitHub's documented milestone
example into the envelope without adding top-level fields. The official REST
shape supplies `node_id`, `number`, `state`, `title`, `open_issues`,
`closed_issues`, `updated_at`, and `due_on` ([GitHub REST milestone
documentation](https://docs.github.com/en/rest/issues/milestones?apiVersion=2022-11-28)).
The probe produced `goal@1` with the milestone `node_id` as source identity,
`updated_at` as source freshness time, `due_on` as the deadline, and issue
counts as an explicitly unit-labelled progress value. The observation retained
project identity, collection state, adapter provenance, candidate resolution,
and errors in the existing envelope; the assertion confirmed no top-level
`goal` field was required.

This proves compatibility with one required non-Jig source shape, not the
milestone-selection policy. Selecting which active milestone is the project
goal remains the generic-adapter decision in `docs/refinement-todo.md`.

## Consequences

**Becomes easier:**
- Supporting generic and future adapter sources through one caller contract.
- Moving private instance state away from product code without rewriting
  adapters or the UI.
- Auditing collection provenance, failures, and schema evolution.

**Becomes harder:**
- Schema and runtime-validator changes must be kept in lockstep.
- File-history queries and retention are deliberately primitive until real
  usage justifies an index or database.
- Legacy configuration needs a visible migration path until it is retired.
- Durable collection is unavailable on filesystems that fail the explicit
  capability probe; scans remain read-only and usable there.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- **A1 — filesystem crash persistence:** the private local state filesystem is
  assumed to honor its documented file and directory fsync semantics across an
  operating-system crash. The functional capability probe can prove supported
  calls, no-replace behavior, atomic visibility, and immediate read-back; it
  cannot simulate power loss or prove a device's persistence implementation.
  Gauge therefore promises no torn/overwritten record after a successful
  process-level commit and persistence through normal restarts, but makes no
  stronger power-loss guarantee than the underlying filesystem contract.

The repository/runtime shape and zero-dependency constraint were otherwise
verified from the current checkout, and the additive capability envelope was
exercised against GitHub's documented milestone response as described above.

## Kill criteria

_What would make this decision wrong? List the conditions that, if observed,
should reverse or shelve it. Risk-gated like Assumptions — write "None" or omit
when there is no meaningful kill condition; do not invent ceremonial ones._

- Real use demonstrates that atomic multi-project transactions or indexed
  historical queries are required within the MVP appetite; in that case write a
  superseding storage ADR rather than stretching immutable files into a database.
- A second non-Jig adapter needs provenance, error, or resolution semantics that
  cannot be expressed as another versioned capability record without changing
  top-level envelope fields; in that case supersede this ADR before shipping it.
- The supported local filesystem loses or tears a record after the collector
  successfully completes its probed commit protocol under normal restart/crash
  testing; in that case stop claiming durable history and supersede the storage
  decision with a database or journal that can meet the required guarantee.

## Open questions

None. Retention duration, goal-source precedence, forecasting, and scheduled
execution remain separately triggered decisions in `docs/refinement-todo.md`.
