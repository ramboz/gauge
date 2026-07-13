---
status: DONE
use_cases: [UC-1, UC-2, UC-3, UC-4]
last_verified: 2026-07-13
---

# Spec 002: Dashboard MVP

## Overview

The MVP of the cross-project dashboard: a zero-dependency Node scanner over
configured jig project roots, a tiny local server, and one self-contained
page of project cards. Everything renders from artifacts the projects
already write; the only new contract is the compass snapshot file
(slice 03 / ADR-0002). See [product-vision.md](../../product-vision.md) for
the why. File formats and acceptance fixtures were verified against several
real jig projects during the design session (2026-07-13).

## Decomposition

**SPIDR axis: thin-vertical-first, then enrich by data layer.** Slice
002-01 delivers the smallest usable dashboard end-to-end (scan → serve →
see progress). Each later slice adds one data layer to the same pipeline
while staying independently shippable. Splitting scanner/server/page from
each other was rejected as horizontal phasing — a scanner without a page
delivers no observable value.

### Slices

1. **`002-01 scan-and-serve`** — configured projects rendered as cards with
   spec/slice progress, bug/todo/inbox counts, and git dates; rescan on
   every refresh. *(See [slice-01-scan-and-serve.md](slice-01-scan-and-serve.md).)*
2. **`002-02 workstreams`** — release plans and pinned runbooks per project
   with checkbox progress, current phase, next step and owner; discovery +
   pin/hide registry; worktree-only-doc warning.
   *(See [slice-02-workstreams.md](slice-02-workstreams.md).)*
3. **`002-03 compass-snapshot`** — the `compass-history.jsonl` contract
   (ADR-0001), rendered as the narrative block on each card, plus the
   integration snippet for the compass skill.
   *(See [slice-03-compass-snapshot.md](slice-03-compass-snapshot.md).)*

Deferred to a later spec (see vision → MVP scope): hours-worked layer,
evolution graphs, cross-project owner queue, jig upstreaming.

## Amendments

- **2026-07-13 — Gauge reframe:** This spec remains the closed record of the
  working POC. [ADR-0003](../../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)
  replaces its Jig/Compass-centered product premise and routes shipped runtime
  changes through [spec 004](../004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md).
  Historical acceptance criteria are intentionally unchanged.
