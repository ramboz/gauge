---
adr: 0016
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T21:57:17Z
prompt_source: review.py frame-critique docs/decisions/adr-0016-optional-github-pr-resolution.md
---

VERDICT: pass

The opt-in / default-off / degrade-to-proxy frame is coherent, and the fallback
target (the ADR-0015 proxy) is itself honestly hedged as "likely an open PR", so
no failure path fabricates false certainty. Strongest attack — `absent` collapses
"disabled" and "enabled-but-gh-failed" into one state, silently reverting to the
guess on failure — is an additive visibility gap, not a frame defect, and is
recorded as a known limitation + covered by kill criteria. Secondary attacks do
not land: draft PRs carry state OPEN (isDraft separate) so route to in-review;
force-push/differing-branch is caught by branch-then-oid matching; partial
per-repo gh failure degrades only that repo. Residual logged: fork PRs sharing a
local branch name could false-match (no headRepositoryOwner), and the flag is
global where ADR-0015 said per-project — both now recorded as accepted
limitations in the ADR.
