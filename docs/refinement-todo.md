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

### Generic goal and deadline source

**Decision needed:** whether the first generic adapter uses one active GitHub
milestone, repository configuration, or both with explicit precedence.

**Resolution trigger:** before drafting the generic goal-adapter slice.

## MVP derivation policy

### Progress strategies

**Decision needed:** which sourced completion strategies are supported in the
two-week MVP and how each reports unsupported or unknown work.

**Resolution trigger:** after probing three real projects and before drafting
the progress/risk slice.

### Forecast confidence

**Decision needed:** minimum date/history evidence required for `on_track` or
`at_risk`; below it the only valid result is `unknown`.

**Resolution trigger:** after enough central observations exist to test a rule
against the three-project validation set.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md); this item resolves the
policy, not the placement.

### Cross-project attention overlay

**Decision needed:** smallest central policy that expresses portfolio intent
without duplicating project-local priorities—ordered projects, coarse tiers, or
deadline-plus-attention rules.

**Resolution trigger:** before implementing the global attention queue.

**Architectural home:** the history-derived layer defined by
[ADR-0006](decisions/adr-0006-two-layer-derivation.md), downstream of
forecast/risk; this item resolves the policy, not the placement.

## Collection and security

### Daily collection

**Decision needed:** local scheduler, GitHub Actions, or another central runner;
credential scope and failure visibility are part of the choice.

**Resolution trigger:** before automated daily writes to Gauge instance state.

### Hosted small-team access

**Decision needed:** GitHub App registration, server-side session model,
organization/team membership revalidation window, hosting platform, and
collector credential separation.

**Resolution trigger:** after the local MVP ships and before follow-up 1 is
committed.

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
