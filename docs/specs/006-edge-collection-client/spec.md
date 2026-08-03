---
status: DRAFT
use_cases: []
last_verified: 2026-08-03
---

# Spec 006: Edge collection client and skill

## Overview

Add the edge half of the pull→push inversion
([ADR-0007](../../decisions/adr-0007-invert-collection-central-pull-to-edge-push.md)):
a minimal, dependency-light **client** that a project installs once, which triggers
on an existing hook, runs a collection **skill** in the project's own environment,
and reports a small observation-v1 record to the central ingest
([spec 005](../005-central-observation-ingest-boundary/spec.md)).

The client is **dumb by contract**: it collects and reports; it derives no
forecast, risk, or attention (that stays central, ADR-0006). The adapter logic that
runs centrally today (`src/observation.mjs`) **relocates to the edge** in the push
path and produces the same observation-v1 document — so central readers are
unchanged. Collection runs where source access already exists, so central needs no
source credential; this is the read-only-source guarantee (ADR-0003) re-derived
under the push topology.

Onboarding a project this way is also where the project **self-declares its active
goal and deadline** from its own config, honoring project authority (ADR-0003) and
sidestepping the open central goal-selection question in
[refinement-todo](../../refinement-todo.md).

## Decomposition

**SPIDR axis: Path.** Split by the producer→transport→authority path so each slice
delivers standalone value:

- 006-01 lands the local emitter (produce a valid record; no network), provable in
  isolation.
- 006-02 adds the trigger and the authenticated push to central (depends on
  slice 005-01).
- 006-03 adds the project-owned goal/deadline the client contributes.

Happy path first; each slice touches the user-facing surface (a real record, a
real card).

## Slices

- [006-01 — Local observation emitter](slice-01-local-observation-emitter.md)
- [006-02 — Trigger and authenticated push](slice-02-trigger-and-authenticated-push.md)
- [006-03 — Project-declared goal and deadline](slice-03-project-declared-goal-and-deadline.md)
