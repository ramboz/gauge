// History-derived trends (spec 014, slice 014-03): velocity and cost sampled
// AS-OF each accrued observation, so the card shows direction over time —
// accelerating/cooling, spend rising/flat — not just a point-in-time value.
// Owner decision (2026-08-18): RECOMPUTE both on every read (velocity from git,
// cost from timestamped transcripts); persist neither. Both are pure folds over
// already-fetched inputs (the read layer in src/server.mjs does the I/O),
// mirroring src/velocity.mjs / src/cost.mjs. deriveForecast is untouched
// (ADR-0006). A trend is a series over OBSERVATION time — distinct from
// velocity.mjs's fixed trailing-8-week git sparkline.
//
// Arch note carried from 014-02: trends are sampled at each observation's
// TIMESTAMP, never keyed on observation record COUNT (014-02 coalescing
// collapses flat runs but preserves every genuine change point + timestamp, so
// timestamp-sampling is stable under coalescing; a count-based trend would not
// be).
import { dedupeRecords, recordUsd } from './cost.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_TREND_WINDOW_WEEKS = 8;
const MIN_TREND_POINTS = 2; // one point is a value, not a trend (AC5)

function sampleTimes(observationMs) {
  return (observationMs || []).filter((t) => Number.isFinite(t)).slice().sort((a, b) => a - b);
}

// AC1: a transcript record's chronologically-correct timestamp, grounded by a
// probe of REAL transcripts (deviation log). Claude Code stamps each JSONL
// record with an ISO `timestamp`. A `requestId` groups a request's *streamed*
// records, whose timestamps drift only within the request's own emission
// (probed: max 89.6s across 322 replayed requestIds in a real 14-session
// project; NONE spanned >1 hour, and no cross-day replay re-stamping was
// observed). At the week-bucket granularity of the trend, that sub-90s drift is
// negligible — every copy of a request falls in the same window — so the
// dedup-surviving first occurrence buckets the request's spend into the correct
// window regardless of which streamed copy wins. A record with no parseable
// timestamp returns null and is never bucketed into a guessed window.
export function recordTimestampMs(record) {
  const ts = record?.timestamp;
  if (typeof ts !== 'string') return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

// AC2: velocity (commits/week in a trailing window) sampled as-of each accrued
// observation time. `null` (explicit unknown, never a fabricated flat line)
// when there is not enough history to form a trend, or no commits at all fall
// in any window. Pure: given the same inputs, byte-identical output.
export function velocityTrend(commitTimestampsSec, observationMs, windowWeeks = DEFAULT_TREND_WINDOW_WEEKS) {
  const samples = sampleTimes(observationMs);
  if (samples.length < MIN_TREND_POINTS) return null;
  const commitsMs = (commitTimestampsSec || []).map((s) => Number(s) * 1000).filter(Number.isFinite);
  const windowMs = windowWeeks * WEEK_MS;
  let anyCommits = false;
  const points = samples.map((atMs) => {
    let count = 0;
    for (const c of commitsMs) if (c > atMs - windowMs && c <= atMs) count += 1;
    if (count > 0) anyCommits = true;
    return { atMs, perWeek: Math.round((count / windowWeeks) * 10) / 10 };
  });
  if (!anyCommits) return null; // nothing in any window — honest unknown, not a flat zero line
  return { points };
}

// AC3 (replay-safe): cost (USD of deduped records whose stable timestamp falls
// in a trailing window) sampled as-of each accrued observation. Records with no
// parseable timestamp OR an unpriced/usage-less model are EXCLUDED — never
// dropped into a window they cannot be proven to belong to (a spend figure is
// never placed in a guessed window). `null` when there is not enough history or
// no attributable cost. Pure.
export function costTrend(records, observationMs, windowWeeks = DEFAULT_TREND_WINDOW_WEEKS, priceTable) {
  const samples = sampleTimes(observationMs);
  if (samples.length < MIN_TREND_POINTS) return null;
  const priced = [];
  for (const record of dedupeRecords(records || [])) {
    const at = recordTimestampMs(record);
    const usd = priceTable ? recordUsd(record, priceTable) : recordUsd(record);
    if (at === null || usd === null) continue; // un-attributable → excluded, honest
    priced.push({ at, usd });
  }
  if (priced.length === 0) return null;
  const windowMs = windowWeeks * WEEK_MS;
  const points = samples.map((atMs) => {
    let usd = 0;
    for (const p of priced) if (p.at > atMs - windowMs && p.at <= atMs) usd += p.usd;
    return { atMs, usd: Math.round(usd * 100) / 100 };
  });
  return { points };
}

// Read-layer joins (pure), mirroring attachVelocity / attachTokenCost. The one
// I/O (git log, transcript reads) happens in the caller (src/server.mjs); these
// attach an already-computed trend or explicit `null`.
export function attachVelocityTrend(data, trendByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      velocityTrend: trendByProjectId?.[entry.project.id] ?? null,
    })),
  };
}

export function attachCostTrend(data, trendByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      costTrend: trendByProjectId?.[entry.project.id] ?? null,
    })),
  };
}
