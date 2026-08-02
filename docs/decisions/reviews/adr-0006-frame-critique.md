---
adr: 0006
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-02T01:53:22Z
prompt_source: manual frame-critique (review.py helper not vendored in this checkout)
---

VERDICT: pass

REASONING:
The frame is sound. The decision is genuinely between a hard split (A), one
instance with a named-and-enforced seam (B), and one instance with no seam (C),
and under the committed single-user/local/single-repo MVP the isolation A buys
(independent deployment, retention, trust boundaries) has no value while its
cost is real: either two drifting copies of the observation contract/validator
or a package boundary that reproduces B's seam with added release overhead. The
ADR does not overstate A — it names both A shapes honestly and states B's own
cost (an import rule enforced by review, not a repository wall) rather than
hiding it. The load-bearing factual claims all verify TRUE against the checkout
(2026-08-02): `readObservationHistory()` exists in `src/state.mjs`, returns
`{observations, errors}` sorted by `collectedAt` then `recordId`, and has no
runtime caller (only `test/state.test.mjs`); `src/server.mjs` and `src/cli.mjs`
read only `observeAll`, which runs adapters live and is correctly characterized
as the current-state path; and a search of `src/` for
`forecast|risk|deadline|attention|trend|velocity` returns nothing, so the
"no analytics/derivation code" claim holds. The substrate is real, not dead
code: `scripts/snapshot.mjs` writes validated observations through
`collectObservation` into `observations/<id>/`, so the
adapter → observation → history pipeline the derive layer will fold over is
already exercisable; only the daily scheduling of that collector is deferred.
The `collection.status` "never derivation evidence" rule the ADR reaffirms is
grounded in code (`src/observation.mjs` computes it as a pure operational
summary at line 657, separate from signals) and in `architecture.md` line 124.
The seam is coherent: because `readObservationHistory()` already validates and
returns records, a `src/derive.mjs` can fold over it without importing adapters
or `src/scan.mjs`, keeping the layer independently testable and cheaply
extractable. None of the residual issues below rise to a framing flaw or a false
claim, so the decision may be committed.

SPECIFIC ISSUES:
- The "single inbound dependency on `readObservationHistory()`" framing is
  slightly idealized for the cross-project attention layer. The reader is
  per-project (`readObservationHistory(stateDir, projectId)`), so folding across
  the portfolio to rank attention also needs the set of project ids, which comes
  from the registry/config, not from the history reader. This is satisfiable by
  having the caller pass the id list in (keeping `derive.mjs`'s own imports
  limited to the reader), but the ADR's "only inbound dependency" phrasing
  glosses that the derive layer needs project-id enumeration for the global
  queue. Residual, not load-bearing.
- Minor provenance nit: the ADR reaffirms "ADR-0004's rule" on
  `collection.status` while ADR-0004 is marked Superseded by ADR-0005. The
  citation is in fact accurate — ADR-0005 superseded only ADR-0004's
  state/source isolation rule (ADR-0005 line 49), leaving the observation/
  history contract, including the `collection.status` rule, still authored by
  ADR-0004 — but ADR-0006's dependency list (`[adr-0003, adr-0005]`) omits
  adr-0004 whose contract rule it leans on. A documentation-hygiene note, not a
  framing defect.
- The history-derived layer's value is contingent on the deferred daily
  collector actually populating history at cadence; today history is written
  only by the manual `scripts/snapshot.mjs` run. This is honestly bounded by the
  ADR ("does not exist yet", scheduling left in refinement-todo) and by kill
  criterion #2 (ADR-0003's central-history-cost test), so it is acknowledged
  residual risk rather than an unstated assumption.
