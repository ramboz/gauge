// Git velocity deriver (spec 012, slice 012-02): a raw-layer signal — commit
// cadence over a trailing window — attached to each project card alongside
// the milestone/forecast joins (src/milestone.mjs, src/derive.mjs), with no
// deadline dependency. Read-only over git; never writes to a source repo.
//
// Structured for testability (the slice's key design point): a PURE
// `velocityFromTimestamps` folds an already-fetched array of commit epoch
// seconds into `{ perWeek, buckets }` — unit-testable with plain arrays, no
// git — separate from the thin git I/O wrapper that fetches those
// timestamps. `gitVelocity` is the combinator the read layer calls.
import { execFileSync } from 'node:child_process';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The window is a documented parameter (AC5), not a magic literal buried in
// the fold — 8 weeks is simply this constant's default value.
export const DEFAULT_VELOCITY_WINDOW_WEEKS = 8;

// AC1/AC2/AC5: pure fold over commit timestamps (epoch seconds, as `git log
// --format=%ct` emits) into a windowed mean (`perWeek`, rounded to 1 decimal
// — "sensible precision" per AC2) plus a `windowWeeks`-long bucket series,
// oldest week first / most-recent week last (so a sparkline reads left→right
// as old→new). Given a fixed `nowMs` and the same timestamps, the output is
// byte-identical on every call (AC5) — no `Date.now()` inside this function.
//
// AC4: no commits fall inside the window (an empty input, or every timestamp
// outside `[nowMs - windowWeeks*7d, nowMs]`) returns `null` — explicit
// unknown, never a fabricated `0` presented as healthy.
export function velocityFromTimestamps(commitTimestamps, nowMs, windowWeeks = DEFAULT_VELOCITY_WINDOW_WEEKS) {
  const windowStart = nowMs - windowWeeks * WEEK_MS;
  const buckets = new Array(windowWeeks).fill(0);
  let total = 0;
  for (const ts of commitTimestamps || []) {
    const ms = Number(ts) * 1000;
    if (!Number.isFinite(ms) || ms < windowStart || ms > nowMs) continue;
    const weeksAgo = Math.min(windowWeeks - 1, Math.floor((nowMs - ms) / WEEK_MS));
    buckets[windowWeeks - 1 - weeksAgo] += 1;
    total += 1;
  }
  if (total === 0) return null;
  return { perWeek: Math.round((total / windowWeeks) * 10) / 10, buckets };
}

// Thin git I/O wrapper (AC1/AC6): read-only `git log`, one extra week of
// margin beyond the window so a commit right at the boundary is never lost
// to a `--since` vs. our own millisecond-precise windowing disagreement —
// velocityFromTimestamps still does the exact, authoritative filtering.
// Throws on any git failure (not a repo, no git installed, unreadable
// history); the caller (gitVelocity) turns that into explicit unknown.
export function gitCommitTimestamps(root, nowMs, windowWeeks) {
  const since = new Date(nowMs - (windowWeeks + 1) * WEEK_MS).toISOString();
  const out = execFileSync('git', ['-C', root, 'log', `--since=${since}`, '--format=%ct'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split('\n').map((line) => line.trim()).filter(Boolean).map(Number);
}

// AC1/AC4/AC6: the combinator the read layer calls — fetches timestamps,
// then folds them through the pure deriver. Returns `null` (explicit
// unknown, never `0`) when git is absent/unreadable OR when the fold itself
// finds nothing in the window. `nowMs` defaults to the real clock for
// production callers but is always injectable, per the project's no-
// `Date.now()`-in-a-pure-function idiom (worktreeAgeDays, src/scan.mjs).
export function gitVelocity(root, nowMs = Date.now(), windowWeeks = DEFAULT_VELOCITY_WINDOW_WEEKS) {
  let timestamps;
  try {
    timestamps = gitCommitTimestamps(root, nowMs, windowWeeks);
  } catch {
    return null; // no git / unreadable history (AC4/AC6)
  }
  return velocityFromTimestamps(timestamps, nowMs, windowWeeks);
}

// Read-layer composition (AC1/AC6), mirroring src/milestone.mjs's
// attachMilestones / src/derive.mjs's attachForecasts style: a pure fold
// that attaches each project's already-computed velocity onto its current-
// state read. The one I/O read (gitVelocity, per project) happens in the
// caller (src/server.mjs), exactly as attachForecasts's history reads do —
// this function itself touches no filesystem. A project absent from the map
// (or one gitVelocity resolved to null) attaches explicit `null`, never a
// fabricated `0`.
export function attachVelocity(data, velocityByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      velocity: velocityByProjectId?.[entry.project.id] ?? null,
    })),
  };
}
