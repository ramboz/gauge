---
status: Accepted
dependencies: []
last_verified: 2026-08-03
frame_review: true
---

# ADR-0010: Convention-generic doc adapter — jig layout becomes a preset

## Status

Accepted (2026-08-03)

Unblocks a new spec (008) that generalizes the jig adapter into a
convention-generic doc reader. Scoped to how Gauge *observes spec-like
artifacts*; it does not change the observation contract
([ADR-0005](./adr-0005-symmetric-source-state-isolation.md)), the two-layer
derivation ([ADR-0006](./adr-0006-two-layer-derivation.md)), or the transports
(ADR-0007/0008). Buildable under [ADR-0001](./adr-0001-runtime-zero-deps.md)
(no new runtime dependency — Markdown/frontmatter parsing already exists in
`src/scan.mjs`/`src/lib.mjs`). Extends the project-shape profile
([ADR-0009](./adr-0009-project-shape-profile-contract.md)) additively and
supplies the real driver for that spec's carried Assumption A1 (folder/status
variance, previously unexercised).

**Owner acceptance (2026-08-03):** the "recast the jig adapter as a
convention-generic doc adapter, jig becomes a named preset" option was chosen
directly by the owner during shaping, over the smaller adapter-knob option and
the larger core-reframe option.

## Context

Gauge's one adapter hardcodes jig's folder-per-spec convention as if it were the
generic notion of a spec, so projects with a valid non-jig spec layout observe as
blank.

Gauge is a **portfolio observer**: the core consumes normalized observations,
and an **adapter** ([glossary](../memory/glossary.md)) is "an optional read-only
translator from a source convention into Gauge observations." The single shipped
adapter is `jig` (`src/scan.mjs`). Probing it (2026-08-03) shows it hardcodes
**jig's** conventions rather than a generic notion of a spec:

- `scanSpecs` iterates **directories** and reads `<specsDir>/<dir>/spec.md`
  (`if (!entry.isDirectory()) continue;`), so a **flat** `specs/<name>.md`
  layout yields **zero** specs.
- completion is rolled up from a frontmatter status property
  (`normStatus(data[statusProperty])`); a spec artifact with **no** status
  frontmatter contributes nothing.
- `hasJigEvidence` gates "is this a tracked project" on jig-specific markers
  (`scaffold.json`, a real `<dir>/spec.md`, or an `adr-\d+` file).

The [project-shape profile](./adr-0009-project-shape-profile-contract.md)
(v1, spec 007) already externalizes *where* artifacts live (`artifactRoot`,
`entries[]`) and *some* naming (`specsDir` / `decisionsDir` / `statusProperty`),
but it still assumes jig's **folder-per-spec layout** and **required status
frontmatter**. Spec 007 carried this as Assumption A1 ("folder/status variance
is real but unexercised … exercised by synthetic fixtures only until a real
project needs it").

A real project now needs it. Onboarding the validation corpus (spec 007-03,
verified read-only 2026-08-03) surfaced **`mystique/docs/superpowers`**: a
`specs/` folder of **flat, dated design docs** (`2026-06-24-…-design.md`). None
use **YAML frontmatter**, so the jig adapter (nested layout + frontmatter
`status:`) sees neither the layout nor the status and renders a blank "execution
signal unsupported" card. But the files are **not** status-less prose: **half
carry a prose status line** — `**Status:** Approved`,
`Status: APPROVED (brainstorm)` — while the rest carry none. (An earlier probe
that grepped only for YAML frontmatter mis-reported these as status-absent; the
frame-critique on this ADR caught it. See Assumptions.) So the driver exhibits
**two** variances at once: a non-jig **layout** (flat files) and a non-jig
**status encoding** (prose, or absent), mixed within one folder. That is not a
bug in the project: **flat-file-per-spec with a prose or absent status is a
legitimate, common spec convention** (RFCs, design notes, ADR-style flat files).
Enforcing jig's folder-per-spec + frontmatter-status opinion makes Gauge
non-generic against exactly the heterogeneous corpus it exists to observe, in
tension with its portfolio-observer framing and project authority
([ADR-0003](./adr-0003-reframe-onto-gauge-portfolio-product.md)).

The decision: **how much of "what a spec is" belongs in Gauge's generic model
versus a jig-specific convention**, and by what mechanism a non-jig layout is
supported without (a) forcing migration of existing configs or (b) turning every
`docs/` folder of Markdown into a fabricated progress card.

## Decision Options Considered

### Option A: Adapter knob (keep the jig adapter, add overrides)
Extend profile-v1 with a `specLayout` capability and make `statusProperty`
optional; the adapter stays named/shaped as "jig" with extra branches.
- **Pros:** smallest change; no migration; ships flat-layout support fast.
- **Cons:** leaves the adapter *branded and framed* as jig — the generic
  behavior is bolted onto a jig-named module, so "Gauge is convention-generic"
  stays aspirational. The opinion is still nominally the default identity, not a
  preset. Doesn't resolve the framing the owner objected to.

### Option B: Recast as a convention-generic doc adapter, jig becomes a preset
Refactor the adapter so its model is generic — *find spec-like artifacts under a
root at a declared **layout**, resolve an optional status per artifact, and roll
completion up **only** over statuses in a recognized delivery-completion
vocabulary, reporting everything else as unknown* — and express **jig** as a
**named preset** = `{ layout: nested (`<dir>/spec.md`), status: frontmatter
property "status", completionVocabulary: jig lifecycle, specsDir: "specs",
decisionsDir: "decisions" }`. A preset is sugar over profile-v1 capabilities;
per-project overrides win.
- **Pros:** makes "Gauge is generic" literally true — the opinion lives in a
  named preset, not the core adapter; flat and nested layouts are peers;
  status-optional completion falls out naturally as `unknown`; existing configs
  keep working (`adapters: ["jig"]` resolves to the preset). Right altitude for
  a portfolio observer.
- **Cons:** larger boundary change than A (adapter identity, config resolution,
  the evidence gate all generalize); needs a back-compat guarantee and tests
  proving the jig path is byte-identical.

### Option C: Core reframe (push all convention into adapters via a spec-artifact contract)
Define a minimal generic spec-artifact contract in Gauge **core** and reduce
adapters to signal suppliers only.
- **Pros:** most future-proof; cleanest separation.
- **Cons:** largest change, touches the observation boundary (ADR-0005) and
  every consumer; beyond the current appetite; premature with one non-jig
  convention in evidence. A YAGNI risk.

## Recommended Decision

**Option B — recast the adapter as convention-generic; `jig` becomes a named
preset.** Four load-bearing sub-decisions pin the boundary:

1. **Config back-compat (no migration).** `adapters: ["jig"]` keeps working
   verbatim — it resolves to the built-in **`jig` preset**. Every existing
   corpus config (jig / gauge / servo / shaper) is unchanged, honoring jig's
   no-forced-migration norm. A preset is a *named bundle of profile-v1
   capabilities*, so there is one code path, not two.
2. **The layout axis generalizes; status stays optional and vocabulary-gated.**
   The variance with a real driver is **layout**, so `specLayout` becomes a new
   additive profile-v1 capability: `nested` = `<dir>/spec.md`,
   `flat` = `<name>.md`, `auto` = detect. The `jig` preset fixes
   `specLayout: nested`; a per-entry override wins. Status resolution stays a
   preset/profile capability (`statusProperty` for the frontmatter source,
   already in v1), but **completion is gated by a recognized delivery vocabulary**
   (sub-decision 3) — extracting a status string is not the same as having a
   completion signal. **Prose-status *extraction* is explicitly deferred, not
   built:** the corpus has **no** project that encodes a *delivery* status in
   prose (superpowers' prose `Status: Approved` is design-review state, not
   work-completion — see sub-decision 3 and Assumptions). Per jig's grounding
   discipline (spec 007 A1: carry unexercised variance, don't build it), a
   `statusSource: prose|frontmatter|none` enum is noted as the extensibility
   point but only `frontmatter` and `none` ship now.
3. **Completion is vocabulary-gated — a new rollup rule, not existing behavior.**
   Completion must roll up `done/total` **only** over artifacts whose resolved
   status is in a **recognized delivery-completion vocabulary**; every other
   artifact — status absent, *or* a status outside that vocabulary (a
   design-review `Approved`, an arbitrary label) — is **excluded** to an
   `unknownStatus` bucket, and when **no** artifact resolves a recognized delivery
   status, completion is **`unknown`** — the floor. **This is a deliberate change
   to today's rollup, and grounding it honestly matters:** `progressOf`
   (`src/lib.mjs`) currently credits `done = by.DONE` but puts every other case in
   `denom = total - abandoned`. With prose extraction deferred, superpowers' four
   files resolve status-**absent** (`null → 'UNKNOWN'`), so once flat-layout
   support starts *counting* them they would report **"0/4 (0%)"** — four approved
   designs shown as zero progress, feeding ADR-0006's forecast/risk as "behind."
   (The *foreign-token* case — a non-delivery status like `APPROVED` landing in
   the denominator — is the same bug in the other input and the same fix, but has
   no shipped driver yet since prose is deferred; the absent-status path is what
   the real driver exercises.) The invariant fixes the under-report by *excluding*
   both absent- and non-delivery-status artifacts from the denominator, yielding
   honest `unknown`. `normStatus` today
   only upper-cases (it defines **no** vocabulary); the recognized jig delivery
   vocabulary is a **to-be-defined allowlist** in spec 008 (kill-criterion 1
   flags this as the genuinely hard part). The rule is self-contained w.r.t.
   layout, status source, and who authored the declaration — but it is new code,
   not a property the cited substrate already guarantees.
4. **Card existence vs. completion — two tiers, honestly bounded.** *Completion*
   (tier 1, sub-decision 3) is fully self-contained and cannot fabricate signal.
   *Whether a root becomes a card at all* (tier 2) generalizes `hasJigEvidence`
   to: a root is trackable iff it is **declared/resolved** in the profile **and**
   contains **≥1 artifact matching the declared `specLayout`**. Requiring a real
   matching artifact stops an empty/irrelevant declared root from surfacing. For
   an **operator-authored** declaration this is fully self-contained; for a
   **discovery-authored** one it inherits 007-03's conservatism (discovery
   proposes a root only when it holds a `specs/`|`decisions/` dir — not any lone
   `.md`), a bounded, acknowledged dependency. The ADR does **not** overclaim tier
   2 is discovery-independent; the load-bearing safety property is tier 1, which
   is. Absent any declaration, the fallback stays today's jig heuristic
   (`scaffold.json` / a real `<dir>/spec.md` / an `adr-\d+`), unchanged. Discovery
   and the operator *propose* cards; the human *disposes* (includes/excludes
   entries) — the ADR does not assert every flat-doc folder is delivery work.

Profile v1 capability set after this ADR (minimal, still additive): `artifactRoot`,
`specsDir`, `decisionsDir`, `statusProperty`, **`specLayout`** (new), and
`entries[]` (each entry may carry the same overrides). A named preset (`jig`) is
resolved to these fields plus its recognized delivery-completion vocabulary; a
runtime validator agrees with the schema, as today. (`statusSource` and a
declarable custom completion vocabulary are noted extensibility points, deferred
until a real driver exists.)

**Why B over A given the (corrected, narrowed) driver — stated honestly.** Two
frame-critiques stripped the technical over-justification, so this note refuses to
manufacture one. The current adapter already never coerces a foreign status into
`done` (`progressOf` credits only `by.DONE`), and the completion-vocabulary
`unknownStatus` rule (sub-decision 3) is equally addable under Option A. So the
**honest technical delta from A is small** — both would ship the same two
behaviors (flat layout + vocabulary-gated completion). B is chosen for **framing,
not a unique capability**: (1) the owner explicitly wants Gauge's model to *be*
generic with `jig` as a named preset, rather than a jig-branded adapter with
overrides bolted on; (2) expressing the completion vocabulary and layout as
first-class generic capabilities (a preset resolving to profile fields) is a
cleaner home for the next convention than extending a jig-named module. If a
reader concludes "this is A with a rename," that is a fair reading — the rename
*is* the decision the owner made, and it sets where future conventions land.

## Consequences

**Becomes easier:**
- Observing heterogeneous real projects: flat-file spec folders (design
  docs / RFCs / ADR-style) become first-class rather than blank — observed as
  "N documents · completion `unknown`" where no delivery status exists. Gauge's
  genericity matches its portfolio-observer mandate.
- Completion safety across conventions: the delivery-vocabulary gate *excludes*
  foreign/absent statuses from the rollup (→ `unknownStatus`), so a folder of
  approved designs reads honest **`unknown`** rather than a false **0%** (today's
  `progressOf` would sink them into the denominator once counted). Honest over
  eager, in both directions.
- Future conventions: a new source shape is a new **preset** or a new
  `specLayout` value (a named field bundle / small strategy), not a new module or
  a fork of `scanSpecs`.

**Becomes harder:**
- The adapter's identity and config resolution gain a preset layer (a preset
  name → capability bundle → profile merge). Documented and tested, but a new
  concept in the config path.
- Completion now requires an explicit **recognized delivery vocabulary** rather
  than "any status string counts." The jig preset supplies jig's; a project with
  a foreign vocabulary gets `unknownStatus` until it (or a future capability)
  declares one. This is deliberately conservative — honest over eager.
- The evidence gate is now two-tier (self-contained completion invariant +
  declared-root-with-matching-artifact card gate); tier 2 for discovered roots
  inherits discovery's conservatism. Requires explicit tests for both the
  "foreign status ≠ done" and the "bare / empty declared root ≠ card" guardrails.
- A back-compat obligation: the `jig` preset must stay byte-identical to today's
  behavior on the nested-layout + frontmatter-status path; proven by regression
  tests over the existing fixtures and the corpus smoke.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

Verified by probe (2026-08-03):

- The jig adapter is layout-opinionated: `scanSpecs` in `src/scan.mjs` skips
  non-directory entries and reads `<dir>/spec.md`, so flat `specs/<name>.md`
  yields zero specs; completion derives from `normStatus(data[statusProperty])`.
- `mystique/docs/superpowers/specs/*.md` are flat, dated design docs using **no
  YAML frontmatter**; the live onboarding smoke renders the card as "execution
  signal unsupported."
- **Corrected by the frame-critique on this ADR (2026-08-03):** an earlier probe
  used `awk` for **YAML** frontmatter only and reported the folder as
  status-less; in fact `grep -inE '^\s*\**status\**\s*:'` shows ~half the files
  carry a **prose** status line (`**Status:** Approved`,
  `Status: APPROVED (brainstorm)`), the rest none. But the correction that
  *matters* is semantic: those prose statuses are **design-review** states, not
  work-completion (see A2), so they are **not** a completion signal. The
  load-bearing driver for this ADR is therefore the **layout** variance (flat
  files → zero specs today) plus the fact that a project's status may be **absent
  or non-delivery** — which the completion-vocabulary rule (sub-decision 3)
  handles by resolving such artifacts to `unknownStatus`. Prose-status
  *extraction* is **deferred, not shipped** (sub-decision 2 / A1): the corpus has
  no project encoding a *delivery* status in prose, so building a `statusSource:
  prose` extractor would be driverless. (This bullet supersedes an earlier draft
  of this ADR that wrongly called prose-status in-scope — reconciled here to match
  the decision body.)
- profile-v1 already carries `specsDir` / `decisionsDir` / `statusProperty`
  (`schemas/project-profile-v1.schema.json`) and a runtime validator agreeing
  with the schema (`src/profile.mjs`); adding `specLayout` and `statusSource` are
  additive fields, the same shape 007-02 used to add `entries[]`.
- No new runtime dependency is needed: Markdown walking + frontmatter parsing
  already exist (`src/lib.mjs`, `src/scan.mjs`), so ADR-0001 holds. Prose-status
  is a line-scan of the same read; no library.

Unverified — carried, not asserted:

- **A1 (breadth of real non-jig conventions).** The corpus evidences one real
  **layout** variance (flat vs nested) and the fact that a status string may be a
  non-delivery vocabulary. Other encodings exist in principle (delivery status in
  prose or a badge/checkbox, `specifications`/`rfcs` folder names, non-Markdown
  specs) with **no** real driver yet; those stay out of scope as future
  `specLayout` values, a `statusSource` enum, or a declarable completion
  vocabulary. (Narrows spec 007's A1 to the axis with a real driver — layout —
  plus the completion-safety rule the driver forced.)
- **A2 (design-approval ≠ work-completion — the load-bearing semantic).** The
  driver's prose `Status: Approved` / `APPROVED (brainstorm)` is a *design-review*
  state, not a delivery-completion state (the files are `*-design.md` with
  forward-looking `Refs:`/ticket links and "this work" framing). This ADR
  therefore does **not** map any such status to `done`; superpowers reports
  completion `unknown`. The general rule — completion only from a recognized
  delivery vocabulary, else `unknownStatus` — is what keeps this correct for any
  future foreign-status project.
- **A3 (auto-detect ambiguity).** `specLayout: auto` assumes nested-vs-flat is
  cleanly detectable (a `specs/` dir of sub-dirs-with-`spec.md` vs. a dir of
  `*.md` files). A mixed folder is possible; MVP resolves ties toward the explicit
  per-entry override and, absent one, prefers `nested` when any `<dir>/spec.md`
  exists. Exercised by fixtures.

## Kill criteria

- If the delivery-vocabulary gate (sub-decision 3) proves impossible to define
  crisply — real projects routinely blur design-approval and work-completion in
  one status field, so "recognized delivery vocabulary" can't be drawn without
  guessing — then generic completion is untrustworthy and the adapter should
  report `unknown` for any non-preset source, shrinking the recast to the layout
  axis alone (much closer to Option A).
- If the tier-2 card gate cannot keep a plain / empty declared root from
  producing a card **without** re-introducing jig-specific heuristics as the
  primary signal, the "resolved-root-plus-matching-artifact" boundary is wrong
  and the reframe should shelve pending a better tracked-work signal.
- If, in practice, every non-jig project also uses jig's exact nested-`spec.md`
  layout (flat layout never actually occurs beyond superpowers), the `specLayout`
  generalization is over-built relative to Option A — the completion-safety rule
  would then be the only surviving justification for the recast.

## Open questions

- **Preset registry shape.** Whether presets live as a small in-code map
  (`{ jig: {...} }`) or as data (a `presets/` dir) — deferred to spec 008
  implementation; the in-code map is the presumed MVP.
- **Delivery-vocabulary definition.** The exact recognized token set for the jig
  preset — a **new allowlist** applied *over* the case-normalized status from
  `normStatus` (which today defines no vocabulary of its own) — and whether
  projects may declare a custom completion vocabulary is a spec-008 slice concern.
  This ADR fixes only the *rule* (completion only from a recognized delivery
  vocabulary; foreign or absent → `unknownStatus`, never a guessed completion),
  and that the rule changes `progressOf`'s current denominator behavior.
- **Discovery emitting `specLayout`.** Whether 007-03's `discoverProfile` should
  *detect and emit* `specLayout` per entry (zero-touch onboarding of a flat
  project) is a spec-008 slice concern. The **completion** invariant (tier 1)
  does not depend on it; the tier-2 card gate for discovered roots does inherit
  discovery's conservatism (acknowledged in sub-decision 4).
- **Naming of the generic adapter.** Whether the module/identity is renamed
  (`docs` / `markdown-specs`) with `jig` as an alias, or stays `jig`-named
  internally with generic behavior. Cosmetic; resolved during spec 008 (default:
  keep `jig` as the preset name, generalize the module internals).
