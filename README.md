# project-dashboard

One local page that answers **"where is every project and what's next"** by
reading the artifacts jig-managed projects already write. Read-only over
other repos, deterministic, zero dependencies (Node ≥ 18).

## Run

```bash
cp dashboard.config.example.json dashboard.config.json   # then edit it
node src/server.mjs                                       # → http://localhost:5111
```

Point [`dashboard.config.example.json`](dashboard.config.example.json) at your
own jig projects (copy it to `dashboard.config.json`, which stays git-ignored).
Every browser refresh rescans from disk — nothing to regenerate, nothing to
sync. `~` paths are allowed; per-project `pinnedWorkstreams` /
`hiddenWorkstreams` are repo-relative md paths.

## What a card shows

- **Spec progress** from `docs/specs/*/spec.md` + slice frontmatter —
  `DONE / (total − ABANDONED)`, DEFERRED reported separately.
- **Counts**: open bugs, deferred decisions, inbox items.
- **Workstreams**: `docs/releases/*.md` plans and pinned runbooks (checkbox
  progress, current phase, next step, `(you)`/`(Claude)` owner), plus
  discovered-but-unpinned checkbox docs.
- **Worktree-only docs**: warns when a doc exists only under
  `.claude/worktrees/` — one cleanup away from being lost.
- **Last compass**: latest line of `docs/status/compass-history.jsonl`
  ([ADR-0002](docs/decisions/adr-0002-compass-snapshot-contract.md)); wire
  compass via [docs/compass-integration.md](docs/compass-integration.md),
  append manually with `scripts/snapshot.mjs`, or schedule
  `scripts/snapshot.mjs --all --auto` for twice-daily deterministic
  history points (routine mode).

## Develop

```bash
npm test                   # node --test, fixtures under test/fixtures/
node src/scan.mjs          # scanner only, JSON to stdout
```

Spec-driven via jig: see [docs/specs/README.md](docs/specs/README.md) and
[docs/product-vision.md](docs/product-vision.md).

## Credits

Idea and original design by **[@Kyarha](https://github.com/Kyarha)** — built as
a personal tool for tracking many parallel [jig](https://github.com/ramboz/jig)
projects from one local page, and shared so others can reuse it for their own.
