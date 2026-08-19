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

### ~~Generic goal and deadline source~~ — RESOLVED 2026-08-05

**Decision needed:** whether the first generic adapter uses one active GitHub
milestone, repository configuration, or both with explicit precedence.

**Resolution trigger:** before drafting the generic goal-adapter slice.
**Resolved by:** [ADR-0011: Goal and deadline source strategy for the local pull loop](decisions/adr-0011-goal-deadline-source-strategy.md).

## MVP derivation policy

### Progress strategies

**Decision needed:** which sourced completion strategies are supported in the
two-week MVP and how each reports unsupported or unknown work.

**Resolution trigger:** after probing three real projects and before drafting
the progress/risk slice.

### ~~Forecast confidence~~ — RESOLVED 2026-08-05

**Decision needed:** minimum date/history evidence required for `on_track` or
`at_risk`; below it the only valid result is `unknown`.

**Resolution trigger:** after enough central observations exist to test a rule
against the three-project validation set.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md); this item resolves the
policy, not the placement.
**Resolved by:** [ADR-0012: Forecast confidence: minimum-evidence rule for on_track/at_risk vs unknown](decisions/adr-0012-forecast-confidence-minimum-evidence.md).

### Dedicated `no-measurable-scope` forecast reason (from 009-02)

**Decision needed:** whether to add a dedicated forecast reason for the
all-abandoned / zero-denominator case. Slice 009-02 correctly routes a project
whose delivery scope is entirely abandoned (`denom === 0`, `done === 0`, execution
status still `supported`) to `unknown` — but reuses the existing `execution-unknown`
reason as a stopgap, since
[ADR-0012](decisions/adr-0012-forecast-confidence-minimum-evidence.md) did not
anticipate `denom === 0` under a `supported` status. A dedicated
`no-measurable-scope` reason would be more honest on the card and in the attention
queue (its tier mapping in
[ADR-0013](decisions/adr-0013-attention-overlay-policy.md) would need to be set).
Adding a reason is decision-content → an amending/superseding ADR-0012 revision, not
an inline tweak.

**Resolution trigger:** when the all-abandoned case appears in the real corpus, or
when ADR-0012's reason set is next revised.

### ~~Cross-project attention overlay~~ — RESOLVED 2026-08-05

**Decision needed:** smallest central policy that expresses portfolio intent
without duplicating project-local priorities—ordered projects, coarse tiers, or
deadline-plus-attention rules.

**Resolution trigger:** before implementing the global attention queue.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md), downstream of
forecast/risk; this item resolves the policy, not the placement.
**Resolved by:** [ADR-0013: Cross-project attention-overlay policy for the global queue](decisions/adr-0013-attention-overlay-policy.md).

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

**Reframed 2026-08-07 ([ADR-0017](decisions/adr-0017-reframe-onto-manager-lens.md)):**
the concrete answer is **event-driven capture, owned by the thin client** — a
Claude Code `Stop`/`SessionEnd` hook writes a snapshot per session end (no
scheduler, no central runner, derive-never-ask). "Central collection" becomes
aggregation of those captures; see
[thin-client-and-central-collection](releases/thin-client-and-central-collection.md)
(2026-08-28). The "local scheduler vs GitHub Actions vs central runner" framing
above is superseded by the session-stop model.

### Freshness misses branch / worktree / uncommitted work (from spec 009 corpus run)

**Decision needed:** whether `gitFreshness` should reflect activity beyond the
observed branch's HEAD commit. Today freshness = last **commit date** of the
checked-out HEAD at the project `path` (`src/observation.mjs`, `STALE_AFTER_DAYS=14`).
That makes three real kinds of recent work invisible: (a) commits on an **unmerged
feature branch**, (b) commits in a **linked worktree** (both common — it made
gauge's own `main` read stale all through spec 009's development), and (c) ADRs/specs
**written but not committed** (mtime moves, commit date does not). Observed against
the real corpus: servo read `stale` correctly (nothing newer than 24 days anywhere),
but a project mid-branch-work would misreport. ADR-0012/0013 already frame freshness
as "observed-branch quiet, a proxy" — this item asks whether the proxy should widen
(e.g. max over branches/worktrees, or an mtime signal) or stay deliberately
mainline-only.

**Resolution trigger:** when a corpus project's genuinely-recent work sits on a
branch/worktree and the stale reading misleads.

### ~~First-run board is all-`unknown`~~ — RESOLVED 2026-08-18 (first-run hint shipped)

**Decision needed:** whether to add a first-run affordance. Forecast colours
(`on_track`/`at_risk`) require ≥2 observations spanning ≥1 day (ADR-0012), so a
brand-new instance's first collection yields an all-`unknown` board — honest, but
sparse and potentially underwhelming. Candidate: a dashboard hint like "collect
daily to unlock forecasts", or surfacing observation-count/next-useful-collection
per project. Pure presentation; changes no derivation.

**Reframed 2026-08-07 ([ADR-0017](decisions/adr-0017-reframe-onto-manager-lens.md)):**
the cold-start is no longer "collect daily and wait." The full `progress(t)`
series already exists in git, so a one-time **git-backfill seed** reconstructs
history and the forecast can light up on day one — the "history gate" is a code
limitation, not a data one. The remaining question narrows to whether to ship
the git-backfill seed and/or a first-run hint; it is no longer premised on
accrual.

**Resolution trigger:** before onboarding a new user, or with the next dashboard
polish pass.

**Resolved 2026-08-18 — both halves now shipped.** The git-backfill seed landed as
slice 013-01 (`src/backfill.mjs`, `npm run backfill`); the remaining first-run hint
ships here as a board-level affordance in `public/index.html` (`firstRunHint`). It
keys strictly on the *remediable* gray reason — `insufficient-history` (deriveForecast
Gate 3/4) — and points at `npm run backfill`, the ADR-0017 remedy; it is deliberately
NOT shown for `deadline-unknown` / `execution-unknown` / `stale-evidence`, which
backfill would not resolve. Pure presentation (no derivation change) and
self-clearing once history is seeded. Verified against the real corpus: 5 of 9
projects hinted, the 2 stale-evidence and 2 execution-unknown cards correctly
excluded.

### Cost trend durability: persist cost into snapshots when transcripts rotate (from spec 014-03)

**Decision needed:** whether to persist the per-observation cost figure into each
snapshot going forward, so a project's cost **trend** survives the underlying
Claude Code transcripts being rotated/deleted. Spec 014-03 ships both the velocity
and cost trends by **recompute** (owner decision 2026-08-18): velocity from
`git log` (durable — never persisted), cost from timestamped transcripts
(`src/cost.mjs`). Velocity needs no persistence ever. Cost recompute is honest
**while transcripts survive**; once they age out of `GAUGE_TRANSCRIPTS_ROOT` the
historical cost trend loses its source. The fix is additive: the SessionEnd
capture (014-01) also embeds the computed cost in the snapshot, and the read layer
**prefers a persisted value, falls back to recompute**. This amends the
observation-v1 contract → **load-bearing, requires an ADR** before the schema
changes.

**Resolution trigger:** when transcripts begin aging out such that a cost trend
reads `unknown` over a window that was real, or when the owner pulls cost
durability into a committed release. (Deferred on leanness grounds — YAGNI until
transcript rotation actually threatens the recompute source.)

### Stale active-session marker GC (from spec 014-04 arch review)

**Decision needed:** whether to reap orphaned active-session markers. A crashed
session never fires `SessionEnd`, so its marker lingers in
`<stateDir>/active-sessions/` indefinitely; the read layer `readdir`+`readFile`+
`stat`s every marker on each `/api/data` request. Correctness is unaffected (a
stale transcript mtime → `runningNow: false`), but nothing reaps stale markers or
bounds the per-request scan. Candidate: the read layer (or the SessionStart hook)
deletes markers whose transcript mtime is far past `RUNNING_STALE_AFTER_MS`.

**Resolution trigger:** when session volume grows beyond the single-user MVP such
that the unbounded `active-sessions/` scan is a measurable cost, or before hosted
multi-user. (Deferred on leanness grounds — correct + cheap at MVP scale.)

### Shared hook-scaffold helper (from spec 014-04 craft review)

**Decision needed:** extract the hook boilerplate. `readStdin` is byte-identical
and `diagnostic`/entrypoint (`run().finally(exit 0)`) differ only by a label
across `scripts/session-stop-hook.mjs` and `scripts/session-start-hook.mjs` — now
at ADR-0002's inline-mirror budget. A shared `src/hook-io.mjs` (`readStdin`,
`makeDiagnostic(prefix)`, a `runHook(fn)` runner) would collapse it.

**Resolution trigger:** before a **4th** hook script is added (the ADR-0002
extract-on-third-caller line; two hooks is within the inline-mirror budget today).

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

### ~~Convention discovery and multi-entry decomposition for non-flat projects~~ — RESOLVED 2026-08-03 (spec 007 complete)

**RESOLVED (spec 007, all slices DONE):** shaped as
[spec 007](specs/007-project-shape-profiles/spec.md) with the contract pinned by
[ADR-0009](decisions/adr-0009-project-shape-profile-contract.md). Slice **007-01**
landed the single-entry **artifact-root** half (`project-profile-v1`;
`artifactRoot` + `specsDir`/`decisionsDir`/`statusProperty`), unblocking PATTERN B
(mystique `docs/opportunities/cwv`); slice **007-02** landed **multi-entry**
decomposition (`entries[]` → one repo yields N composite-id cards sharing the
umbrella git signal), unblocking PATTERN C (personalization-workspace's three
tracks); slice **007-03** landed **discovery/onboarding** (`src/discover.mjs` +
`npm run onboard`) — a read-only introspection that authors a drop-in profile,
preferring a source's self-declaration (`tracks/*` layout, `repos.yaml` `scope:`
tags) over heuristic nested-root detection, so PATTERN B/C projects are configured
without hand-writing artifact roots. Verified read-only against the real corpus:
mystique → `[docs/opportunities/cwv, docs/superpowers]`; personalization-workspace
→ the three tracks in repos.yaml scope order.

**Follow-ups (carried, non-blocking):**

- **Per-entry pin scoping (from 007-02).** An umbrella project's
  `pinnedWorkstreams` propagate to *every* expanded entry, and pins resolve
  repo-root-relative (not per-`artifactRoot`), so a pinned umbrella doc surfaces
  on all N track cards. No corpus project pins today; per-entry pin scoping (or
  suppressing umbrella pins on multi-entry expansion) is a small follow-up.
- **Extract `safeProjectId` → `src/ids.mjs` before spec 006 edge reuse (from
  007-03 arch pass).** `src/discover.mjs` is pure/edge-reusable and imports no
  central-only module, but pulls `safeProjectId` from `config.mjs`, transitively
  loading config normalization + `profile.mjs`'s schema read. Extracting the pure
  id util into a tiny `src/ids.mjs` (re-exported from `config.mjs` for
  back-compat) makes the edge footprint minimal. **Resolution trigger:** before
  [spec 006](specs/006-edge-collection-client/spec.md)'s edge skill imports
  `discover.mjs`.
- **repos.yaml block-list `scope:` form (from 007-03).** The zero-dependency
  (ADR-0001) line scanner in `discover.mjs` recognizes scalar and inline-list
  `scope:` forms but not the YAML block-list form (`scope:` then `- tag` lines);
  such tracks fall back to directory-sort order. **Resolution trigger:** when a
  real corpus project declares scopes in block-list form.
- **Multi-entry goal/deadline placement (from 009-01 craft review).** A profile
  declaring both `entries[]` and top-level `goal`/`deadline` validates, but
  `expandEntries` (`src/config.mjs`) builds each entry from only the five scalar
  fields, so an umbrella-level `goal`/`deadline` is silently dropped. Single-entry
  is spec 009's scope; decide reject-vs-thread (reject goal/deadline alongside
  `entries`, or thread them per entry) before onboarding a multi-entry PATTERN C
  project with a goal. **Resolution trigger:** before a multi-entry project sets a
  goal/deadline.

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

### Structured carrier for the status-absent document count (from spec 008-01)

**Decision needed:** how the status-absent document count reaches the delivery
layer as data. Slice 008-01 reports honest `unknown` completion for a root with no
recognized delivery status and surfaces the count, but `normalizeContribution`
(`src/observation.mjs`) strips `value` from every non-`supported` signal, so the
count currently rides in the freshness/resolution reason string
(`no-recognized-delivery-status-<N>-documents`). All three 008-01 review passes
(compliance/craft/arch) flagged this stringly-typed carrier as the weakest seam.
The dashboard card (`public/index.html`) consequently does **not** yet render the
literal "N documents · completion unknown" — it renders "Execution signal
unknown." — because consuming the count today means regex-parsing a diagnostic
string.

**Options:** (a) permit a typed field (e.g. `documentCount`) on an `unknown`
execution signal that survives `normalizeContribution` — an additive change to the
observation contract (ADR-0005 territory, likely an ADR); (b) a dedicated
`unknownStatus`/insufficient-evidence signal shape. Whichever lands, wire
`public/index.html` to render the count **from the structured field** in the same
change, so the render layer never parses a reason string.

**Resolution trigger:** before the dashboard is changed to render the "N
documents" count, or when any second consumer needs the count structurally —
whichever comes first.
