---
status: Proposed
dependencies: [adr-0001, adr-0003, adr-0005, adr-0006]
last_verified: 2026-08-02
frame_review: true
---

# ADR-0007: Invert collection from central pull to edge push for the team tier

## Status

Proposed (2026-08-02)

This ADR is a forward-looking frame decision for the team/organization tier named
as a long-term direction in [product-vision.md](../product-vision.md). It does not
change the committed local MVP ([local-portfolio-loop](../releases/local-portfolio-loop.md)),
which stays central-pull and single-user. It is recorded now so the team-tier
evolution is shaped against the observation contract rather than improvised later.

## Context

The shipped runtime collects by **central pull**. Verified from the current
checkout (2026-08-02): `scripts/snapshot.mjs` loads the registry, iterates
configured projects, and for each calls `observeProject` (`src/observation.mjs`,
which runs adapters) then `collectObservation` (`src/state.mjs`, which writes the
immutable record beneath `stateDir`). A single central runner reaches *into* every
source repository, reads it read-only, and writes the normalized observation into
central instance state. `architecture.md` states the invariant plainly:
"Collection stops at source reads."

This topology assumes one operator with local read access to every source. That
assumption holds for the single-user MVP and breaks for a team:

- Central will not — and for trust reasons should not — hold ambient read access
  to every team member's repositories.
- Projects are heterogeneous and numerous; a central scanner must know each
  repository's location and credentials up front, so onboarding is a central
  operation rather than a project-owned one.
- The freshness signal a central scanner produces is really "when the scanner last
  ran," which does not distinguish a healthy project from one the scanner can no
  longer reach.

The product already anticipates this direction. `product-vision.md` names
"teams and organizations" as the long-term target and "secure small-team hosting"
(GitHub App sign-in, server-side membership authorization) as the first follow-up;
`refinement-todo.md` carries open triggers for **Daily collection** (local
scheduler vs. GitHub Actions vs. another central runner) and **Hosted small-team
access**. This ADR resolves the *topology* question those triggers share.

The proposal under review (owner, 2026-08-02): onboard a project by installing a
minimal **client plug-in** that triggers on an existing hook (git hook, CI event,
or Jig lifecycle event), runs a collection **skill**, and reports a small,
targeted record to a central Gauge service — so minimal per-project data is
collected centrally without central scanning.

The seam that makes this cheap already exists. `schemas/observation-v1.schema.json`
is a versioned, provenance-bearing, freshness-aware envelope with independently
versioned typed capability signals and candidate resolution. It is already a
wire-ready contract; it was designed to be produced by adapters and consumed by
readers that never touched the source. Nothing about it assumes the producer and
the consumer share a process or a filesystem.

## Decision Options Considered

### Option A: Keep central pull; scale it by granting central read credentials

Central retains the scanner and is given read credentials (a GitHub App
installation, deploy keys, or per-repo tokens) to every team repository, plus a
schedule.

- **Pros:** No new runtime surface; `observation.mjs`/`state.mjs`/derivation are
  untouched; one place to reason about collection.
- **Cons:** Concentrates read access to every team repository in one service —
  the largest possible credential blast radius, and the opposite of least
  privilege. Central must be told where every repository lives and be reachable
  to it (private networks, self-hosted forges, and per-repo auth all become
  central's problem). Onboarding stays a central act, contradicting the
  project-owned authority model (ADR-0003). Freshness still means "last scan," not
  "last true state." It scales operational and security burden linearly with the
  team without improving fidelity.

### Option B: Invert to edge push; retire pull

Every project pushes. The scanner and its local-filesystem assumptions are
removed; the only ingress is an authenticated endpoint.

- **Pros:** Collection runs where access already exists (the project's own dev/CI
  environment), so central never needs source credentials; onboarding is
  project-owned and self-service; the credential blast radius is per-project.
- **Cons:** Strands the working single-user local loop, which has no hooks to
  push from and needs no network. Forces an un-instrumented project to be
  invisible rather than degrade gracefully, violating a design principle. Makes a
  hosted ingest service a hard prerequisite for any collection at all.

### Option C: Hybrid — push is the team-tier default, pull remains the fallback, over one observation contract

Stand up an authenticated ingest path that accepts observation-v1 records from
edge clients, alongside the existing scanner. Both produce the same contract and
write to the same central history. Push is how instrumented team projects report;
pull remains for the local single-user loop and for un-instrumented projects.

- **Pros:** Because both paths emit observation-v1, central storage, freshness
  aging, two-layer derivation (ADR-0006), and the dashboard consume records
  without caring how they arrived. The local MVP is untouched; the team tier is
  additive. Graceful degradation is preserved: an un-instrumented project can
  still be pulled. Migration is per-project, not a cutover.
- **Cons:** Two producing paths to keep behind one contract, so the contract's
  invariants (provenance, freshness, `unknown`) must be enforced identically at
  both, and enforced *server-side* for push, where the producer is no longer
  trusted. Introduces the trust, identity, and freshness-aging responsibilities a
  local pull never needed.

## Recommended Decision

Choose **Option C**. Frame the team-tier evolution as *inverting collection to
edge push while keeping observation-v1 as the invariant seam*, with central pull
retained as the fallback producer. This framing is what keeps it a bounded
evolution of the existing pipeline rather than a second product.

Three roles follow.

### Edge client plug-in (thin, per project)

Installed once per onboarded repository. Its entire job is: *on trigger → run the
collection skill → emit an observation-v1 record → authenticate and POST it to
central.*

- **Trigger** is whatever the project already has — a git `post-commit` /
  `post-merge` hook, a CI job (`on: push` or scheduled), or a Jig lifecycle hook.
  Support more than one; do not marry one.
- **Collection** is a skill that reads only the minimal targeted signals central
  needs (progress, active goal/deadline, blockers, git head), not the whole
  repository.
- The client is **dumb by contract**: it collects and reports; it does not derive
  forecasts, risk, or attention. Derivation stays central (see below).
- The client stays dependency-light so it drops into any repository, honoring the
  spirit of ADR-0001 even where central cannot.

The adapters that run centrally today (`src/observation.mjs`) **relocate to the
edge** in the push path: the same adapter logic runs inside the client, in the
project's environment, and produces the same observation-v1 document. The adapter
boundary does not disappear; it moves to where the source access is.

### Ingest boundary (the genuinely new central surface)

An authenticated `POST /api/observations` that authenticates the project,
validates the body against observation-v1, stamps a **server-side** receipt time,
records **attributed** provenance (see trust, below), and appends to immutable
central history. This is the trust boundary the local model never had to have; it
is the heart of this ADR's new work.

### Central service (mostly the existing runtime)

Storage, freshness aging, two-layer derivation (ADR-0006), and the dashboard are
unchanged in spirit. They keep consuming observation-v1 and no longer care whether
a record came from a scan or an HTTP POST. This is precisely the extractability
ADR-0006 preserved: the derivation layer's only observation input remains
`readObservationHistory()`.

### Cross-cutting decisions the push topology forces

The local pull model got these for free; the team tier must decide them
explicitly. This ADR names them and fixes their home; it does not set their final
policy, which each follow-up slice settles.

1. **Identity and authentication (per project).** Each client presents a
   credential that binds a record to an authorized project — a per-project token
   or, preferably, an OIDC token minted by the client's CI provider. This composes
   with the planned GitHub App follow-up and keeps the credential blast radius
   per-project.
2. **Trust — attested vs. observed provenance.** In pull, provenance is
   trustworthy because Gauge did the reading. In push, a client can assert
   anything, so ingest must treat client-supplied provenance as *attested*, bind
   it to the authenticated identity, and record "reported by X" distinctly from
   "verified by Gauge." For a trusted internal team this can be light, but it is a
   conscious decision, not a freebie.
3. **Freshness decay for silence.** A project that stops reporting must not freeze
   at its last-good state — that would render stale data as healthy, violating the
   `unknown` principle (ADR-0003, glossary). Central must track last-seen per
   project and age absent/stale reports to `stale`/`unknown` on its own clock. The
   freshness enum already supports the states; the aging logic moves server-side.
4. **Schema skew across independently updated clients.** With many teams upgrading
   their plug-in on their own schedule, central will receive a spread of signal
   versions simultaneously. Lean on the contract's existing rule (ADR-0004,
   retained by ADR-0005): typed, independently versioned capability signals, with
   unknown types/versions preserved but uninterpreted. Never require the client
   fleet to upgrade in lockstep; reject only at the envelope level.
5. **Data minimization and tenant isolation.** "Minimal targeted data centrally"
   is both feature and privacy stance: the client sends derived signals (percent
   done, blocker counts, dates), not raw repository contents, and central storage
   isolates tenants. Making the edge client the only thing that ever reads source
   *strengthens* the read-only-source guarantee rather than weakening it.

### Authority-model fit

The client is the natural place for a project to **self-declare its active goal
and deadline**, which is exactly where ADR-0003 puts that authority. This sidesteps
the open central goal-selection question in `refinement-todo.md` (generic milestone
vs. repo-configured goal): the project states its goal in its own config and
reports it, rather than central guessing from milestones.

### What this ADR does and does not fix

It fixes the **topology and the seam**: push is the team-tier collection model,
pull is the fallback, observation-v1 is the invariant, derivation stays central,
clients stay dumb. It does **not** set the authentication mechanism, the
attestation strength, the freshness-aging thresholds, or the hosting platform —
those remain open in `refinement-todo.md` (Daily collection; Hosted small-team
access) and each is settled in its own slice depending on this ADR.

## Consequences

**Becomes easier:**

- Onboarding a team project without granting central any source credential;
  collection runs where access already exists.
- Keeping the local single-user MVP untouched while the team tier lands additively
  behind the same contract.
- Reusing storage, derivation (ADR-0006), and the dashboard verbatim, because the
  producer change stops at the observation contract.
- Migrating per-project (push an instrumented repo, pull the rest) instead of a
  fleet-wide cutover.

**Becomes harder:**

- Central must enforce the contract's invariants server-side against an untrusted
  producer — validation, attested provenance, and freshness aging become central's
  responsibility, not the scanner's.
- Two producing paths (pull and push) must be kept behind one contract without
  drift; review must ensure both emit identical provenance/freshness/`unknown`
  semantics.
- A hosted, authenticated, multi-tenant ingest service is a different runtime and
  trust boundary than the loopback MVP (see ADR-0001 tension below).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

- **A1 — Current topology is central pull.** Verified 2026-08-02 by reading
  `scripts/snapshot.mjs` (iterates the registry, calls `observeProject` then
  `collectObservation`), `src/observation.mjs` (runs adapters centrally), and
  `architecture.md` ("Collection stops at source reads").
- **A2 — observation-v1 is producer-agnostic and wire-ready.** Verified by reading
  `schemas/observation-v1.schema.json`: versioned envelope, per-adapter provenance
  with `collectedAt`/`sourceRevision`/`sourceTimestamp`, a `freshness` enum
  (`fresh`/`stale`/`unknown`/`error`), and independently versioned typed signals
  with unknown-preservation. No field assumes a shared process or filesystem. The
  claim that central readers "barely change" is a design assertion to be proven by
  the ingest slice, not yet executed.
- **A3 — ADR-0001's zero-dependency, loopback-only runtime constraint is scoped to
  the local MVP.** A hosted multi-tenant ingest service will likely need
  dependencies and non-loopback binding. `product-vision.md` already treats hosted
  access as a separate release and trust boundary, so this is a scoping question
  for a future ADR, not a contradiction — but it is an assumption, not a settled
  decision, and this ADR does not itself amend ADR-0001.

## Kill criteria

- The team tier never materializes, or the team is small enough that granting
  central read credentials (Option A) is acceptable; in that case keep central
  pull and shelve the ingest surface rather than maintaining two producing paths.
- Edge clients cannot produce trustworthy attested provenance cheaply enough for
  central to rely on, and verification would require central source access anyway;
  in that case the push model's central-has-no-credentials benefit collapses and
  Option A should be reconsidered.
- Server-side freshness aging cannot honestly distinguish "project is healthy but
  quiet" from "client stopped reporting"; in that case the push model degrades the
  `unknown` guarantee it was meant to preserve and must be reworked before adoption.

## Open questions

- What authentication mechanism binds a pushed record to an authorized project —
  per-project token, CI-provider OIDC, or the GitHub App installation identity?
- How strong must attestation be for a trusted internal team, and what exactly is
  recorded as "reported" vs. "verified"?
- What is the freshness-aging policy (last-seen window, decay to `stale` then
  `unknown`) and where does it live relative to the two-layer derivation split?
- Does the hosted ingest service warrant amending or superseding ADR-0001 for the
  central runtime while the edge client stays dependency-light?
- Which triggers does the reference client support first (git hook, CI event, Jig
  lifecycle), and is the collection skill shared across them or trigger-specific?
