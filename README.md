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

Gauge began from a working `project-dashboard` proof of concept. The current
runtime still provides the inherited local Jig-oriented cards, workstream
discovery, worktree-only warnings, and legacy Compass snapshot reader. The
[retrofit spec](docs/specs/004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md)
tracks the move to adapters, normalized observations, and central instance
state. Until that lands, current runtime output is POC behavior rather than the
complete Gauge MVP.

## Run the POC

```bash
cp dashboard.config.example.json dashboard.config.json
node src/server.mjs
```

Then open <http://localhost:5111>. Configure project paths and optional
workstream pins in `dashboard.config.json`, which remains ignored by Git.

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
node src/scan.mjs
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
