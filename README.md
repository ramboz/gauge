# Gauge

Gauge is the **manager / portfolio lens** — a private, read-only view across all
of a person's projects: how each is advancing toward its active milestone,
whether it will hold (RAG), what it is costing (token spend), and what needs a
hand next (PRs to merge · in flight · blockers). Zoom **out** — breadth,
decision, trend. It is deliberately complementary to a separate **engineer
daily-driver** dashboard (slice/session, "what am I doing right now"); Gauge
works at **milestone** granularity and does not rebuild that inner depth.

The committed MVP is local and single-user, and it **derives, never asks** —
every signal comes from evidence projects already produce (git, GitHub, release
plans, Claude Code transcripts), read without modification. See the
[product vision](docs/product-vision.md), the
[portfolio reframe](docs/decisions/adr-0003-reframe-onto-gauge-portfolio-product.md)
sharpened by the
[manager-lens reframe (ADR-0017)](docs/decisions/adr-0017-reframe-onto-manager-lens.md),
and the release plans:
[Manager Dashboard — local data](docs/releases/manager-dashboard-local-data.md)
(2026-08-14) and
[Thin Client + Central Collection](docs/releases/thin-client-and-central-collection.md)
(2026-08-28).

## Current state

Gauge began from a working `project-dashboard` proof of concept. The runtime is
now Gauge-shaped: configured projects become versioned observations, optional
adapters contribute typed signals, durable history stays in private instance
state, and the local page consumes only capability versions it understands.
The Jig adapter preserves the useful POC progress, workstream, pin, and
worktree-warning behavior; generic projects remain valid without Jig.

This is the normalized core of the MVP, not the complete portfolio loop. The
generic goal/deadline adapter, daily scheduling, forecasts, risk, and global
attention queue remain follow-up slices in the
[MVP release plan](docs/releases/local-portfolio-loop.md).

## Run Gauge

```bash
cp gauge.config.example.json gauge.config.json
npm start
```

Then open <http://localhost:5111>. Give every canonical project an explicit,
stable `id`; configure optional adapters and workstream pins in
`gauge.config.json`, which remains ignored by Git. `stateDir` defaults to
`.gauge` beside the config and must be disjoint from every configured source.

Read current observations without persisting them:

```bash
npm run scan
```

Collect immutable history beneath `stateDir`:

```bash
npm run collect
```

Durable collection is deliberately fail-closed outside the Darwin/APFS
environment qualified by ADR-0005; scanning and the local page remain usable.
Legacy `dashboard.config.json` is still read with one migration warning.

## Product boundaries

- Source projects own goals, deadlines, local priority, and lifecycle state.
- Gauge owns its project registry, observations, history, forecasts, risks,
  cost/velocity analytics, and cross-project attention policy.
- Gauge is a **read-only observer**: it never writes to sources and never
  captures on their behalf — history is reconstructed from git (the past) and,
  going forward, captured by the thin client on session-stop (the future).
- Gauge works at **milestone** granularity, never slices; slice/session/task
  depth is the engineer daily-driver's job (ADR-0017).
- Jig, Shaper, Servo, and generic GitHub sources are optional adapters rather
  than hard dependencies.
- Missing or stale evidence renders as `unknown`, never as healthy or zero.

## Develop

```bash
npm test
npm run scan
```

Development follows Jig's spec workflow. Start with the
[spec status board](docs/specs/README.md),
[bug status board](docs/bugs/README.md), and
[workflow](docs/workflow.md).

## Credits and licensing

The original POC and design were created by
**[@Kyarha](https://github.com/Kyarha)** and shared through
[Jig issue 91](https://github.com/ramboz/jig/issues/91). Gauge preserves that
provenance while broadening the product boundary. The original author and Gauge
contributors release the project under the [MIT License](LICENSE).
