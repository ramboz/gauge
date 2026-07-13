# Release Plan: Gauge Follow-up 1 — Secure Small-Team Hosting

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user decision.

## Problem / Baseline

- The local MVP is private by topology but cannot be reached safely away from the owner's machine or shared with a small trusted team; an unguessable URL is not access control.

## Appetite

- TBD — owner to set after the local MVP is used; fixed scope is one owner plus active members of one configured GitHub organization team.

## Solution Outline

- Host the existing Gauge view behind GitHub App sign-in, authorize one owner and active members of one configured GitHub organization team, retain central private state, and run scheduled collection with separate least-privilege read access to selected repositories.

## Risks / Rabbit Holes

- Private portfolio leakage through static hosting, logs, build artifacts, stale team authorization, or over-broad tokens; retire with a security review, explicit data classification, server-side membership checks, and end-to-end access tests.

## No-Gos

- No custom user directory, Gauge-managed roles, multiple organizations or teams, team-specific portfolio views, write-back actions, public dashboard mode, multi-repository project model, or concurrent goals.
## Cutline

### Include

| Item | Evidence | Rationale |
|---|---|---|
| GitHub App sign-in for one owner and one configured team | Owner security and sharing requirement | Replaces local-only topology with real access control and the smallest useful collaboration boundary. |
| Server-side active-team membership authorization | GitHub team membership contract | Reuses GitHub as identity and group authority without creating Gauge accounts or roles. |
| Private portfolio data delivery | MVP snapshot contract | HTML, JSON, and historical observations share the same protected boundary. |
| Least-privilege scheduled collector | MVP daily loop | Keeps data current without exposing broad repository credentials. |
| Local-mode fallback | MVP behavior | Hosted availability must not remove the simple private local path. |
| Security and architecture review evidence | New external trust boundary | Hosting cannot ship on functional tests alone. |

### Defer

| Item | Evidence | Rationale |
|---|---|---|
| Multiple organizations, multiple teams, and Gauge-managed roles | Later organization release | One configured GitHub team is the complete sharing boundary. |
| Team administration or membership mutation | GitHub authority boundary | Gauge reads membership; GitHub remains its owner. |
| Per-user or per-team portfolio views | Product expansion | Every authorized user sees the same Gauge portfolio in this release. |
| Public or unlisted-link mode | Security no-go | Unguessability is not authorization. |
| Source write-back and workflow actions | Gauge boundary | Hosting does not authorize mutation. |
| Multi-repository projects and concurrent goals | Long-term model | Independent of secure delivery. |

### Split

| Item | Evidence | Rationale |
|---|---|---|
| GitHub App authentication/authorization contract | New ADR | Define login, server-side session handling, configured org/team identity, and membership revalidation before choosing hosting. |
| Collector credential path | Security-focused slice | Separate repository reads from UI-session authorization. |
| Protected UI/data delivery | End-to-end hosted slice | User-visible value must land with access tests, not as isolated infrastructure. |

### Risk-First

| Item | Evidence | Rationale |
|---|---|---|
| Prove GitHub App team authorization with the target organization | Team visibility and organization policy vary | Validate read-only `Members` permission, private-team visibility, active-membership handling, and revocation before committing the hosted design. |
| Threat model tokens, snapshots, logs, and build artifacts | Private portfolio context | Identify every disclosure path before platform commitment. |
| Test unauthenticated denial end to end | Core release promise | A hidden URL or client-only check must not pass. |
| Test removed-team-member denial | Team access promise | Cached sessions must not turn revoked GitHub membership into durable Gauge access. |

## JIG Handoff

- Draft only after the local MVP ships and its code/state boundary is proven.
- Set `security_review: true` and `arch_review: true` on hosted slices where supported by the Gauge/Jig workflow.
- Record the GitHub App, hosting, session, and membership-revalidation choices in an ADR before implementation.
- No Servo signals are required; release-check criteria are security and access evidence.

## Release-Check Criteria

- An unauthenticated or unauthorized GitHub user cannot retrieve HTML, JSON, snapshots, project names, deadlines, or blockers.
- The owner and an active member of the configured GitHub team can authenticate and view the same portfolio state as the local MVP.
- Removing a user from the configured team denies access within the documented revalidation window without a Gauge-side user change.
- Collector credentials are least-privilege, scoped to selected repositories, and absent from logs and generated data.

_Last shaped: 2026-07-13_
