---
adr: 0011
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2nd pass)
reviewed_at: 2026-08-05T17:16:51Z
prompt_source: review.py frame-critique docs/decisions/adr-0011-goal-deadline-source-strategy.md
---

VERDICT: pass

Second-pass frame-critique on the revised ADR-0011. The first pass returned
needs-changes; the author revised in response.

Resolved:
- PRIMARY (spec-007-analogy / ADR-0001): extraction relocated to a human-curated
  author-time onboarding step (a skill, optionally Claude-assisted) that writes
  literal goal/deadline values into the profile. The zero-dep runtime reads only
  literals and never parses prose, so the ADR-0001 collision is dissolved. Option B
  now rejected on exactly this ground.
- SECONDARY (deadline=unknown undercuts motivation): deadline is operator-committed
  at onboard time; appetite is only a hint; unknown is honest correct behavior. Holds
  because the single-user MVP collapses operator and project-owner into one person.
- TERTIARY (authority boundary): argued explicitly — profile is gauge-side state;
  source stays authoritative because re-onboard defers to it.

Residual (non-blocking, for 009-01, not frame defects):
- The re-onboard-defers-to-source authority argument is solid for goals but thin for
  deadlines (corpus carries only relative appetite; no source date to defer to). Holds
  only under the single-user MVP; would strain in the multi-user follow-up tier. Spec
  should not lean on that argument for deadlines.
- Disambiguate deterministic `npm run onboard` (discover.mjs) from the assisted
  goal-hint authoring step in 009-01 so the zero-dep line stays crisp. (Addressed in
  the ADR Consequences post-verdict.)

Reconciliation notes carried to the deviation log: cutline reversal (GitHub milestone
Include -> deferred) vs local-portfolio-loop.md and product-vision.md; refinement-todo
"Generic goal and deadline source" reframing (milestone-vs-config -> curated authoring);
interim deadline mechanism is operator-committed pending the deferred project-owned
target_date field.
