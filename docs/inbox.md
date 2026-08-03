# Inbox

> Status: Draft (wizard-generated)
>
> Thin capture layer for unresolved ideas, observations, and items that surfaced during
> sessions but aren't ready for a spec. Triage during reconciliation or session end:
> (a) promote to a spec, (b) promote to an ADR, (c) drop.
>
> This is NOT a task list. Items here are parked thoughts, not committed work.

<!-- Add items below. Format: - [date] description -->
- [2026-08-03] Gauge validation reference projects — standing corpus the user re-runs collection against when validating adapter / onboarding / multi-project work (registered in a local gauge.config.json during the 2026-08-03 POC exercise). PATTERN A (flat jig repo: docs/{specs,decisions}, 1 repo=1 card, works today): jig=/Users/ramboz/Projects/misc/jig (adapters:[jig], 100 specs); gauge=/Users/ramboz/Projects/misc/gauge ([jig], self-observation, 6 specs); servo=/Users/ramboz/Projects/misc/servo ([jig], no scaffold.json but jig-style docs/, 22 specs); shaper=/Users/ramboz/Projects/misc/shaper ([jig], 7 specs all DONE but ~3wk stale = freshness-blindness example). PATTERN B (nested sub-projects in a large repo): mystique=/Users/ramboz/Projects/spacecat/mystique (generic [] today; real jig artifacts live under docs/opportunities/cwv/{specs,bugs,decisions}=12 specs/26 ADRs + docs/superpowers/specs; root docs/specs has only 2 stray dirs so forcing [jig] yields a misleading 0/2). PATTERN C (umbrella multi-track workspace): personalization-workspace=/Users/ramboz/Projects/aem/personalization-workspace (tracks/{rtb,offer-management,contextual-experimentation}/{specs,decisions}=11 specs/14 ADRs; NO root docs/specs so gauge sees it as generic and is blind to all tracks; self-describes via repos.yaml scope tags; each track spans multiple external code repos).
