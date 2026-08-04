---
status: DEFERRED
dependencies: [008-01]
last_verified:
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section. -->

## Slice 008-03 — Declarable completion vocabulary + foreign-status gate (DEFERRED)

**Resolution trigger:** a real project encodes a **delivery** status (work
completion) in a vocabulary other than jig's lifecycle — e.g. a flat-spec repo
using `Status: Shipped` / `Status: Done` in prose or frontmatter, or a project
that declares a custom done-set. Until then, per
[ADR-0010](../../decisions/adr-0010-generic-doc-adapter.md)'s grounding
discipline (carry unexercised variance, don't build it), this stays parked.

**Goal:** A project declares its own **completion vocabulary** (which status
tokens count as delivery-done), and the adapter resolves a **present-but-foreign**
status to `unknownStatus` unless it is in that declared vocabulary — closing the
foreign-status half of ADR-0010 sub-decision 3 that 008-01 left driverless (008-01
handles only the status-**absent** path the real corpus exercises).

**Why deferred (not built now):**
- The only real driver in the corpus (`mystique/docs/superpowers`) has
  status-**absent** files and design-review prose (`Approved`), not a foreign
  *delivery* vocabulary — handled by 008-01's absent-status path.
- Building a declarable/foreign-status vocabulary now would be speculative
  (ADR-0010 A1; spec 007 A1 discipline). 008-01's jig-preset allowlist +
  absent-status floor already prevent the misreport for the shipped corpus.

**Acceptance Criteria (draft — refine when un-parked):**

1. **Declarable completion vocabulary.** A profile (or preset) may declare the
   set of status tokens that count as delivery-complete; the adapter rolls up
   `done/total` only over those, excluding all others to `unknownStatus`.
2. **Foreign-status gate.** A present status outside the recognized/declared
   vocabulary resolves to `unknownStatus` (never `done`, never silently
   incomplete), extending 008-01's absent-status rule to the foreign case.
3. **Optional `statusSource` extensibility.** If a real driver also needs a
   non-frontmatter status *source* (e.g. prose), add the `statusSource` enum
   (`frontmatter` | `prose` | `none`) noted in ADR-0010 — only then, with tests
   over a real or faithfully-synthetic driver.

**DoD:** _Filled when un-parked (DEFERRED → DRAFT → …)._

**Anti-horizontal-phasing check:** When un-parked, this renders a card for a
project using a non-jig delivery vocabulary with correct `done/total` instead of
a blanket `unknown` — end-to-end value gated on a real driver existing.
