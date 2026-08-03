---
status: DRAFT
use_cases: []
last_verified: 2026-08-03
---

# Spec 005: Central observation ingest boundary

## Overview

Add the central half of the pull→push inversion
([ADR-0007](../../decisions/adr-0007-invert-collection-central-pull-to-edge-push.md)):
an authenticated ingress that accepts normalized observations pushed by edge
clients, attributes and stores them, and ages silent projects to `stale`/`unknown`
so a project that stops reporting cannot render as healthy. The wire contract is
the existing `schemas/observation-v1.schema.json`; identity, attestation, and
freshness aging follow
[ADR-0008](../../decisions/adr-0008-ingest-identity-attestation-freshness.md).

Central pull (`scripts/snapshot.mjs`) remains the fallback producer and is
untouched by this spec — both paths write the same immutable history through
`src/state.mjs`, and the two-layer derivation (ADR-0006) and dashboard consume
records without caring how they arrived. This spec is the ingest counterpart to
the edge client shaped in
[spec 006](../006-edge-collection-client/spec.md); slice 006-02 depends on
slice 005-01.

This spec is the push alternative to the "least-privilege scheduled collector"
line in the [secure-small-team-hosting](../../releases/secure-small-team-hosting.md)
release plan. Multi-tenant hosting and the ADR-0001 runtime question stay with
that release; slice 005-01 targets the existing zero-dependency loopback server.

## Decomposition

**SPIDR axis: Interface, then Rules.** The new capability is an ingress channel,
so split by interface first: land the authenticated accept-validate-store path
end to end (005-01) before adding the freshness-aging rule that keeps silent
projects honest (005-02). Each slice is independently visible on the dashboard.

## Slices

- [005-01 — Authenticated observation ingest endpoint](slice-01-authenticated-ingest-endpoint.md)
- [005-02 — Freshness aging for silent projects](slice-02-freshness-aging-for-silent-projects.md)
