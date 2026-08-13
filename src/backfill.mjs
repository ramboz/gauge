// Git-backfill seed (spec 013-01, ADR-0018): reconstructs each jig project's
// spec-level progress(t) series from its OWN git history and writes it as
// backfilled observation-v1 snapshots into the Gauge state dir, so the
// EXISTING deadline forecast (src/derive.mjs's deriveForecast, unmodified)
// can compute a real on_track/at_risk on real history instead of
// unknown('insufficient-history'). Read-only against source repos: every
// operation below is a `git log`/`git symbolic-ref`/`git grep` read — never a
// write (a hard project constraint; verified in test/backfill.test.mjs by
// diffing HEAD/status before and after).
//
// Structured like src/velocity.mjs: the walk/reduce logic
// (reconstructSeriesFromCommits) is separated from the thin git I/O
// (dailyCommits/specItemsAt), and reuses src/lib.mjs's progressOf/normStatus/
// gitFreshness verbatim so the reconstruction mirrors Gauge's own live-scan
// semantics exactly (ADR-0018 Assumptions), rather than re-implementing them.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { progressOf, normStatus, gitFreshness } from './lib.mjs';
import { collectObservation } from './state.mjs';

const ADAPTER_ID = 'git-backfill';

// Sampled cadence (AC5): one representative (last) commit per calendar day —
// a bounded walk over the repo's daily history, not a per-commit explosion.
// A documented constant, mirroring src/lib.mjs's STALE_AFTER_DAYS pattern,
// rather than a magic literal buried in the fold.
export const DEFAULT_BACKFILL_CADENCE_DAYS = 1;

function gitOut(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

// The branch to walk: the checked-out branch when there is one, else the
// literal `HEAD` ref (works for a detached checkout too — `git log HEAD` is
// always valid). Never assumes a hardcoded branch name.
function defaultBranch(root) {
  const symbolic = gitOut(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  return symbolic || 'HEAD';
}

// One representative (last) commit per calendar day on the walked ref —
// the daily-cadence sample (AC5). The day key is the date portion of git's
// `%cI` committer date, i.e. the commit's own local-offset calendar day (not
// UTC-normalized); deterministic per repo, and near-midnight commits bucket by
// that local day. Chronological ascending order. Only the daily cadence is
// supported — DEFAULT_BACKFILL_CADENCE_DAYS is asserted here so the documented
// constant is load-bearing, not a decorative knob that silently does nothing.
function dailyCommits(root, ref) {
  if (DEFAULT_BACKFILL_CADENCE_DAYS !== 1) {
    throw new Error('backfill: only a daily cadence (DEFAULT_BACKFILL_CADENCE_DAYS=1) is supported');
  }
  const raw = gitOut(root, ['log', '--first-parent', '--format=%H%x09%cI', ref]).trim();
  if (!raw) return [];
  const rows = raw.split('\n').map((line) => {
    const [sha, iso] = line.split('\t');
    return { sha, iso, day: iso.slice(0, 10) };
  });
  rows.reverse(); // chronological
  const byDay = new Map();
  for (const row of rows) byDay.set(row.day, row); // later commit of the day wins
  return [...byDay.values()];
}

// A single `git grep` result line, in the `<rev>:<path>:<content>` shape git
// emits for a tree-ish grep (verified against a real fixture repo — see the
// grounding read for this slice). Splits on the first two colons only, so a
// path containing further colons (unlikely, never produced by jig scaffolds)
// still yields a usable `content` tail.
function parseGrepLine(line) {
  const firstColon = line.indexOf(':');
  if (firstColon === -1) return null;
  const afterRev = line.slice(firstColon + 1);
  const secondColon = afterRev.indexOf(':');
  if (secondColon === -1) return null;
  return { path: afterRev.slice(0, secondColon), content: afterRev.slice(secondColon + 1) };
}

// Extracts a `status:` frontmatter value from a grep-matched line's content,
// mirroring src/lib.mjs's parseFrontmatter value handling closely enough for
// the simple unquoted/quoted scalar tokens jig status values actually are
// (READY_FOR_IMPLEMENTATION, DONE, ABANDONED, ...) — normStatus'd exactly as
// the live scan does, so reconstruction and live scan agree on vocabulary.
function statusValueFromContent(content) {
  const match = content.match(/^status:\s*["']?([A-Za-z_][\w-]*)/);
  return normStatus(match ? match[1] : null);
}

// Reads every `status:` frontmatter line reachable at `sha` under
// `<specsDirRel>/*/spec.md` (nested layout — src/scan.mjs's default), falling
// back to `<specsDirRel>/*.md` (flat layout, excluding README) only when the
// nested pattern matches nothing at that commit — mirroring
// resolveLayout/scanSpecsFlat's flat README exclusion. Returns null (not an
// empty array) when the project has no specs yet at this commit, so the
// caller skips the point rather than fabricating a 0/0 reading (product-
// vision: unknown, never a coerced zero).
function specItemsAt(root, sha, specsDirRel) {
  const nested = gitOut(root, ['grep', '-I', '-E', '^status:', sha, '--', `${specsDirRel}/*/spec.md`]).trim();
  if (nested) {
    return nested.split('\n').map(parseGrepLine).filter(Boolean)
      .map((entry) => ({ status: statusValueFromContent(entry.content) }));
  }
  const flat = gitOut(root, ['grep', '-I', '-E', '^status:', sha, '--', `${specsDirRel}/*.md`]).trim();
  if (!flat) return null;
  const items = flat.split('\n').map(parseGrepLine).filter(Boolean)
    .filter((entry) => path_basename(entry.path).toLowerCase() !== 'readme.md')
    .map((entry) => ({ status: statusValueFromContent(entry.content) }));
  return items.length ? items : null;
}

// Tiny basename helper — avoids importing node:path for one call, keeping
// this module's only I/O dependency `node:child_process` + `node:crypto`.
function path_basename(p) {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? p : p.slice(idx + 1);
}

// AC1: the reconstruction combinator. Walks the sampled daily commits and
// runs Gauge's OWN progressOf (src/lib.mjs, unmodified) over each commit's
// reconstructed spec-status items, byte-for-byte the same rollup the live
// jig adapter uses (denom = total - abandoned). Read-only: only `git log` /
// `git symbolic-ref` / `git grep` reads against `root`, never a write.
export function gitBackfillSeries(root, opts = {}) {
  const specsDirRel = opts.specsDirRel || 'docs/specs';
  const ref = opts.branch || defaultBranch(root);
  const commits = dailyCommits(root, ref);
  const series = [];
  for (const commit of commits) {
    const items = specItemsAt(root, commit.sha, specsDirRel);
    if (!items) continue; // no specs yet at this point in history — skip, don't fabricate
    series.push({ sha: commit.sha, collectedAt: commit.iso, progress: progressOf(items) });
  }
  return series;
}

// Deterministic, schema-valid (UUID v4 shape) record id derived from
// project id + commit sha — NOT randomUUID(). This is what makes backfill
// idempotent (AC5): re-running produces the exact same recordId (and hence
// the exact same on-disk filename, since src/state.mjs's atomicRecord names
// records `${stamp}-${recordId}.json`) for the same project/commit-day, so a
// second run's write collides (EEXIST) instead of duplicating.
function deterministicRecordId(projectId, sha) {
  const digest = createHash('sha256').update(`${ADAPTER_ID}:${projectId}:${sha}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// AC2: builds one observation-v1 record for a single reconstructed point,
// honestly marked reconstructed-from-git (never the live 'jig' adapterId) in
// BOTH provenance (adapterId = 'git-backfill') and freshness.reason — and
// with a real, non-fabricated freshness STATE: gitFreshness (src/lib.mjs,
// unmodified) compares the point's own commit day against `nowMs` (the
// actual backfill-run clock), so a point whose commit is long in the past
// honestly reads stale, not a blanket 'fresh'. `nowMs` is always injectable
// (no bare Date.now() in here), matching the project's pure-fold idiom.
export function buildBackfillObservation(project, point, nowMs = Date.now()) {
  const { sha, collectedAt, progress } = point;
  const evidence = gitFreshness(collectedAt, nowMs);
  const freshness = {
    state: evidence.state,
    reason: evidence.state === 'fresh' ? 'reconstructed-from-git' : `reconstructed-from-git:${evidence.reason}`,
  };
  const provenance = { adapterId: ADAPTER_ID, collectedAt, sourceRevision: sha, sourceTimestamp: collectedAt };
  const executionValue = {
    strategy: 'git-backfill', // distinct from the live jig adapter's 'jig-specs' strategy
    progress,
    sliceProgress: null,
    items: [],
    counts: {},
  };
  const candidateId = `${ADAPTER_ID}:execution:${sha}`;
  const executionSignal = {
    type: 'execution',
    version: 1,
    status: 'supported',
    candidates: [{ adapterId: ADAPTER_ID, id: candidateId, version: 1, value: executionValue, freshness, provenance }],
    resolution: { strategy: 'single-supported-candidate', selected: candidateId },
    freshness,
    provenance,
    value: executionValue,
  };
  return {
    schemaVersion: 1,
    recordId: deterministicRecordId(project.id, sha),
    project: { id: project.id, label: project.label, path: project.path },
    collectedAt,
    collection: { status: 'ok' },
    provenance: {
      sourceRevision: sha,
      adapters: [{ id: ADAPTER_ID, status: 'ok', collectedAt, sourceRevision: sha, sourceTimestamp: collectedAt, freshness }],
    },
    signals: [executionSignal],
    extensions: {},
    errors: [],
  };
}

// AC5: idempotent write. src/state.mjs's collectObservation throws (raw
// Node EEXIST) when a record with the same stamp+recordId already exists —
// exactly the case for a repeat backfill run over the same project/commit-day
// (deterministicRecordId above). That is treated as "already backfilled",
// not a failure: `created: false`, no duplicate written. Any OTHER error
// (containment violations, filesystem qualification failures, ...) still
// propagates — this only swallows the specific duplicate-record signal.
export function recordBackfillObservation(config, observation) {
  try {
    return { path: collectObservation(config, observation), created: true };
  } catch (error) {
    if (error && error.code === 'EEXIST') return { path: null, created: false };
    throw error;
  }
}
