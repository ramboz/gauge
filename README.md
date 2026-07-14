# Gauge

Gauge is a private cross-project delivery dashboard for answering three daily
questions: how are my projects advancing, which deadlines are at risk, and
what deserves attention next?

The committed MVP is local and single-user. It tracks one repository and one
active goal per project, reads source projects without modifying them, stores
daily observations centrally, and explains progress, risk, blockers, and its
recommended attention order. See the
[product vision](docs/product-vision.md),
[accepted reframe](docs/decisions/adr-0003-reframe-onto-gauge-portfolio-product.md),
and [MVP release plan](docs/releases/local-portfolio-loop.md).

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
- Gauge owns its project registry, daily observations, history, forecasts,
  risks, and cross-project attention policy.
- Source repositories are read-only; instance history belongs in Gauge.
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
