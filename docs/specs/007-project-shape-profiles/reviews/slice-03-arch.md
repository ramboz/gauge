---
slice: 007-03 — Profile discovery and onboarding
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T00:47:57Z
prompt_source: review.py arch-review
---

VERDICT: pass

REASONING:
src/discover.mjs is a well-bounded read-only introspection module whose output ({artifactRoot} / {entries:[{id,label,artifactRoot}]}) aligns exactly with what normalizeConfig/validateProfile consume, and its precedence (declaration → heuristic → default → none) matches ADR-0009. AC5 purity holds functionally: it imports only node builtins plus safeProjectId (a pure string util) and no central-only module, enforced by a test. The one arch smell — importing config.mjs for a small pure function — is a coupling nit, not a reuse blocker; the transitive graph contains nothing central-only.

SPECIFIC ISSUES:
- src/discover.mjs:16 — [nit] importing safeProjectId from config.mjs transitively loads profile.mjs (schema readFileSync at init). Recommend extracting safeProjectId to a tiny src/ids.mjs before spec-006 reuses this at the edge.
- src/discover.mjs:169 — [nit] "drop bare docs when nested roots exist" has an inverse failure mode (an incidental docs/archive/specs could suppress a genuine flat docs root). Acceptable — discovery is a reviewed proposal printing source+notes — but an unstated assumption.
- src/discover.mjs:99 — [nit] declaration path hardcodes the literal `tracks` umbrella name; a differently-named umbrella falls through to heuristic. In-scope per ADR-0009 but spec-006 should know it is not a general umbrella detector.
- src/discover.mjs:98 — [strength] the repos.yaml lite-parser is NOT load-bearing: entries always derive from the filesystem tracks/* dirs; parseScopeTags only influences ordering. Robust degradation.

RECONCILIATION NOTES:
- Log the config.mjs coupling as a known item; recommend safeProjectId → src/ids.mjs extraction before spec-006 edge reuse (deferred follow-up, not this slice's scope).
- Carried heuristic assumptions: inverse-mystique risk; declaration limited to literal tracks/ name.
- onboard.mjs emits only a config-inline profile to stdout and never writes the source — consistent with ADR-0009's config-inline-default; no deviation.
