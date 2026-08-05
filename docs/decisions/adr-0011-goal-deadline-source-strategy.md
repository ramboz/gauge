---
status: Accepted
dependencies: [adr-0003, adr-0005, adr-0009]
last_verified: 2026-08-05
frame_review: true
---

# ADR-0011: Goal and deadline source strategy for the local pull loop

## Status

Accepted (2026-08-05)

## Context

The local pull MVP still lacks the input every downstream layer depends on: a
per-project **goal** and **deadline**. Forecast/risk (the ADR-0006 history-derived
layer) cannot say `on_track` or `at_risk` without a target date, and the attention
queue cannot order projects without goals. So before drafting the derivation and
presentation slices, gauge needs a decided answer to *where a project's goal and
deadline come from* — the "Generic goal and deadline source" item parked in
`docs/refinement-todo.md`.

The committed MVP originally named a **GitHub milestone** as the generic goal
adapter. That choice is now in tension with the near-term plan: specs 005/006
(authenticated ingest + edge push) are being deferred until a hosting/auth trust
boundary is warranted, and reading GitHub for *goals* would pull a GitHub
dependency into the local loop before we read GitHub for *progress* — the two
should arrive together, not split.

The corpus this loop runs against is local jig/shaper repositories (the standing
reference set in `docs/inbox.md`). In those repos the relevant intent is already
written down, but split across artifacts and expressed as **free narrative
prose**: the goal lives in a jig `docs/product-vision.md` (as Vision / Core
problem paragraphs, not a labelled `Goal:` field); the committed target lives in a
shaper `docs/releases/*.md` (often as a *relative* appetite — "maximum two weeks
from start" — not an absolute date); a plain repo may only have a `README`. No
single artifact carries both, and none carries either as a machine-readable field.

Two boundaries constrain the answer:

1. **ADR-0003/0005 — source projects own goals.** Gauge observes read-only and
   must never write goals back into a source repo.
2. **ADR-0001 — zero runtime dependencies, no runtime LLM.** The shipped
   collector (`npm run collect`) is a deterministic zero-dep reader. It **cannot**
   semantically extract "the goal" from a 100-line vision narrative; that is a
   prose-comprehension problem with no deterministic zero-dep answer.

The resolution turns on *who* does the extraction and *when*. Spec 007 (ADR-0009)
established the pattern for the deterministic half — introspect a source's
*structure* (where specs live, nested-vs-flat) once and write a per-project
**profile** (`schemas/project-profile-v1.schema.json`) the runtime reads. Goal and
deadline are **not** deterministically extractable the way structure is, so they
cannot ride `discover.mjs`'s line scanner. But they do fit the same *profile*
seam if the extraction moves to a **human-curated onboarding step** (a skill,
assisted by reading the vision/release/README as hints) that authors **literal**
goal and deadline values into the profile. The runtime then reads those literals
— never the prose. Author-time comprehension (a human, optionally Claude-assisted)
is where ambiguous prose is resolved; runtime stays deterministic and zero-dep.

## Decision Options Considered

### Option A: GitHub milestone as the primary source now
- **Pros:** matches the original MVP cutline; gives an explicit due date when a
  milestone is set; no new extraction code.
- **Cons:** requires reading GitHub for goals before reading it for progress,
  splitting the GitHub integration; the local jig corpus does not reliably set
  milestones, so most projects would have no goal at all; couples the goal layer
  to the deferred auth/push work (specs 005/006). Rejected — deferred *with* the
  rest of the GitHub/push integration.

### Option B: Deterministic runtime extraction from source prose on every collection
- **Pros:** always reflects the latest source text; nothing cached to go stale.
- **Cons:** the goal/deadline are free prose with no machine-readable field, so a
  zero-dep line scanner would mis-extract on nearly every project — and under
  ADR-0001 there is no runtime LLM to do better. It also leaves the user **no seam
  to correct a mis-extraction** short of editing the source repo, which the
  authority boundary forbids gauge from doing. Rejected — the extraction cannot
  live in the deterministic runtime.

### Option C (recommended): Human-curated onboarding authors literal values into the profile; runtime reads literals; GitHub deferred
- **Pros:** puts prose comprehension where it belongs — a **human-curated
  onboarding step** (a skill, optionally Claude-assisted) that reads the
  vision/release/README as *hints* and authors **literal** goal + deadline values
  into the profile. The zero-dep runtime only reads those literals, so ADR-0001
  holds and no source is ever written. The curation seam is intrinsic (the values
  are authored, then reviewed), not a patch over a flaky extractor; a re-onboard
  re-proposes from the source hints. Deadline is whatever the user commits, so it
  is a real date wherever the user sets one — not hostage to prose parsing.
- **Cons:** authored values can lag the source between re-onboards (provenance
  marker + "re-onboard to refresh" is the mitigation); the profile schema grows
  goal/deadline fields; onboarding is a human-in-the-loop step, not fully
  automatic (acceptable — it runs once per project, not per poll).

### Option D: A dedicated gauge-side goal file, or a single fixed source
- **Pros:** simplest contract; one place to look.
- **Cons:** a bespoke gauge-side goal store re-implements a goal home gauge is not
  supposed to own; a single fixed source can't cover a corpus that splits goal
  (vision) from deadline (release). The profile already *is* the gauge-side
  per-project config home (ADR-0009) — reuse it rather than invent a parallel file.
  Rejected.

## Recommended Decision

Adopt **Option C**. Goal and deadline are authored into the per-project profile by
a **human-curated onboarding step**, and read verbatim as literal values by
regular `npm run collect`. The runtime never parses source prose.

The onboarding step surfaces candidate values from these artifacts, in this
precedence order, as **hints** the user confirms or overrides:

- **Goal:** jig `docs/product-vision.md` → `README` fallback.
- **Deadline / target:** shaper `docs/releases/*.md` committed target date →
  (later, deferred) GitHub milestone due date.
- **Fallback:** `README` for either field when nothing better is found.

Each field carries a **provenance marker** (which artifact seeded it, or
`user` when hand-set). The values are **authored, then user-curated**: onboarding
proposes, the user reviews/edits in the profile, and a re-onboard re-proposes from
the source hints (never silently overwriting a hand-edit). Gauge never writes goals
or deadlines back to a source repository — the profile is gauge-side instance state
(ADR-0005), and the *operative* goal being editable in gauge does not make gauge
its owner: the source remains the authority a re-onboard defers to.

**The machine never infers a deadline from appetite prose.** A relative appetite
("maximum two weeks from start") is shown to the user as a hint, but the committed
deadline is whatever the **user enters** at onboard time; if the user sets none,
the deadline is `unknown` — never a value the collector computed from prose. So a
project has a real target date exactly when someone committed one, and forecast/risk
(009-02) honestly returns `unknown` for projects that have not — which is correct
behavior, not a gap. This stays clear of the separate "Shaper target date"
decision (a project-owned `target_date` field), which this ADR does not resolve.

**GitHub milestone is deferred**, to land as an additional deadline hint together
with GitHub *progress* collection under the same auth/push work that parks specs
005/006 — the two GitHub reads should arrive together, not split.

## Consequences

**Becomes easier:**
- Forecast/risk (009-02) and the attention queue (009-03) get a defined,
  provenance-bearing goal+deadline input without waiting on any auth boundary.
- The onboarding story stays uniform in its *output*: deterministic shape
  discovery (`discover.mjs`, which can only point at the artifact) and the
  curated goal/deadline authoring (the assisted step that forms candidate values)
  are distinct mechanisms, but both land in the one per-project profile the
  runtime reads. The exact seam between them is 009-01's to draw.
- Correcting a bad extraction is a profile edit the user owns — no source write,
  no re-run gymnastics.

**Becomes harder:**
- Authored goal/deadline can lag the source between re-onboards; the provenance
  marker and a "re-onboard to refresh" affordance are the mitigation, not
  live re-derivation.
- The profile schema grows goal/deadline fields (an additive v1 change; the
  concrete shape is 009-01's to specify).
- Onboarding is a human-in-the-loop step, not fully automatic; that is the price
  of not shipping a prose extractor into the zero-dep runtime.

**Cutline change to log (reconciliation):**
- This reverses a committed-release choice: `docs/releases/local-portfolio-loop.md`
  and `docs/product-vision.md` list the **generic GitHub milestone** goal adapter
  under *Include*. ADR-0011 defers it in favour of curated artifact-hint authoring.
  The release plan and vision must be reconciled to reflect this (a spec-009
  reconciliation task), not left as an implicit contradiction.
- The `docs/refinement-todo.md` "Generic goal and deadline source" item frames the
  choice as *milestone vs repo config vs both* — it does not contemplate the
  curated-authoring option actually chosen here. `resolve-todo` must record that
  the decided answer reframes the question.

## Assumptions

- Jig projects carry `docs/product-vision.md` and shaper projects carry
  `docs/releases/*.md` — verified in this repo (`docs/product-vision.md` exists;
  `docs/releases/local-portfolio-loop.md` carries an `## Appetite` of "Maximum two
  weeks from implementation start"), and these are jig/shaper scaffold defaults.
- The goal/deadline are **free prose with no machine-readable field** (confirmed:
  `product-vision.md` has Vision/Core-problem paragraphs, no `Goal:` field; the
  release states a *relative* appetite, not a date). This is why extraction is a
  human-curated onboarding step, not a runtime scan — the load-bearing claim the
  frame rests on, and the reason Option B is rejected.
- The per-project profile (`project-profile-v1`) is gauge-side instance state, not
  a source artifact, so authoring goal/deadline there does not cross the ADR-0005
  source/state isolation boundary; source authority is preserved because a
  re-onboard defers to the source hints.

## Kill criteria

- If the corpus shows goal *and* deadline reliably present as machine-readable
  fields in a single artifact, the human-curated step is overkill — a deterministic
  runtime read (Option B) becomes viable and preferable.
- If, in practice, projects reliably declare an explicit `target_date` (the
  separate Shaper-target-date decision resolves affirmatively), the deadline hint
  layer collapses to reading that field directly.

## Open questions

- The exact profile field shape (goal text, deadline date, per-field provenance)
  is 009-01's to specify; this ADR fixes the sources and precedence, not the schema.
- A project-owned shaper `target_date` field (the separate "Shaper target date"
  refinement item) would give an explicit deadline instead of `unknown`; that
  decision is deliberately left open here.
