---
adr: 0010
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T02:36:20Z
prompt_source: review.py frame-critique docs/decisions/adr-0010-generic-doc-adapter.md
---

VERDICT: pass

REASONING:
Frame is an honestly-stated, owner-directed decision (recast the jig adapter into a convention-generic doc adapter; jig = named preset). It survived four adversarial rounds that corrected: (1) an awk-for-YAML probe error that mis-read the driver as status-less; (2) a design-approval≠work-completion semantic error (superpowers' prose `Approved` is design-review, not delivery-done); (3) a mis-grounding of the completion rule against normStatus/progressOf (normStatus defines no vocabulary; progressOf sinks absent/foreign tokens into the denominator → a 0/4 under-report once flat layout is counted); (4) a residual internal contradiction on prose-status scope. Final frame: layout is the real-driver axis; completion is gated by a to-be-defined delivery vocabulary (foreign/absent → unknownStatus, honest `unknown`); prose extraction is deferred as driverless; the technical delta from Option A is honestly conceded as small (B is a framing choice). Residual risks are parked in Assumptions A1–A3, Kill criteria, and Open questions.

SPECIFIC ISSUES:
(none — frame sound)
