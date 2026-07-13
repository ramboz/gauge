# ADR-0002 — Compass snapshot contract: docs/status/compass-history.jsonl

- **Status:** Accepted (2026-07-13)
- **Spec:** [002-03 compass-snapshot](../specs/002-dashboard-mvp/slice-03-compass-snapshot.md)

## Context

Compass is deliberately read-only: it reports in chat and persists nothing,
so "what did compass say last" has no data source. The dashboard needs that
narrative, and a morning/evening compass ritual should accumulate history
for future evolution views. The contract must be shared: compass (writer),
the dashboard (reader), and potentially jig upstream.

## Decision

Each surveyed project gets an **append-only** JSONL file:

```
<project>/docs/status/compass-history.jsonl
```

One JSON object per line, appended at the end of each compass run:

```json
{"v": 1,
 "ts": "2026-07-13T09:05:00+02:00",
 "headline": "one-sentence honest status",
 "next": "the single recommended next action",
 "blockers": ["optional", "list"],
 "specs": {"done": 27, "total": 28}}
```

- **Required:** `v` (schema version, currently 1), `ts` (ISO-8601),
  `headline` (non-empty string).
- **Optional:** `next` (string), `blockers` (string array),
  `specs` (`{done, total}` — spec-level, ABANDONED excluded from `total`).
- **Semantics:** append-only; the latest valid line is the current
  narrative; earlier lines are the time series. Readers skip malformed
  lines with a warning, never fail. Unknown extra fields are allowed and
  preserved (forward-compatible); breaking changes bump `v`.
- **Writers:** compass (at the end of a run), or the manual fallback
  `scripts/snapshot.mjs`. The dashboard itself **never** writes this file
  (vision principle 1).

## Consequences

- The compass skill needs a one-paragraph addition — see
  [compass-integration.md](../compass-integration.md).
- History accrues from day one of adoption; evolution graphs (future spec)
  need no migration.
- A project without the file simply shows "no compass snapshot yet".

## Alternatives considered

- **Overwritten `compass-latest.json`:** simpler read, but destroys the
  time series the morning/evening ritual is meant to build.
- **Markdown snapshot doc:** human-readable but fragile to parse and
  tempting to hand-edit; JSONL keeps the contract mechanical.
- **Dashboard-side journaling (scanner writes what it computes):** rejected —
  crosses the read-only boundary and captures numbers, not compass's
  narrative judgment.
