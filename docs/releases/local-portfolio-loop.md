# Release Plan: Gauge MVP — Local Portfolio Loop

## Status

`shipped` — closed out 2026-08-19. The complete local pull portfolio loop was
delivered: curated goal/deadline onboarding (ADR-0011), history-derived
forecast/risk (ADR-0012), and the cross-project attention queue (ADR-0013) —
spec 009 all DONE. Superseded and extended by the `manager-dashboard-local-data`
and `thin-client-and-central-collection` releases (both shipped). Status
corrected from a stale `committed`: the loop had long since shipped, but the
unflipped status made Gauge pick this as its "active milestone" and read 100%
milestone-progress beside a behind-pace whole-project forecast (dogfood finding,
2026-08-19).

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- The inherited POC gives one person a useful local view of Jig projects, but it has no project-owned goals/deadlines, central daily history, confidence-aware risk, or cross-project attention policy.

## Appetite

- Maximum two weeks from implementation start.
- Fixed constraints: deliver one complete private daily portfolio loop across at least three configured single-repository projects; preserve read-only source access, central observations/history, source-owned goals, explicit unknown states, and explainable recommendations.
- Variable scope: visual polish, the number of source-specific progress strategies, historical analysis beyond retaining daily observations, and forecast sophistication. Cut these before extending the appetite; a simple evidenced rule or `unknown` is acceptable where a trustworthy forecast is not.

## Solution Outline

- A private local Gauge instance for one person, one repository and one active goal per project: central registry/history, curated goal/deadline profile authoring (ADR-0011) plus Jig execution adapter, manual pull collection, project cards with progress/freshness/risk, and an explainable global next-action queue. (The generic GitHub milestone adapter is deferred with hosted/GitHub-push collection.)

## Risks / Rabbit Holes

- False precision: retire by keeping source-specific progress strategies, unknown states, provenance, and confidence labels.
- Authority drift: retire by keeping goals/deadlines/lifecycle in projects while Gauge owns only observations and cross-project attention policy.
- Bug 001 restored the missing worktree fixture; the POC baseline is green at
  29 of 29 tests before retrofit implementation. Spec 004's Gauge core and
  central-state retrofit is green at 64 tests after independent compliance,
  craft, and architecture review.

## No-Gos

- No hosted UI, multi-user auth, GitHub teams/orgs, multi-repository projects, concurrent goals, source-repo writes, Servo adapter, custom metrics, notifications, or lifecycle mutation.
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Gauge identity and adapter-driven core | ADR-0003 + spec 004 | Reframes the working POC without discarding proven behavior. |
| Private central registry and observation history | Owner decision + ADR-0003 | Enables daily trends without writing to source repositories. |
| One repository and one active goal per project | Owner-approved MVP cut | Keeps identity and goal selection deterministic. |
| Curated goal/deadline authoring into the project profile | ADR-0011 + spec 009-01 | A human-curated onboarding step authors goal/deadline (from vision/release/README hints) into the per-project profile; the zero-dep runtime reads literals. Supplies a project-owned goal/due date without a GitHub dependency. |
| Jig execution adapter | Working POC + issue #91 | Preserves high-fidelity spec, bug, decision, and workstream signals. |
| Manual pull collection into the Gauge repository | Owner-approved central commit model + owner decision (2026-08-05) | Produces durable velocity/history observations in one private place; runs are manually triggered (`npm run collect`). Automated daily scheduling is deferred (below). |
| Project cards: progress, freshness, blockers, risk, next action | Gauge vision | Completes the per-project daily decision loop. |
| Explainable global attention queue | Owner decision + ADR-0003 frame-critique resolution | Provides both status and recommended priority without pretending work units are comparable. |
| Local loopback-only UI and secret-safe snapshots | MVP security boundary | Keeps the first usable release private without hosted-auth scope. |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Authenticated hosting | Follow-up 1 | Requires a new trust boundary and dedicated security review. |
| Generic GitHub milestone goal adapter | ADR-0011 + owner decision | Deferred with hosted/GitHub-push collection: reading GitHub for goals should arrive together with reading it for progress, not before. The MVP uses curated profile authoring instead (Include row above). |
| Automated daily scheduling (unattended runs) | Owner decision (2026-08-05) — spec 009 overview | The MVP collects on a manual trigger (`npm run collect`); a local scheduler / cron is a thin follow-up (the "Daily collection" refinement-todo item). |
| Shaper and Servo adapters, evolution graphs, custom metrics | Follow-up 2 | Valuable after the normalized core and history are proven. |
| GitHub teams/org authorization | Long-term vision | Multi-user policy is unnecessary for the first user. |
| Multi-repository projects and concurrent goals | Long-term vision | Explicitly excluded by the owner-approved MVP topology. |
| Sessions panel / PR badges | Retired spec 003 | Expands the old local-viewer frame rather than proving Gauge's portfolio loop. |
| Notifications, write-back, lifecycle mutation | Gauge no-go | Would turn an observer into a control plane before trust is established. |
| Advanced velocity models, predictive analytics, and extra progress strategies | Two-week appetite | Retain observations and honest unknowns; sophistication can follow after real usage. |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Runtime reframe | Spec 004 | Landed: the adapter/state boundary now produces one visible local Gauge path. |
| Observation/history contract | ADR-0005 retaining ADR-0004 | Landed: schema, versioning, authority, and collection mechanics are explicit. |
| Goal and execution adapters | Emergent work from ADR-0003 | Generic GitHub and Jig can land independently behind the same contract. |
| Risk and attention policy | ADR-0003 frame-critique resolution | Keep portfolio ranking explicit and independently testable. |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Restore a trustworthy baseline | Bug 001 resolved; `node --test` passes 29 of 29 | Do not retrofit against a falsely green or unexplained baseline. |
| Preserve upstream attribution under the MIT license | Owner confirmation + `LICENSE` + spec 004 evidence | Permission is verified; keep the inherited POC provenance explicit as Gauge evolves. |
| Prove source-owned goal/date availability on three real projects | ADR-0003 release gate | Forecasting must not be designed around hypothetical signals. |
| Prove no source-repository writes | ADR-0003 authority boundary | Central history is the most important behavioral correction. |
| Threat-model central snapshots and credentials | Private portfolio data | Prevent secrets or private project context from entering committed observations. |
| Review the cutline at the end of week one | Two-week appetite | Preserve enough time to finish the complete vertical loop rather than carrying several partial subsystems into week two. |

## JIG Handoff

- [ADR-0003](../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md): accepted after frame critique; its runtime reframe dispositions landed through spec 004.
- [Spec 004](../specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md): reviewed runtime retrofit, optional Jig adapter, normalized observations, and central-state seam.
- New JIG work to draft after the retrofit: curated goal/deadline profile authoring (spec 009-01, ADR-0011), forecast/risk and attention policy and UI (spec 009-02/03). Daily scheduling and the generic GitHub milestone adapter are deferred (manual pull collection for the MVP; milestone lands with hosted/GitHub-push collection).
- No Servo signals were found or required; release-check criteria remain deterministic and advisory.

## Release-Check Criteria

- Three real configured projects complete a daily collection with no source-repository writes and explicit freshness/provenance.
- Each project has one source-owned goal; missing deadlines render unknown, while readable dates produce explained confidence-aware risk.
- The global queue explains its deterministic ordering and does not require comparable slice/issue sizes.
- No secrets enter snapshots; the local server binds to loopback; the full test suite is green.

_Last shaped: 2026-07-13_
