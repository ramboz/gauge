# Release Plan: Gauge MVP — Local Portfolio Loop

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- The inherited POC gives one person a useful local view of Jig projects, but it has no project-owned goals/deadlines, central daily history, confidence-aware risk, or cross-project attention policy.

## Appetite

- Maximum two weeks from implementation start.
- Fixed constraints: deliver one complete private daily portfolio loop across at least three configured single-repository projects; preserve read-only source access, central observations/history, source-owned goals, explicit unknown states, and explainable recommendations.
- Variable scope: visual polish, the number of source-specific progress strategies, historical analysis beyond retaining daily observations, and forecast sophistication. Cut these before extending the appetite; a simple evidenced rule or `unknown` is acceptable where a trustworthy forecast is not.

## Solution Outline

- A private local Gauge instance for one person, one repository and one active goal per project: central registry/history, generic GitHub milestone plus Jig adapters, daily collection, project cards with progress/freshness/risk, and an explainable global next-action queue.

## Risks / Rabbit Holes

- False precision: retire by keeping source-specific progress strategies, unknown states, provenance, and confidence labels.
- Authority drift: retire by keeping goals/deadlines/lifecycle in projects while Gauge owns only observations and cross-project attention policy.
- Existing POC baseline has one failing fixture test; diagnose and restore a green baseline before retrofit implementation.

## No-Gos

- No hosted UI, multi-user auth, GitHub teams/orgs, multi-repository projects, concurrent goals, source-repo writes, Servo adapter, custom metrics, notifications, or lifecycle mutation.
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| Gauge identity and adapter-driven core | ADR-0003 + spec 004 | Reframes the working POC without discarding proven behavior. |
| Private central registry and observation history | Owner decision + ADR-0003 | Enables daily trends without writing to source repositories. |
| One repository and one active goal per project | Owner-approved MVP cut | Keeps identity and goal selection deterministic. |
| Generic GitHub milestone goal adapter | No-hard-dependency principle | Supplies a project-owned goal/due date without requiring Jig or Shaper. |
| Jig execution adapter | Working POC + issue #91 | Preserves high-fidelity spec, bug, decision, and workstream signals. |
| Daily collection into the Gauge repository | Owner-approved central commit model | Produces durable velocity/history data in one private place. |
| Project cards: progress, freshness, blockers, risk, next action | Gauge vision | Completes the per-project daily decision loop. |
| Explainable global attention queue | Owner decision + ADR-0003 frame-critique resolution | Provides both status and recommended priority without pretending work units are comparable. |
| Local loopback-only UI and secret-safe snapshots | MVP security boundary | Keeps the first usable release private without hosted-auth scope. |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Authenticated hosting | Follow-up 1 | Requires a new trust boundary and dedicated security review. |
| Shaper and Servo adapters, evolution graphs, custom metrics | Follow-up 2 | Valuable after the normalized core and history are proven. |
| GitHub teams/org authorization | Long-term vision | Multi-user policy is unnecessary for the first user. |
| Multi-repository projects and concurrent goals | Long-term vision | Explicitly excluded by the owner-approved MVP topology. |
| Sessions panel / PR badges | Retired spec 003 | Expands the old local-viewer frame rather than proving Gauge's portfolio loop. |
| Notifications, write-back, lifecycle mutation | Gauge no-go | Would turn an observer into a control plane before trust is established. |
| Advanced velocity models, predictive analytics, and extra progress strategies | Two-week appetite | Retain observations and honest unknowns; sophistication can follow after real usage. |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| Runtime reframe | Spec 004 | Land the adapter/state boundary as one visible local Gauge path. |
| Observation/history contract | Emergent work from ADR-0003 | Separate schema/authority decision from collection mechanics. |
| Goal and execution adapters | Emergent work from ADR-0003 | Generic GitHub and Jig can land independently behind the same contract. |
| Risk and attention policy | ADR-0003 frame-critique resolution | Keep portfolio ranking explicit and independently testable. |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Restore a trustworthy baseline | Existing `node --test` result: 28 pass / 1 fixture failure | Do not retrofit against a falsely green or unexplained baseline. |
| Confirm POC permission/license | ADR-0003 assumption | Blocks public redistribution even though private shaping can continue. |
| Prove source-owned goal/date availability on three real projects | ADR-0003 release gate | Forecasting must not be designed around hypothetical signals. |
| Prove no source-repository writes | ADR-0003 authority boundary | Central history is the most important behavioral correction. |
| Threat-model central snapshots and credentials | Private portfolio data | Prevent secrets or private project context from entering committed observations. |
| Review the cutline at the end of week one | Two-week appetite | Preserve enough time to finish the complete vertical loop rather than carrying several partial subsystems into week two. |

## JIG Handoff

- [ADR-0003](../decisions/adr-0003-reframe-onto-gauge-portfolio-product.md): accepted after frame critique; execute its retire/amend/rewrite dispositions before implementation.
- [Spec 004](../specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md): runtime retrofit and central-state seam.
- New JIG work to draft after manifest execution: observation/history contract, generic GitHub goal adapter, Jig adapter, daily collector, risk/attention policy and UI.
- No Servo signals were found or required; release-check criteria remain deterministic and advisory.

## Release-Check Criteria

- Three real configured projects complete a daily collection with no source-repository writes and explicit freshness/provenance.
- Each project has one source-owned goal; missing deadlines render unknown, while readable dates produce explained confidence-aware risk.
- The global queue explains its deterministic ordering and does not require comparable slice/issue sizes.
- No secrets enter snapshots; the local server binds to loopback; the full test suite is green.

_Last shaped: 2026-07-13_
