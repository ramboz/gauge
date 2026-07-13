---
status: Accepted
dependencies: []
last_verified: 2026-07-13
frame_review: true
---

# ADR-0003: Reframe project-dashboard onto Gauge portfolio product

## Status

Accepted (2026-07-13)

## Context

The fork began as `project-dashboard`: a local, zero-dependency viewer over
Jig-managed projects. Its accepted corpus makes local Jig artifacts, per-project
Compass journals, and direct reads of local Claude session files the product's
center. That POC proved the usefulness of cross-project cards, honest Jig
progress, workstream discovery, worktree-only warnings, and deterministic
parsing.

On 2026-07-13 the owner accepted a broader product direction after reviewing
Jig, Servo, Shaper, and [Jig issue #91](https://github.com/ramboz/jig/issues/91).
That direction is a moved load-bearing reference, not an additive feature: the
product is now **Gauge**, an independent portfolio observer whose sources may
include generic GitHub state, Jig, Shaper, Servo, or project-specific adapters.
Carrying the old premise forward would put portfolio history back into source
projects, treat a repository as inherently Jig-managed, and prioritize local
session inspection ahead of deadlines, risk, and cross-project attention.

### Authoritative reference: Gauge product direction — 2026-07-13

The following owner-approved statement is authoritative as of 2026-07-13:

- Gauge is a sibling product, not a Jig tier and not Shaper-across-repositories.
- The first user is one person. The MVP is private and local-first, with one
  repository and one active milestone or release per project.
- Goals and deadlines are project-owned. Gauge records their observations and
  provenance; it does not become a second lifecycle authority.
- Source projects are read-only. Gauge owns its registry, daily observations,
  history, forecasts, risks, and recommendations in a central private Gauge
  instance, never through mandatory writes to each source repository.
- Gauge owns the **cross-project attention policy** and an optional central
  portfolio-priority overlay because no individual project can author a global
  ordering. That overlay ranks observations; it never rewrites a project's
  goal, deadline, priority, or lifecycle state. A missing source-owned deadline
  remains `unknown` and cannot produce an `on_track` / `at_risk` forecast.
- The core is adapter-based and degrades gracefully. Jig, Shaper, and Servo are
  optional signal providers; generic projects remain valid Gauge projects.
- Progress, deadline risk, and priority recommendations are deterministic,
  evidence-backed, confidence-labelled, and explainable. Unknown or stale data
  is not rendered as healthy or zero.
- The MVP provides both per-project status/risk and a global recommended-next
  queue. It does not mutate source lifecycle state.
- Local loopback access is the MVP security boundary. An unguessable URL is not
  access control. Authenticated hosted use, GitHub organization/team access,
  multi-repository projects, and concurrent goals are long-term directions.
- Product code and instance state may coexist in one private repository for the
  MVP, but their boundary must permit a later public code repository with a
  separate private instance/state repository.

The old premise superseded by this ADR is: “a local read-only dashboard over
the owner's Jig projects, made persistent through Compass snapshots stored in
each surveyed project, with local Claude sessions as the next major expansion.”

## Decision Options Considered

### Option A: Grow the Jig dashboard by edge patches
- **Pros:** Smallest immediate code change; preserves every current artifact.
- **Cons:** Makes Jig and Compass accidental hard dependencies, distributes
  Gauge history across source repos, and leaves goals, deadlines, forecasting,
  and generic projects without a coherent authority model.

### Option B: Reframe the POC into Gauge
- **Pros:** Preserves the proven deterministic scanner/UI while introducing a
  clear portfolio boundary, central history, optional adapters, project-owned
  goals, and explainable risk/recommendation semantics.
- **Cons:** Requires retiring one unimplemented draft, superseding the Compass
  write contract, rewriting live prose, and retrofitting the shipped runtime.

### Option C: Start Gauge again from an empty repository
- **Pros:** No legacy naming or contract constraints.
- **Cons:** Discards working, reviewed code and the real-project findings that
  de-risked the first vertical slice; recreates already-solved parsing and UI
  work without changing the required product decisions.

## Recommended Decision

Choose **Option B**. The Gauge product direction above is authoritative as of
2026-07-13. Existing POC behavior is retained only where it fits that direction:
deterministic collection, read-only source access, tolerant ingestion, honest
progress, workstream pinning, worktree-only warnings, and a local single-page
UI. Portfolio authority, history, forecasts, risk, and prioritization move to
Gauge's central instance boundary. “Portfolio authority” is deliberately
narrow: Gauge owns membership, cross-project attention policy, and derived
observations; source projects continue to own their goals, deadlines, local
priority, and lifecycle state.

The MVP must validate the forecast and recommendation model against at least
three real configured projects with readable source-owned goals/deadlines before
claiming those capabilities as shipped. The recommendation queue may still rank
categorical evidence (explicit blocker, human-required action, in-progress work,
ready work) when a date is unavailable, but it must label deadline confidence
`unknown` and explain which policy produced the ordering.

## Re-baselining manifest

`retire-draft` entries come first so no new work is built on the superseded
Jig-dashboard premise. The manifest drafts work; normal ADR/spec lifecycles
execute it.

| Artifact | Disposition | Execution route and rationale |
|---|---|---|
| `docs/specs/003-sessions-panel/spec.md` and slices `003-01`–`003-03` | `retire-draft` | Transition the unimplemented draft slices to `ABANDONED`, preserving history. Local Claude-session inspection is not part of the accepted Gauge MVP; revisit only through a new Gauge-shaped spec if attention routing later proves it necessary. |
| `docs/decisions/adr-0002-compass-snapshot-contract.md` | `supersede` | Replace the mandatory per-project `docs/status/compass-history.jsonl` contract with a Gauge-owned, central, versioned observation/history contract. Project-local narrative exports may remain optional adapter inputs. |
| Shipped POC runtime and contract surface: `src/`, `public/`, `scripts/snapshot.mjs`, `package.json`, `dashboard.config.example.json`, and their tests | `retrofit` | Bring the existing dashboard runtime in line with the Gauge reference through [spec 004](../specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md). The current project-local writer must stop being the history authority; current Jig scanning becomes one adapter behind a normalized observation boundary. |
| `docs/decisions/adr-0001-runtime-zero-deps.md` | `reaffirm` | Node >=18, ESM, built-in tests, and zero runtime dependencies still fit the local-first MVP. Refresh `last_verified` and note this reframe; hosted authentication may later supply evidence to supersede it. |
| `docs/specs/001-adopt-jig/spec.md` and `slice-01-bootstrap.md` | `reaffirm` | Jig adoption remains true project history and remains Gauge's development workflow. Refresh verification and note the renamed product. |
| `docs/specs/002-dashboard-mvp/spec.md` and slices `002-01`–`002-03` | `amend` | Preserve the closed POC record. Add an amendment pointing to this ADR and spec 004; do not rewrite historical acceptance criteria as if Gauge had been the original scope. |
| `docs/product-vision.md` | `rewrite` | Replace Jig-dashboard positioning with the authoritative Gauge identity, target user, MVP, long-term direction, success criteria, and non-goals. |
| `docs/architecture.md` | `rewrite` | Replace the unfilled scaffold with Gauge's source/instance boundary, adapter model, normalized observations, central snapshots, derivation engine, and local/private delivery model. |
| `README.md` | `rewrite` | Make Gauge the front door; describe the current POC honestly during retrofit and point to the accepted direction. Preserve contributor credit. |
| `CLAUDE.md` | `rewrite` | Rename the primer, replace the old codename/active-work framing, and route the next session to the reframe ADR and retrofit spec. |
| `scaffold.json` | `rewrite` | Change project identity from `project-dashboard` to `gauge`; do not change Jig tier/runtime claims without separate evidence. |
| `docs/compass-integration.md` | `rewrite` | Turn the mandatory source-repo writer instructions into a legacy/migration note and optional adapter guidance after the central observation contract exists. |
| `docs/decisions/README.md` | `rewrite` | Regenerate the real ADR index; its “no ADRs yet” claim is already stale. |
| `docs/specs/README.md` | `rewrite` | Regenerate after draft retirement and spec 004 authoring; record the reframe in Notes rather than editing generated rows manually. |
| `docs/refinement-todo.md` | `rewrite` | Replace resolved/stale POC questions with Gauge decisions: instance-state separation, source adapters, deadline source mapping, risk confidence, recommendation policy, scheduled collection, and hosted authentication. |
| `docs/workflow.md` | `rewrite` | Preserve the Jig workflow; update product identity only. |
| `docs/adoption-readiness.md` | `rewrite` | Preserve the Jig onboarding guide; update project identity only. |
| `docs/conventions.md` | `rewrite` | Update project identity only, and only after explicit human approval required by this file's own contract. No convention rule changes are authorized by this ADR. |
| `docs/bugs/README.md` | `rewrite` | Regenerate or update the board identity to Gauge without changing bug semantics. |
| `docs/memory/glossary.md` | `rewrite` | Establish Gauge, adapter, observation, instance state, progress strategy, forecast confidence, and attention queue as project vocabulary. |

## Emergent work

These are new Gauge capabilities, not dispositions of pre-existing artifacts.
They should become separately shaped specs or ADRs after the keystone is
accepted and the manifest's draft retirement is executed:

1. Define the versioned normalized observation and central snapshot/history
   contract, including freshness, provenance, schema evolution, and retention.
2. Define project-owned goal/deadline adapters: generic GitHub milestone first,
   Jig execution state, and Shaper release/target-date mapping. Servo remains a
   later optional evaluation-signal adapter.
3. Define transparent progress strategies, historical velocity, deadline-risk
   confidence, and deterministic recommendation ranking, including the central
   cross-project attention policy/priority overlay and the rule that missing
   source dates stay `unknown`.
4. Add the daily collector that writes only to the private Gauge instance.
5. Add authenticated hosted delivery as a close follow-up; later extend access
   to GitHub organizations/teams and support multi-repository projects plus
   concurrent goals.

## Coverage floor

### Level 1 — whole corpus, class-level

| Artifact class | Coverage |
|---|---|
| `docs/decisions/` | `scanned` — README, ADR-0001, ADR-0002, and lightweight decisions read in full. |
| `docs/specs/` | `scanned` — specs 001–003, every slice, and the generated status board read in full. |
| Live prose under `docs/` | `scanned` — product vision, architecture, workflow, conventions, adoption readiness, Compass integration, refinement todo, inbox, bug board, and memory docs read in full. |
| `skills/*/SKILL.md` | `excused` — Gauge contains no project-owned skill contracts. Installed Jig skills are external tooling, not Gauge corpus. |
| Root primer(s) | `scanned` — `CLAUDE.md` read in full; no `AGENTS.md` exists. |
| Root `README` | `scanned` — `README.md` read in full. |
| Project metadata/config | `scanned` — `scaffold.json`, `package.json`, and `dashboard.config.example.json` read because this project has authority-bearing identity and runtime configuration outside the default Jig class list. |

The shipped code tree is intentionally outside the Level-1 authority-bearing
corpus floor. A targeted path/term probe identified the affected runtime
surfaces named in the `retrofit` row; spec 004 owns the full implementation
read and tests.

### Level 2 — artifact-level within touched classes

- **Decisions:** each decision artifact was read, then compared to the reference
  for runtime fit, source-of-truth ownership, and product coupling. ADR-0001
  survives; ADR-0002 encodes the dead distributed-history premise; the README
  is stale; lightweight decisions contain no affected entry.
- **Specs:** every spec and slice was read. Spec 001 is durable workflow history;
  spec 002 is closed POC history requiring an amendment; spec 003 is entirely
  unimplemented and expands the old local-session-viewer frame, so it is retired.
- **Live prose:** every listed file was read for product identity, audience,
  source authority, persistence, security, goals/deadlines, and future-work
  claims. Affected files appear individually in the manifest. `docs/inbox.md`,
  `docs/memory/learnings.md`, `docs/memory/tooling.md`, and
  `docs/decisions/lightweight-decisions.md` carry no substantive old-premise
  content and need no disposition beyond future mechanical identity hygiene if
  their scaffold headers are touched.
- **Primer/front door:** `CLAUDE.md` and `README.md` were read linearly; both
  encode the old name, Jig-only boundary, local-rescan model, Compass contract,
  and next-work ordering.
- **Project metadata/config:** the three files were read for name, runtime,
  state location, and repository assumptions. Identity/config changes are
  routed explicitly above.

**Method:** deterministic file listing established each class; full reads were
used for authority-bearing Markdown and config; targeted source-path and term
search identified shipped runtime surfaces without claiming a full code audit.

**Residual uncertainty:** this floor reduces and surfaces enumeration risk; it
does not eliminate it. A class judged untouched may contain an intra-class miss;
a read within a touched class may still miss an encoded premise; and a reviewer
could accept a weak excuse. Discovery after acceptance of a surviving
Jig-dashboard premise inside a class marked `scanned` is evidence that the
coverage method needs strengthening and must be recorded rather than silently
edge-patched.

## Consequences

**Becomes easier:**
- Supporting non-Jig projects without weakening Jig-specific fidelity.
- Keeping daily history and portfolio policy in one private, auditable place.
- Explaining progress, risk, freshness, and recommended attention from source
  evidence without creating a competing lifecycle authority.
- Ranking cross-project attention without pretending that project-local work
  units or priorities are inherently comparable.
- Evolving toward team/org use without placing that complexity in the MVP.

**Becomes harder:**
- Adapters must normalize heterogeneous sources without fabricating comparable
  units or false precision.
- Central collection needs explicit credentials and freshness/error semantics.
- The POC must be retrofitted before new portfolio features are layered on it.
- Product code and private instance state need a real boundary even while they
  coexist in one private MVP repository.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

- Reuse and redistribution rights for the forked POC are not established by a
  repository license visible in this checkout. Preserve attribution and obtain
  explicit permission or a license before redistributing derived code.
- A Shaper-owned deadline field does not exist in the reviewed Shaper artifact
  shape today; the adapter contract must be coordinated rather than inferred.
- The initial real-project set has not yet demonstrated three readable,
  source-owned deadlines. Forecasting stays unproven until the MVP release check
  exercises that fixture set; absent dates must remain `unknown` meanwhile.

## Kill criteria

_What would make this decision wrong? List the conditions that, if observed,
should reverse or shelve it. Risk-gated like Assumptions — write "None" or omit
when there is no meaningful kill condition; do not invent ceremonial ones._

- Evidence shows the actual need is only a Jig artifact viewer and generic,
  Shaper, deadline, or portfolio-level sources provide no durable value.
- Central history creates more security/maintenance burden than useful trend or
  forecasting evidence; in that case retain the current-state viewer and shelve
  velocity/forecasting rather than reintroducing writes to source repos.
- Deterministic progress/risk cannot be expressed honestly for the initial real
  projects without project-specific manual upkeep; narrow the MVP to sourced
  facts and recommendations until a workable progress strategy exists.
- Cross-project recommendations require so much central manual prioritization
  that Gauge becomes a second project-management authority; in that case keep
  the queue categorical/advisory or remove it rather than duplicating project
  state centrally.

## Open questions

- What exact permission or license will govern the inherited POC code?
- What project-owned field and semantics will Shaper use for `target_date`?
- Which generic GitHub artifact is the first non-Jig goal adapter: milestone,
  repository-configured goal, or both with explicit precedence?
- What minimum history and confidence threshold must exist before Gauge labels a
  project `on_track` or `at_risk` instead of `unknown`?
- What is the smallest central priority overlay that expresses genuine
  portfolio intent without duplicating project-local priority—ordered projects,
  coarse tiers, or deadline-plus-attention rules only?
