// Git team-signals deriver (spec 012, slice 012-05): two raw-layer signals —
// the human-vs-agent commit split and a contributor count / bus-factor read —
// attached to each project card alongside milestone/velocity/cost. Read-only
// over git; never writes to a source repo.
//
// Structured for testability, mirroring src/velocity.mjs's pure-fold +
// thin-I/O-wrapper + attach* combinator shape: a PURE `teamFromCommits` folds
// already-fetched commit records into `{ agentCoauthoredPct, commitCount,
// contributorCount }` — unit-testable with plain arrays, no git — separate
// from the thin git I/O wrapper that fetches those records. `gitTeamSignals`
// is the combinator the read layer calls.
//
// AC6: the trailing window is a documented parameter SHARED with 012-02's
// velocity window — the constant is imported, never redefined here.
import { execFileSync } from 'node:child_process';
import { DEFAULT_VELOCITY_WINDOW_WEEKS } from './velocity.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// AC2: the `Co-Authored-By: Claude` trailer is an honest PROXY for
// agent-authorship — it undercounts other agent tooling that doesn't stamp
// this trailer (spec.md `## Assumptions`). Matched case-insensitively, but
// LINE-ANCHORED (`^...$` per line, via `m`) so only an actual trailer LINE
// counts — not a body paragraph that merely quotes or mentions
// "Co-authored-by: Claude" in prose (e.g. a revert echoing the original
// message). `\b` after `claude` avoids matching a human co-author literally
// named "Claudette" while still matching the real trailer's `<email>` suffix
// (reconciliation fix: the prior substring-only match over-counted both).
const CLAUDE_COAUTHOR_RE = /^co-authored-by:\s*claude\b/im;

// AC1/AC3/AC4/AC5/AC6: pure fold over already-fetched commit records
// (`{ ts, authorName, hasClaudeCoAuthor }`, `ts` in epoch seconds as `git log
// --format=%ct` emits) into the windowed split (AC1: `agentCoauthoredPct`,
// rounded to a whole percent — "sensible precision") and distinct-author
// count (AC3: `contributorCount`, a bus-factor read). No author identity is
// carried in the RETURNED object (AC5) — `authorName` is read only to feed a
// `Set` for counting, then discarded; the object below is the entire return
// shape, and it has no name-shaped field. Given a fixed `nowMs` and the same
// commit records, the output is byte-identical on every call (AC6) — no
// `Date.now()` inside this function.
//
// AC4: no commit falls inside the window (an empty input, or every timestamp
// outside `[nowMs - windowWeeks*7d, nowMs]`) returns `null` — explicit
// unknown, never a fabricated `0%` / `0 contributors` presented as healthy.
// A window WITH commits but zero agent-coauthored ones is a real, known 0% —
// not unknown — because `total > 0` at that point.
export function teamFromCommits(commits, nowMs, windowWeeks = DEFAULT_VELOCITY_WINDOW_WEEKS) {
  const windowStart = nowMs - windowWeeks * WEEK_MS;
  let total = 0;
  let agentCoauthored = 0;
  const authors = new Set();
  for (const commit of commits || []) {
    const ms = Number(commit?.ts) * 1000;
    if (!Number.isFinite(ms) || ms < windowStart || ms > nowMs) continue;
    total += 1;
    if (commit.hasClaudeCoAuthor) agentCoauthored += 1;
    if (commit.authorName) authors.add(commit.authorName);
  }
  if (total === 0) return null;
  return {
    agentCoauthoredPct: Math.round((agentCoauthored / total) * 100),
    // Reconciliation fix: `agentCoauthoredPct` alone can't tell the render
    // layer apart a TRUE zero (no agent-coauthored commits at all) from a
    // real-but-sub-1% share that also rounds to 0 (e.g. 1/300 -> 0.33% ->
    // 0) — the latter must not read as "no agent involvement" (mirrors
    // velocity's "< 0.1 commits/wk" / cost's "< $0.01" sub-precision
    // convention). This raw count lets the render layer distinguish them.
    agentCoauthoredCount: agentCoauthored,
    commitCount: total,
    contributorCount: authors.size,
  };
}

// Thin git I/O wrapper (AC1/AC6): read-only `git log`, one extra week of
// margin beyond the window (mirrors velocity.mjs's gitCommitTimestamps) so a
// commit right at the boundary is never lost to a `--since` vs. our own
// millisecond-precise windowing disagreement — teamFromCommits still does
// the exact, authoritative filtering. `%ct` (commit epoch seconds), `%an`
// (author name), and `%B` (raw body: subject + trailers, where
// `Co-Authored-By` lives) are separated by `\x1f` (unit separator) within a
// record and `\x1e` (record separator) between commits — control bytes that
// never appear in ordinary commit text, so no delimiter collision even if a
// commit message itself contains a literal newline or pipe. Throws on any
// git failure (not a repo, no git installed, unreadable history); the caller
// (gitTeamSignals) turns that into explicit unknown.
function gitCommitRecords(root, nowMs, windowWeeks) {
  const since = new Date(nowMs - (windowWeeks + 1) * WEEK_MS).toISOString();
  const out = execFileSync(
    'git',
    ['-C', root, 'log', `--since=${since}`, '--format=%ct%x1f%an%x1f%B%x1e'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return out
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [ts, authorName, ...bodyParts] = record.split('\x1f');
      const body = bodyParts.join('\x1f');
      return { ts: Number(ts), authorName, hasClaudeCoAuthor: CLAUDE_COAUTHOR_RE.test(body) };
    });
}

// AC1/AC4/AC6: the combinator the read layer calls — fetches commit records,
// then folds them through the pure deriver. Returns `null` (explicit
// unknown, never `0%`/`0`) when git is absent/unreadable OR when the fold
// itself finds nothing in the window. `nowMs` defaults to the real clock for
// production callers but is always injectable, per the project's no-
// `Date.now()`-in-a-pure-function idiom.
export function gitTeamSignals(root, nowMs = Date.now(), windowWeeks = DEFAULT_VELOCITY_WINDOW_WEEKS) {
  let commits;
  try {
    commits = gitCommitRecords(root, nowMs, windowWeeks);
  } catch {
    return null; // no git / unreadable history (AC4/AC6)
  }
  return teamFromCommits(commits, nowMs, windowWeeks);
}

// Read-layer composition (AC1/AC6), mirroring src/velocity.mjs's
// attachVelocity: a pure fold that attaches each project's already-computed
// team signals onto its current-state read. The one I/O read (gitTeamSignals,
// per project) happens in the caller (src/server.mjs), exactly as
// attachVelocity's git reads do — this function itself touches no
// filesystem. A project absent from the map (or one gitTeamSignals resolved
// to null) attaches explicit `null`, never a fabricated `0%`/`0`.
export function attachTeamSignals(data, teamByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      team: teamByProjectId?.[entry.project.id] ?? null,
    })),
  };
}
