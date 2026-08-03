---
status: Proposed
dependencies: [adr-0001, adr-0003, adr-0005, adr-0006, adr-0007]
last_verified: 2026-08-03
frame_review: true
---

# ADR-0008: Ingest identity, attestation, and freshness-aging contract for pushed observations

## Status

Proposed (2026-08-03)

Resolves the execution-blocking open questions ADR-0007 left for the push path:
per-project identity, attested-vs-observed provenance, and server-side freshness
decay. Like ADR-0007 it is scoped to the team tier and does not change the
committed local MVP. It deliberately does **not** resolve the hosted-runtime
question (whether ADR-0001's zero-dependency / loopback-only constraint is
amended for a multi-tenant deployment); that remains open and is bound to the
[secure-small-team-hosting](../releases/secure-small-team-hosting.md) release.

## Context

ADR-0007 fixes the topology — edge clients push observation-v1 to an authenticated
central ingest, pull remains the fallback, derivation stays central — but leaves
three decisions open that any ingest slice must have settled before it can be
built:

1. **Identity/authentication.** How a pushed record is bound to an authorized
   project.
2. **Attestation.** In pull, provenance is trustworthy because Gauge did the
   reading. In push the producer is untrusted, so central must distinguish what a
   client *claimed* from what Gauge *observed*.
3. **Freshness decay.** A project that stops pushing must age to `stale`/`unknown`
   rather than freeze at its last-good state, or stale data renders as healthy —
   violating the `unknown` principle (ADR-0003, glossary).

Two verified constraints shape the options (checked 2026-08-03):

- **observation-v1 is immutable and producer-owned.** `schemas/observation-v1.schema.json`
  requires `provenance` (per-adapter `collectedAt`/`sourceRevision`/
  `sourceTimestamp`/`freshness`) and a `freshness` enum
  (`fresh`/`stale`/`unknown`/`error`) on every signal, and it carries an
  `extensions` object. `src/state.mjs` writes records immutably beneath `stateDir`
  (ADR-0004/0005). Central must not rewrite a producer's record to inject its own
  trust or timing metadata.
- **Zero runtime dependencies still hold for what this ADR needs.** A bearer-token
  check and a server clock need only Node built-ins (`http`, `crypto`), so the
  identity/attestation/freshness contract here is buildable under ADR-0001 on the
  existing loopback server. Only multi-tenant hosting would strain ADR-0001, and
  that is out of scope here.

## Decision Options Considered

### Identity

- **A. Per-project bearer token.** Central issues a secret per registered project;
  the client sends it. Simple, zero-dep, works identically from a laptop hook or a
  CI job.
- **B. CI-provider OIDC token.** The client presents a short-lived OIDC token
  minted by its CI provider; central verifies signature and claims. No long-lived
  secret, but only available inside supported CI and needs JWKS handling.
- **C. GitHub App installation identity.** Reuse the App identity planned for
  [secure-small-team-hosting](../releases/secure-small-team-hosting.md). Strongest
  and consistent with hosted auth, but drags the whole App/session design forward
  as a prerequisite.

### Attestation storage

- **D. Mutate the record** (write `receivedAt`/`reportedBy` into the observation or
  its `extensions`). Rejected: breaks record immutability and blurs producer-owned
  claims with central-owned trust metadata.
- **E. Central ingest-attribution sidecar.** Store the observation-v1 record
  unchanged and write a separate central-owned attribution record keyed by
  `recordId` (`receivedAt` server clock, `reportedBy` authenticated identity,
  transport, raw-body hash). Keeps the producer/central authority split clean.

### Freshness aging

- **F. Trust producer freshness as-is.** Rejected: a silent client's last record
  claims `fresh` forever.
- **G. Central degrade-only aging.** A read-layer policy derives an effective
  freshness from `receivedAt` vs. now against a last-seen window and may only
  **lower** freshness (`fresh`→`stale`→`unknown`), never raise it. Producer
  freshness (source-vs-collection) and central freshness (collection-vs-now) are
  both retained; the rendered card takes the worse of the two.

## Recommended Decision

**Identity — A now, with B/C as a documented upgrade path.** Adopt per-project
bearer tokens as the baseline: zero-dep, portable across laptop hooks and CI, and
sufficient for a trusted internal team. Record CI-provider OIDC (B) and the GitHub
App identity (C) as the upgrade path, and require that the ingest endpoint treat
the credential behind a small verifier seam so B/C slot in without changing the
stored attribution shape. The App identity (C) is where this converges once
secure-small-team-hosting is committed.

**Attestation — E.** Central stores the pushed observation-v1 record **unchanged**
and writes a separate central-owned **ingest-attribution** record keyed by
`recordId`, carrying `receivedAt` (server clock), `reportedBy` (authenticated
project identity), transport, and a hash of the raw body. Client-supplied
provenance is retained and labelled **attested** (reported by the identity), never
presented as **verified** (independently confirmed by Gauge). This preserves
record immutability (ADR-0004/0005) and the producer/central authority split
(ADR-0003): the project owns its claims, Gauge owns the attribution of who said
them and when they arrived.

**Freshness — G, homed in the current-state read layer (ADR-0006).** Central
derives an effective freshness from `receivedAt` vs. now using a configured
last-seen window and may only degrade, never upgrade, the producer's freshness.
The card renders the worse of producer freshness and central aging. This lives in
the current-state read layer because it is about rendering the latest card
honestly, upstream of any history-derived forecast. The exact window values are a
read-policy parameter, not fixed here.

Ingest also validates every body against observation-v1 and rejects at the
**envelope** level only (schema-invalid, unknown project, bad credential),
preserving ADR-0007's rule that unknown capability types/versions are stored but
uninterpreted.

## Consequences

**Becomes easier:**

- Building the ingest slice (spec 005): identity, what-is-stored, and freshness are
  all settled and all zero-dep.
- Keeping records immutable and producer-owned while still attributing trust and
  arrival time centrally.
- Swapping the credential model (token → OIDC → App) later without changing the
  stored attribution shape or the observation contract.

**Becomes harder:**

- Central now owns a second record type (ingest-attribution) and its retention,
  joined to observations by `recordId`.
- Readers must consult both producer freshness and central aging and take the
  worse; a reader that reads only one will render stale data as healthy.
- Per-project token issuance/rotation is an operational surface that did not exist
  in the local pull model.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces must be backed by an executed
probe or a citation — or listed here explicitly as an assumption._

- **A1 — observation-v1 is immutable, producer-owned, and has an `extensions`
  seam.** Verified 2026-08-03 by reading `schemas/observation-v1.schema.json`
  (required `provenance`, per-signal `freshness` enum, top-level `extensions`
  object) and `src/state.mjs` (immutable write beneath `stateDir`).
- **A2 — token auth, server clock, and body hashing are zero-dep.** Node's
  built-in `http` and `crypto` cover bearer-token comparison, `receivedAt`
  stamping, and raw-body hashing without a dependency, so this contract holds under
  ADR-0001 on the existing loopback server. OIDC (option B) additionally needs
  JWKS fetch/verify; still built-in `crypto` + `fetch`, but not exercised here.
- **A3 — degrade-only aging preserves the `unknown` guarantee.** Design assertion,
  to be proven by the freshness-aging slice (005-02): that taking the worse of
  producer and central freshness never renders a silent project as healthy.

## Kill criteria

- A trusted internal team finds per-project tokens too weak or too costly to
  rotate before OIDC/App identity is available; in that case bring option B or C
  forward rather than shipping tokens.
- The ingest-attribution sidecar proves to need atomic consistency with the
  observation write that the immutable-record store cannot give cheaply; in that
  case revisit option D (a strictly central-owned, clearly-separated block inside
  the stored envelope) rather than a second record.
- Central aging cannot honestly distinguish "healthy but quiet" from "client
  stopped reporting" for real reporting cadences; in that case the push freshness
  story is unsound and must be reworked before adoption (mirrors ADR-0007's
  freshness kill criterion).

## Open questions

- What last-seen window(s) drive degrade-only aging, and are they global or
  per-project cadence-aware? (Read-policy parameter; resolved in slice 005-02.)
- Token issuance/rotation mechanics and where the secret is stored on the client
  side (env var, CI secret, keychain).
- Does the ingest-attribution record also capture client version / adapter set for
  fleet observability, or is that scope creep?
