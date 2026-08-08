---
status: Accepted
dependencies: [adr-0003, adr-0005]
last_verified: 2026-08-02
frame_review: true
---

# ADR-0006: Single instance, two-layer derivation (current-state and history-derived)

## Status

Accepted (2026-08-02)

## Context

ADR-0003 places both per-project status/progress reporting and cross-project
analytics (observed pace, deadline confidence, categorical risk, attention
ranking) on Gauge's side of the authority boundary. A design question arose
whether these are two products that belong in separate Gauge instances or
repositories, and whether keeping them together risks conflating status code with
analytics code.

Verified from the current checkout (2026-08-02):

- The shipped runtime is entirely shared substrate: `src/config.mjs`,
  `src/scan.mjs` (Jig adapter), `src/observation.mjs` (normalized observation
  core), `src/state.mjs` (central history), and `schemas/observation-v1.schema.json`.
  There is no analytics or derivation code; a search of `src/` for
  `forecast|risk|deadline|attention|trend|velocity` returns nothing.
- `readObservationHistory()` exists in `src/state.mjs` and returns a project's
  observation series sorted by `collectedAt`, but no runtime caller consumes it.
  `src/server.mjs` and `src/cli.mjs` read only the live `observeAll`.
- Status/progress reporting is exactly the latest observation
  (`execution.progress`, `narrative.blockers`, per-signal `freshness`, the
  `collection.status` envelope) rendered by `public/index.html`.
- Analytics is a fold over the observation history that does not yet exist.

The committed MVP is single-user, local, and single-repository-per-project (see
[local-portfolio-loop](../releases/local-portfolio-loop.md)). Both concerns
already depend on the same adapter → observation → history pipeline fixed by
ADR-0004 and ADR-0005.

## Decision Options Considered

### Option A: Two separate instances/projects (status vs. analytics)
- **Pros:** A hard boundary between current-state reporting and historical
  analysis; each could ship and version independently.
- **Cons:** Both concerns consume identical inputs—adapters, the normalized
  observation contract and its validator, freshness/provenance, and the single
  history store. A split either duplicates `config.mjs`, `scan.mjs`,
  `observation.mjs`, `state.mjs`, and the schema wholesale (two copies of the
  observation contract that will drift), or makes the analytics project depend on
  the status project as a library—re-creating the same seam as a package boundary
  with release and versioning overhead and no isolation benefit inside a
  single-user local trust boundary.

### Option B: One instance, two internal read layers over the shared substrate
- **Pros:** One collection pipeline, one observation contract, one history store,
  no duplication. The two concerns differ only at the read: current-state reads
  the latest observation; analytics folds the history. A clean, independently
  testable module seam that stays extractable later if the boundary ever needs to
  become a process boundary.
- **Cons:** Status and analytics live in one codebase, so the seam is an import
  rule enforced by review rather than a repository wall; it must be stated and
  checked, not guaranteed by separation.

### Option C: Status-only, leave the seam undefined
- **Pros:** Least to decide now; the shipped current-state viewer is untouched.
- **Cons:** The first forecast/risk/attention slice would wire history-derived
  logic ad hoc, with no agreed home or import rule—the exact conflation the
  question raised, deferred rather than answered.

## Recommended Decision

Choose **Option B**. Gauge remains a single instance. Status/progress and
analytics are two *read layers* over the shared adapter → observation → history
substrate, separated by time, not two products.

### Current-state layer

Reads only the latest observation for each project and renders the project card.
This is the shipped path: `observeAll` in `src/observation.mjs`, consumed by
`src/server.mjs` / `src/cli.mjs` and `public/index.html`. It never reads history.

### History-derived layer

Reads the observation series through `readObservationHistory()` (`src/state.mjs`)
and folds it into derived signals—observed pace, deadline confidence, categorical
risk, forecast—plus the cross-project attention ordering that ranks them. This
layer does not exist yet; it is the home for the derivation-engine
responsibilities named in [architecture.md](../architecture.md).

The future analytics code lands in a dedicated module—`src/derive.mjs`, or a
`src/derive/` directory if it grows—that imports **only** the history reader (and
the observation-contract helpers it needs to interpret records) from
`src/observation.mjs` / `src/state.mjs`. It must not import adapters or
`src/scan.mjs`, and it never writes to a source repository or to instance state.
Its only *observation* input is `readObservationHistory()`, which is per-project
(`stateDir`, `projectId`); the cross-project ranking additionally takes the
project-id set from the registry, passed in by its caller rather than read
directly. Restricting the layer to those inbound dependencies is what keeps it
independently testable and cheaply extractable into a separate process later
without touching collection.

The global attention queue belongs in the history-derived layer, downstream of
forecast/risk, because it consumes those outputs. It is not part of the
current-state read path even though it answers "what deserves attention next."

This ADR reaffirms the observation contract's rule (ADR-0004, retained by
ADR-0005) that the `collection.status` envelope (`ok` / `partial` / `error`) is
an operational collection summary and is never evidence for progress, deadline,
or risk derivation. The history-derived layer derives from capability signals and
their freshness/provenance, not from the envelope status.

This decision fixes the architectural home and import boundary for analytics. It
does not resolve the analytics policies themselves—minimum evidence for a
forecast, the shape of the attention overlay, and collection scheduling remain
open in [refinement-todo.md](../refinement-todo.md) behind their existing
resolution triggers, and each is settled in its own slice depending on this ADR.

## Consequences

**Becomes easier:**
- Building forecast/risk/attention as a single-input fold over history without
  touching adapters, the observation contract, or the collector.
- Keeping the observation contract single-sourced; there is no second copy to
  drift.
- Extracting analytics into its own process later, since its only inbound
  dependency is `readObservationHistory()`.

**Becomes harder:**
- The status/analytics boundary is an enforced import rule inside one codebase,
  not a repository wall; reviews must catch a derivation module that reaches into
  adapters or `src/scan.mjs`.
- A future genuine need for two independently deployed instances requires the
  extraction this ADR keeps cheap but does not perform.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- **A1 — Single instance sufficient:** the committed MVP is single-user, local,
  and single-repository-per-project (local-portfolio-loop), so one Gauge instance
  serves both read layers. The shared-substrate claim and the unconsumed
  `readObservationHistory()` claim were verified from the current checkout on
  2026-08-02 by searching `src/` for derivation terms (no matches) and by
  confirming `readObservationHistory()` in `src/state.mjs` has no runtime caller
  in `src/server.mjs` or `src/cli.mjs`.

## Kill criteria

_What would make this decision wrong? List the conditions that, if observed,
should reverse or shelve it. Risk-gated like Assumptions — write "None" or omit
when there is no meaningful kill condition; do not invent ceremonial ones._

- Real MVP use shows analytics and status genuinely need independent deployment,
  retention, or trust boundaries within the MVP appetite; in that case perform the
  extraction the derivation-module import rule keeps cheap, rather than duplicating
  the observation/history substrate.
- History-derived analytics does not earn its central-history cost (ADR-0003's own
  kill criterion); in that case retain the current-state layer and shelve the
  history-derived layer without touching collection or reintroducing source writes.

## Open questions

None new. The analytics policy decisions—forecast confidence, cross-project
attention overlay, and daily-collection scheduling—remain separately triggered in
`docs/refinement-todo.md`; this ADR fixes their architectural home, not their
policies.

## Amendments

- **2026-08-07 ([ADR-0017](adr-0017-reframe-onto-manager-lens.md)):** the
  two-layer architecture stands, but the **source of the history series** the
  history-derived layer folds over is refined. It is not only
  forward-accumulated snapshots: the series can be **reconstructed from git**
  (each spec's status transition is timestamped — the "insufficient-history"
  gate is a *code* limit, not a data one) and, going forward, is **captured
  event-driven** by the thin client on session-stop rather than by scheduled
  pull. The parked "daily-collection scheduling" open item above is reframed to
  that event-driven capture model (see `docs/refinement-todo.md`). Gauge remains
  read-only; it derives over reconstructed + captured history.
