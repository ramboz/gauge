---
slice: 010-01 — entry-level goal/deadline
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T16:57:48Z
prompt_source: review.py arch-review
---

VERDICT: pass

Widening is additive and backward-compatible: goal/deadline live in $defs, $ref'd from both top-level and entries[], single-sourced and drift-proof — no version bump warranted. Validator reads enums/patterns from PROFILE_SCHEMA.$defs.* (lockstep). Config expansion is the only normalization seam touched. Read/derive boundary genuinely untouched — join/forecast key off each normalized project's profile, and expanded entry-projects are ordinary single-entry projects downstream. Coherent extension of ADR-0009 D2 + ADR-0011, not a departure.

NITS / OPEN QUESTIONS (non-blocking, for reconciliation):
- docs/architecture.md:180-183 — Contract surfaces describes entries as (id,label,artifactRoot+overrides) and attributes goal/deadline only to the profile; does not yet note entries may carry their own goal/deadline with parent fallback. Recommend flipping the sweep row to `updated` and adding the clause.
- Inheritance semantics: a single parent deadline inherited across sibling tracks yields a separate per-track forecast against a shared date — defensible and consistent with every other entry-field fallback, but a shared umbrella deadline may read as misleading precision. Log as a deliberate consistency choice.
- ADR disposition: a NEW ADR is excessive (composes two accepted decisions additively); a one-line amendment note on ADR-0009 is the right weight. ADR-0011's authoring policy is untouched.
