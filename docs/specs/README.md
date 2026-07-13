# Spec Status Board

> Status: Draft (wizard-generated)
>
> Current state of all specs for project-dashboard. Update after each slice transition.
>
> A leading 🔬 in the Slice column flags slices marked `kind: spike` in
> their frontmatter — timeboxed investigation, not feature work. The
> marker is recomputed from each slice's `kind:` field on every regen
> by `workflow.py status-board`; it is never stored separately in this
> file.
>
> Related: [Bug Status Board](../bugs/README.md). Check both boards before
> folding reported defects into spec acceptance criteria.

| Spec | Slice | Status | Notes |
|------|-------|--------|-------|
| [001-adopt-jig](001-adopt-jig/spec.md) | 001-01 — bootstrap | **DONE** | worked example; review boxes satisfied by deterministic completion check |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-01 — scan-and-serve | **DONE** | scanner + server + cards page; independent review passed 2026-07-13 |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-02 — workstreams | **DONE** | releases + runbooks + pin registry + worktree-only warning |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-03 — compass-snapshot | **DONE** | contract = ADR-0002; compass-skill wiring pending on the user's side |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-01 — sessions-scan-and-render | **DRAFT** | per-project sessions read from `~/.claude` store; running badge + title + branch + worktree |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-02 — recency-expand-toggle | **DRAFT** | client-side "show older" + "N active · M older" summary |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges | **DEFERRED** | needs `gh`; trigger = decide gh-on-scan vs routine-snapshot bridge |

<!-- Regenerate with `workflow.py status-board`. Add rows as specs are created. -->
