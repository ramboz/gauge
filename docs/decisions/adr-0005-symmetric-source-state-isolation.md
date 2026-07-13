---
status: Accepted
dependencies: []
last_verified: 2026-07-13
frame_review: true
---

# ADR-0005: Symmetric source and state isolation

## Status

Accepted (2026-07-13)
Supersedes ADR-0004

## Context

Accepted ADR-0004 requires Gauge to reject a `stateDir` nested inside a
configured source project, but its rule is one-directional. Spec 004's frame
critique found the inverse topology: a configured source may itself be nested
inside `stateDir`—including inside `observations/<project-id>`—so a collector
write can still land in a source repository.

The source-read-only boundary is load-bearing. Path-safe project ids and
destination-beneath-state checks are insufficient unless every canonical
source root and the canonical state root are mutually disjoint.

## Decision Options Considered

### Option A: Keep ADR-0004's one-way check
- **Pros:** Minimal validation and permits self-observation with co-located
  instance state.
- **Cons:** A source nested beneath state can receive collector writes,
  violating ADR-0003 and spec 004 AC4.

### Option B: Require symmetric canonical disjointness
- **Pros:** Simple invariant, deterministic failure, and no topology-dependent
  exceptions in the write path.
- **Cons:** A Gauge repository configured as its own source must place instance
  state outside that repository or defer self-observation.

### Option C: Allow overlap with destination exclusions
- **Pros:** Supports co-located self-observation without moving state.
- **Cons:** Every future state path becomes security-sensitive, symlink and
  migration changes can invalidate exclusions, and the authority rule becomes
  “read-only except for these hidden subtrees.”

## Recommended Decision

Choose **Option B**, superseding ADR-0004's state/source isolation rule while
retaining the rest of ADR-0004's observation, capability, schema-evolution,
history, and filesystem decisions.

Before any state capability probe, directory creation, or collector write,
Gauge requires every configured source root to exist and resolves its filesystem
identity. A missing source remains a valid configured project for read-only
scans and produces an error-state observation, but durable collection for that
configuration is refused with `unverifiable-source-root` until the source
exists. Gauge never guesses case, Unicode-normalization, mount-alias, or symlink
equivalence for a prospective source name.

The state root may be absent. Gauge resolves the identity of its nearest
existing ancestor and appends the prospective segments, checks that descriptor
against every existing source, then creates state components safely as described
below. After the state root exists, Gauge resolves its actual identity and
repeats the symmetric check before any observation write.

For every source/state pair, configuration is valid only when neither filesystem
location equals nor contains the other. `realpath` strings are diagnostic, not
authority: on macOS, firmlink aliases can name one directory with distinct
`realpath` strings.

Gauge builds an identity descriptor for each existing source and the state
root/nearest existing state ancestor by walking to the filesystem root and
recording `stat` device/inode pairs plus child path segments, then appending any
prospective state segments.
It finds the deepest shared device/inode identity between the two descriptors
and compares the remaining segments from that actual directory. Equality or a
prefix in either direction is overlap. If stable device/inode identity is not
available, durable collection fails with `unsupported-filesystem-identity`
rather than falling back to strings.

Spec 004 qualifies one durable-collection environment: `process.platform ===
'darwin'` with Node `statfs` type `26` (the current APFS state volume), followed
by stable repeated device/inode checks and ADR-0004's hard-link/fsync/read-back
capability probe. Node documents `stats.dev` as the containing device identifier,
`stats.ino` as the filesystem-specific inode number, and `statfs.type` as the
underlying filesystem type ([Node filesystem
documentation](https://nodejs.org/api/fs.html#class-fsstats)). The executed
probe recorded Darwin type `26`, stable identity, and the alias behavior below.

Any other platform/filesystem is scan-only and returns
`unsupported-filesystem-identity` for durable collection. Expanding the
allowlist requires a platform-specific alias/identity fixture plus the same
atomic-write capability evidence; a successful-looking `stat` result alone is
not sufficient.

Gauge applies the same identity-ancestry check to prove each final record
destination is beneath the state root and outside every source root immediately
before opening its temporary file.

Gauge never uses recursive directory creation below the validated state root.
For `observations/<project-id>`, it walks one path segment at a time. Every
existing component is checked with `lstat` and any symbolic link is rejected;
every missing component is created non-recursively, then resolved and checked
for state containment and source disjointness before the next component is
considered. The filesystem capability probe follows the same safe-component
rule. This prevents a pre-existing descendant symlink from redirecting even a
directory creation into a source before the final-record check runs.

Symlinks outside the state tree are handled by identity descriptors; symlinks
inside the state tree are forbidden. Hostile concurrent replacement of a
validated component by another local process is outside the single-user local
MVP threat model; a later hosted collector must use a stronger directory-
handle/openat-style boundary or an isolated state volume.

There is no self-observation exception. Product code and instance state may
share the private Gauge repository only while that repository is not also a
configured source. To observe Gauge itself, configure `stateDir` in a disjoint
private location.

An executed 2026-07-13 Darwin probe confirmed why identity is required:
`/Users/ramboz/Projects/misc/gauge` and
`/System/Volumes/Data/Users/ramboz/Projects/misc/gauge` retained distinct native
`realpath` strings but reported the same device `16777233` and inode
`457060892`. The implementation test suite reproduces the general identity-
alias case on the qualified platform and unit-tests the descriptor comparison
with synthetic identities.

## Consequences

**Becomes easier:**
- Proving the no-source-write invariant with one symmetric predicate.
- Auditing every state write without topology-specific allowlists.

**Becomes harder:**
- Self-observation requires a state root outside the Gauge repository.
- Durable collection refuses configurations with unavailable source roots;
  read-only scans still surface their error observations.
- Durable collection is initially limited to the qualified Darwin/APFS
  environment; other filesystems remain scan-only until separately evidenced.
- Hosted/multi-user collection will need a stronger defense against concurrent
  filesystem mutation than the trusted local MVP.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

_Load-bearing factual claims about runnable surfaces (library/API capability,
version/perf behavior, behavior of existing code) must be backed by an executed
probe (run a command, read source/`node_modules`) or a citation — or listed
here explicitly as an assumption. Never assert an unverified claim as fact._

_Risk-gated: omit this section (or write "None") when the decision has no
unverified load-bearing assumptions — do not pad with boilerplate._

None. The failing inverse topology is a direct consequence of ADR-0004's path
rules and can be exercised with temporary directories and symlinks.

## Kill criteria

_What would make this decision wrong? List the conditions that, if observed,
should reverse or shelve it. Risk-gated like Assumptions — write "None" or omit
when there is no meaningful kill condition; do not invent ceremonial ones._

- Real MVP use demonstrates that self-observation with a disjoint state root is
  operationally unacceptable; revisit instance placement without weakening the
  rule that collector writes never enter a configured source.
- The threat model expands beyond a trusted single-user process; supersede the
  path-check implementation with filesystem isolation or handle-relative writes
  before hosted collection.

## Open questions

None.
