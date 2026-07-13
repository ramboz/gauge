---
status: IN_PROGRESS
skill: reframe
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 004: Retrofit dashboard runtime onto Gauge portfolio product

## Overview

Bring the shipped `project-dashboard` runtime and its caller-facing contracts in
line with [ADR-0003](../../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md),
the authoritative Gauge product direction. Preserve the POC behavior that
survives the reframe—deterministic collection, read-only source access, tolerant
Jig parsing, workstream pinning, worktree-only warnings, and the local page—while
removing Jig/Compass as the product core.

This is a retrofit of shipped code, not the complete Gauge MVP. New portfolio
capabilities such as deadline forecasting, recommendation ranking, scheduled
collection, hosted authentication, and Servo signals are emergent work from
ADR-0003 and require their own shaped specs.

## Assumptions

- **Authority:** ADR-0003 is the reference this retrofit is measured against.
- **Verified repository shape (2026-07-13):** the shipped runtime lives in
  `src/`, `public/`, and `scripts/snapshot.mjs`; package/config identity lives in
  `package.json` and `dashboard.config.example.json`; tests live under `test/`.
  A targeted source probe found direct Jig and project-local Compass coupling in
  each of those runtime surfaces.
- **Verified permission (2026-07-13):** the original POC author and Gauge owner
  are collaborating on this derivative and approved release under the repository's
  MIT license, with upstream attribution preserved.

## Decomposition

**SPIDR axis: Interface.** Replace the current direct “configured local Jig
roots → page” interface with the smallest end-to-end Gauge path: configured
project → source adapter → normalized observation → private central instance
state → local card. One slice keeps the retrofit vertical and avoids landing an
unused adapter layer before a user-visible Gauge page exists.

## Slices

- [004-01 — Gauge core and central state](slice-01-gauge-core-and-central-state.md)
