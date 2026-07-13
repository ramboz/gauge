# ADR-0001 — Runtime: Node ≥ 18, ESM, zero runtime dependencies

- **Status:** Accepted (2026-07-13)
- **Resolves:** refinement-todo → "Decision: Tech stack" and "Decision: Testing framework"

## Context

The dashboard is a local, single-user tool that must outlive framework
churn and never block on a broken install. It parses markdown/YAML-lite,
walks directories, shells out to git, and serves one page. The owner's
other projects are TypeScript/Node, so Node is the ambient runtime.

## Decision

- Node ≥ 18, ES modules, plain JavaScript (no TypeScript build step).
- **Zero runtime dependencies**: `node:http`, `node:fs`, `node:child_process`
  only. Frontmatter and checkbox parsing are hand-rolled for the small,
  verified subset of YAML jig actually emits (flat `key: value`,
  `key: [a, b]`).
- Tests with `node:test` (built-in), fixtures under `test/fixtures/`.
- One self-contained `public/index.html` — inline CSS/JS, no bundler.

## Consequences

- `git clone && node src/server.mjs` is the entire install.
- Future agents: do **not** add npm runtime packages (express, gray-matter,
  chokidar…) — that undoes this decision; extend the hand-rolled parsers
  instead. Dev-dependencies for tooling are acceptable if genuinely needed.
- If a jig project someday emits YAML beyond the flat subset, the parser
  gains a case — or this ADR is superseded, consciously.

## Alternatives considered

- **Python** (matches jig's own helpers): equally viable; rejected to match
  the owner's app-project ecosystem and keep one runtime for scanner+server.
- **Vite/React app** (matches project-c/project-a): rejected — a build step and
  dependency tree for one page contradicts "nothing to install, break, or
  update".
