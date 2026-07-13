---
adr: 0003
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-07-13T20:28:36Z
prompt_source: review.py frame-critique docs/decisions/adr-0003-reframe-onto-gauge-portfolio-product.md
---

The initial critique challenged the assumption that project-owned goals,
deadlines, and priorities could support a deterministic cross-project queue.
ADR-0003 was revised to separate source-project authority from Gauge's
portfolio authority over membership, attention policy, and an optional priority
overlay. Missing dates now remain unknown, forecasts require validation on
three real projects, and a kill criterion prevents Gauge from becoming a second
project-management authority. The reviewer re-read the revision and returned
VERDICT: pass with no remaining specific issues.
