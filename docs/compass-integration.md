# Wiring compass to the dashboard

The dashboard reads `docs/status/compass-history.jsonl` in each project
(contract: [ADR-0002](decisions/adr-0002-compass-snapshot-contract.md)).
Compass doesn't write it yet — two ways to close the gap:

## Option A — teach the compass skill (recommended)

Append this paragraph to the compass skill's instructions (e.g. at the end
of its output steps):

> ## Persist a snapshot
>
> After rendering the briefing, append exactly one line to
> `docs/status/compass-history.jsonl` in the surveyed project (create the
> `docs/status/` directory if needed). The line is a single JSON object:
> `{"v": 1, "ts": "<current ISO-8601 timestamp with timezone>",
> "headline": "<the briefing's one-line honest headline>",
> "next": "<the single recommended next action>",
> "blockers": [<current blockers, if any>],
> "specs": {"done": <DONE specs>, "total": <specs excluding ABANDONED>}}`.
> Append-only — never rewrite or delete existing lines. This is the only
> file compass writes; it journals the briefing without transitioning any
> lifecycle state.

## Option B — manual fallback, zero skill changes

After any compass run (or whenever you want a data point):

```bash
node scripts/snapshot.mjs --project ~/code/project-a \
  --headline "002 song-library mid-flight, rest drafted" \
  --next "finish slice 002-02" \
  --blockers "waiting on chord-diagram design"
```

`--project` may be `~`-relative; `--blockers` is `;`-separated; `specs`
counts are filled in automatically from the project's spec tree. The script
validates against the ADR-0002 schema and refuses malformed snapshots.

## Option C — scheduled auto-snapshots (routine mode)

For history data points without a human (or Claude) in the loop:

```bash
node scripts/snapshot.mjs --all --auto
```

appends one snapshot to **every** jig project in `dashboard.config.json`,
with a deterministic headline built from scan data (e.g.
`auto: 47/62 specs done · 6 in progress · 2 open bug(s)`) and
`"source": "auto"` so the dashboard labels it "last snapshot (auto)" rather
than "last compass". Run it twice daily from any scheduler (launchd, cron,
or a Claude Code scheduled task) and the evolution history accumulates for
free. Auto snapshots complement, not replace, compass narrative — a real
compass run appended via Option A/B still gives the honest headline and
next action.
