---
adr: 0017
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-08T01:41:13Z
prompt_source: reframe keystone frame-critique (docs/decisions/adr-0017-reframe-onto-manager-lens.md)
---

VERDICT: pass

The manager-lens framing, analytics scope, and reconstructable/captured-history
model are load-bearing (product-vision.md still described only "a private
cross-project dashboard" with no engineer/manager boundary) and the reaffirm of
ADR-0003 (portfolio-product premise survives) + amend of ADR-0006 (two-read-layer
architecture holds; only the history *source* is refined) are honest — neither
warrants supersede. Initial coverage-floor defect: docs/refinement-todo.md was
wrongly excused while encoding the accrual premise this reframe moves ("Daily
collection", "First-run all-unknown"). Resolved: it now carries a rewrite
disposition naming both items, the L1 floor reclassifies it scanned+dispositioned
(correcting the excuse), and the ADR-0006 amend note flags the dependent
daily-collection open item. Manifest, both coverage levels, and dependent-ADR
note are now consistent; the reframe survives.
