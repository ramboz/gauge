---
slice: 014-04 — live-session "running now" enrichment (optional)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique round 5)
reviewed_at: 2026-08-18T23:53:42Z
prompt_source: review.py frame-critique
---

VERDICT: pass (frame-critique, round 5 — frame survives, residual owned)

Converged design: thin-client-owned active-session marker; SessionStart writes it
(recording transcriptPath), 014-01's SessionEnd clears it; liveness = the
transcript file's mtime (hook-less — no per-turn Stop tax). Two hooks only.
Absent-safe/privacy/no-regression are structural; SessionStart's transcript_path
payload is a bounded first-task re-probe (A1 verified the same field on SessionEnd).

Owned residual (irreducible, honestly documented): transcript mtime advances at
write-EVENT cadence (per JSONL append), not continuously — so both an open-but-idle
session AND a long active-but-write-silent operation (a multi-minute tool call
between tool_use and tool_result) can read "not running" once past the staleness
window. Window sized >= expected max inter-write gap; bounded false-negative
accepted because the signal is optional/additive/absent-safe and never a hard
status. This cadence gap is intrinsic to any hook/filesystem liveness proxy (the
Stop-heartbeat had a turn-end version); it is owned, not closeable.

Round history: R1 rejected passive source; R2 startedAt!=liveness; R3 Stop
turn-end residual; R4 Stop per-turn write-side tax -> switched to transcript-mtime;
R5 corrected the "continuous mtime / no false-negative" over-claim to write-event
cadence with an explicit window-sizing rationale. Frame survives.
