---
slice: 007-03 — Profile discovery and onboarding
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T00:47:56Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING:
All five ACs for slice 007-03 are met by src/discover.mjs + scripts/onboard.mjs. Tests exercise them meaningfully with fixtures mirroring the real corpus (proj-multiroot = mystique cwv+superpowers+stray-docs; proj-umbrella/proj-declared = personalization-workspace tracks with repos.yaml scope ordering). Declaration correctly wins over heuristics (declaration→heuristic→default→none). Output validates against project-profile-v1 and is drop-in; discovery is read-only (mtime-snapshot asserted) and carries no observation/state/server imports. ADR-0001 (zero-dep) and ADR-0003 (read-only source) invariants hold.

SPECIFIC ISSUES:
- scripts/onboard.mjs — [nit] usage advertised `[--json]` no-op → FIXED (dropped from usage) before recording.
- test/discover.test.mjs — [nit] no CLI-level test → FIXED (3 spawnSync CLI tests added) before recording.

RECONCILIATION NOTES:
- Real-corpus smokes (mystique + personalization-workspace) were run read-only by the orchestrator, not committed as tests (external repos can't be vendored; matches 007-02 precedent). Record as a deviation.
- AC2 "repos.yaml scope tags OR tracks/* layout" implemented with tracks/* as the required anchor and repos.yaml only ordering entries — a defensible narrowing of the literal "or"; log it.
