---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 008: Generic-doc adapter

## Overview

Gauge's single adapter (`src/scan.mjs`) hardcodes **jig's** folder-per-spec
convention as if it were the generic notion of a spec: `scanSpecs` reads only
`<specsDir>/<dir>/spec.md`, so a project whose specs are **flat**
`specs/<name>.md` files observes as a blank "execution signal unsupported" card.
Onboarding the validation corpus (spec 007-03) surfaced a real driver —
`mystique/docs/superpowers` — whose `specs/` folder holds flat, dated design
docs. Flat-file-per-spec is a legitimate, common convention; enforcing jig's
opinion makes Gauge non-generic against exactly the heterogeneous corpus it
exists to observe.

Per **[ADR-0010](../../decisions/adr-0010-generic-doc-adapter.md)** (Accepted),
this spec **recasts the adapter into a convention-generic doc reader**, with
`jig` expressed as a **named preset** — a bundle of project-profile-v1
capabilities. Two capabilities carry the change:

- **`specLayout`** (new, additive to profile-v1): `nested` (`<dir>/spec.md`,
  the jig preset), `flat` (`<name>.md`), or `auto` (detect).
- **completion is gated by a recognized delivery vocabulary**: a status that is
  absent — or present but outside a recognized delivery-completion vocabulary —
  resolves to `unknownStatus` and is **excluded** from the completion rollup, so
  a root with no recognized delivery status reports completion **`unknown`**,
  never a false `0%` or `100%`. This is a deliberate change to `progressOf`'s
  current denominator behavior (today a status-absent artifact coerces to
  `'UNKNOWN'` and sits in the denominator as incomplete).

The two invariants ADR-0010 pins: **(1)** the `jig` preset stays byte-identical
to today's behavior on the nested-layout + frontmatter-status path (existing
corpus cards unchanged), and **(2)** completion is never fabricated —
heterogeneous status vocabularies degrade to honest `unknown`, feeding
[ADR-0006](../../decisions/adr-0006-two-layer-derivation.md)'s forecast/risk
truthfully.

### Boundary

- **In scope:** the generic adapter model + `jig` preset; the `specLayout`
  capability (flat/nested/auto) additive to profile-v1; the delivery-vocabulary
  completion gate for the **status-absent** path (the real driver); discovery
  (007-03) emitting a detected `specLayout`; the two-tier card/evidence gate
  (declared-root-plus-matching-artifact). Config back-compat: `adapters:["jig"]`
  resolves to the preset, no migration.
- **Out of scope (deferred per ADR-0010):** `statusSource: prose` **extraction**
  (no project encodes a *delivery* status in prose — superpowers' prose
  `Approved` is design-review, not completion); a **declarable custom completion
  vocabulary** and the **foreign-status** (present-but-non-delivery) exclusion
  path (driverless today); adapter **renaming** (`jig` stays the preset name;
  module internals generalize). Unchanged: the observation contract (ADR-0005),
  derivation (ADR-0006), transports (ADR-0007/0008), read-only sources (ADR-0003).

## Assumptions

Grounded by probe for [ADR-0010](../../decisions/adr-0010-generic-doc-adapter.md)
(2026-08-03) — see that ADR's `## Assumptions` A1–A3, verified through four
frame-critique rounds. The load-bearing ones this spec inherits:

- **A2 (design-approval ≠ work-completion).** The driver's prose `Status:
  Approved` is a *design-review* state, not delivery-completion; this spec must
  **not** map it to `done`. superpowers reports completion `unknown`.
- **`normStatus`/`progressOf` grounding.** `normStatus` (`src/lib.mjs`) only
  upper-cases (defines no vocabulary); `progressOf` credits `done = by.DONE` and
  puts every other token in `denom = total - abandoned`. The delivery-vocabulary
  gate is therefore **new** rollup behavior, not an existing property — the jig
  delivery vocabulary is a to-be-defined allowlist (008-01).
- **Byte-identical jig preset.** Whether the exclusion rule touches
  status-absent *jig* specs (currently counted in the denominator) is a slice-01
  design question; the constraint is that existing jig corpus cards stay
  byte-identical (the `unknown` floor applies at the root level when **no**
  recognized delivery status exists, not as a silent per-artifact change to jig
  cards). Resolve in 008-01.

## Decomposition

**SPIDR axis: Data, then Path.** Split first by the artifact **shape** the
adapter can read — the flat-layout data shape with honest status-absent
completion (008-01) is the minimal vertical that flips a real card from blank to
truthful. Then by **path to a configured profile** — hand-authored `specLayout`
(008-01) before discovered/auto-detected (008-02), reusing 007-03's
`discoverProfile`. The driverless edge rule (foreign-status vocabulary + custom
declarable vocabulary) is parked as a **DEFERRED** slice (008-03) per ADR-0010's
own grounding discipline (carry unexercised variance, don't build it). **No
spike:** ADR-0010 already probed the unknowns (layout, status semantics,
`progressOf` behavior) across four frame-critique rounds; each slice ships
working, visible behavior.

Each slice turns a real card that is currently blank or wrong into a correct
one, so each is vertical and independently visible on the dashboard.

## Slices

- [008-01 — Flat layout + honest completion (jig preset unchanged)](slice-01-flat-layout-honest-completion.md)
- [008-02 — Auto-detect + discovery emits specLayout](slice-02-autodetect-discovery.md)
- [008-03 — Declarable completion vocabulary + foreign-status gate (DEFERRED)](slice-03-completion-vocabulary.md)
