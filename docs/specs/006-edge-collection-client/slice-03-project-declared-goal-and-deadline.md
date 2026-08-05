---
status: DEFERRED
dependencies: [adr-0003, 006-02]
last_verified: 2026-08-03
frame_review: true
---

## Slice 006-03 — Project-declared goal and deadline

**Goal:** An onboarded project declares its own active goal and deadline in its
own config; the client reports them as part of its observation, and the card shows
a goal/deadline sourced from the project itself — honoring project authority and
sidestepping central goal-guessing for the push path.

**DoR:**
- Slice 006-02 (trigger and authenticated push) is DONE.
- [ADR-0003](../../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)
  authority model: projects own goals and deadlines; Gauge records their
  observation and provenance and never becomes a second lifecycle authority.
- The observation-v1 signal used to carry goal/deadline is confirmed (existing
  capability signal vs. a new typed signal decided during shaping); if new, it is
  an additive, independently versioned signal per ADR-0004/0005.

**Acceptance Criteria:**

1. **Project-owned declaration.** The project declares an active goal and an
   optional deadline in its own client config within its repository; Gauge never
   writes this back.
2. **Reported as observation.** The client includes the declared goal/deadline in
   its emitted record with provenance pointing at the project's own config, at the
   correct capability signal type/version.
3. **Missing stays unknown.** A project that declares no deadline yields `unknown`
   deadline confidence downstream — never a fabricated `on_track`/`at_risk` or a
   zero (ADR-0003).
4. **Card render.** The project card shows the declared goal and, when present, the
   deadline with its source attributed to the project.
5. **No central guessing on this path.** For push-onboarded projects the declared
   value is authoritative; central does not infer a competing goal from milestones
   for the same project.
6. **Verification.** `node --test` covers a declared goal+deadline round-tripping
   into the card, the no-deadline→unknown path, provenance correctness, and the
   additive-signal contract (unknown to older readers, uninterpreted not rejected).

**DoD:**
- [ ] All ACs pass; full test suite green.
- [ ] Compliance and craft reviews pass.
- [ ] Deviation log and reconciliation sweep complete; the goal-source resolution
      is reflected in refinement-todo (generic goal/deadline source), architecture
      doc, and status board.

**Anti-horizontal-phasing check:** after this slice a project sets its own goal and
deadline and sees them on its Gauge card, sourced from the project — the authority
model is visible end to end for the push path.

**Resolution trigger:** when hosted auth / GitHub-push collection is tackled. The
committed MVP collects goal/deadline via the pull-model onboarding-authoring path
decided in [ADR-0011](../../decisions/adr-0011-goal-deadline-source-strategy.md) and
built in spec 009-01; this push-path variant re-opens with the GitHub-push follow-up.
