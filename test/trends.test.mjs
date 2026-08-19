import { test } from 'node:test';
import assert from 'node:assert/strict';
import { velocityTrend, costTrend, recordTimestampMs, attachVelocityTrend, attachCostTrend } from '../src/trends.mjs';

const DAY = 24 * 60 * 60 * 1000;
const ms = (iso) => Date.parse(iso);
const sec = (iso) => Math.floor(Date.parse(iso) / 1000);

// --- recordTimestampMs ------------------------------------------------------

test('recordTimestampMs: parses an ISO timestamp; null on missing/invalid', () => {
  assert.equal(recordTimestampMs({ timestamp: '2026-08-05T00:00:00Z' }), ms('2026-08-05T00:00:00Z'));
  assert.equal(recordTimestampMs({}), null);
  assert.equal(recordTimestampMs({ timestamp: 'not-a-date' }), null);
  assert.equal(recordTimestampMs(null), null);
});

// --- velocityTrend ----------------------------------------------------------

test('velocityTrend: <2 observations is not a trend → null (AC5)', () => {
  assert.equal(velocityTrend([sec('2026-08-01T00:00:00Z')], [ms('2026-08-10T00:00:00Z')]), null);
});

test('velocityTrend: samples commits/week in a trailing window as-of each observation', () => {
  // commits on 08-01, 08-08, 08-15; observations at 08-02 and 08-16.
  const commits = ['2026-08-01', '2026-08-08', '2026-08-15'].map((d) => sec(`${d}T00:00:00Z`));
  const obs = [ms('2026-08-02T00:00:00Z'), ms('2026-08-16T00:00:00Z')];
  const trend = velocityTrend(commits, obs);
  assert.equal(trend.points.length, 2);
  assert.equal(trend.points[0].atMs, obs[0]);
  assert.ok(trend.points[1].perWeek >= trend.points[0].perWeek); // more commits accrued by 08-16
});

test('velocityTrend: no commits in any window → explicit null, never a fabricated flat line (AC2)', () => {
  const obs = [ms('2026-08-10T00:00:00Z'), ms('2026-08-11T00:00:00Z')];
  assert.equal(velocityTrend([sec('2020-01-01T00:00:00Z')], obs), null); // ancient commit, outside every window
  assert.equal(velocityTrend([], obs), null);
});

// --- costTrend (replay-safe) ------------------------------------------------

function costRecord(requestId, iso, { input = 0, model = 'claude-haiku-4-5-20251001' } = {}) {
  return { requestId, timestamp: iso, message: { model, usage: { input_tokens: input, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } };
}

test('costTrend: buckets deduped record cost by stable timestamp into trailing windows', () => {
  const obs = [ms('2026-08-05T00:00:00Z'), ms('2026-08-20T00:00:00Z')];
  const records = [
    costRecord('r1', '2026-08-04T00:00:00Z', { input: 1_000_000 }), // $0.80 (haiku input 0.8/M)
    costRecord('r2', '2026-08-19T00:00:00Z', { input: 1_000_000 }), // $0.80
  ];
  const trend = costTrend(records, obs);
  assert.equal(trend.points.length, 2);
  assert.equal(trend.points[0].usd, 0.8); // only r1 is within the window ending 08-05
  assert.equal(trend.points[1].usd, 1.6); // both r1 and r2 within the 8-week window ending 08-20
});

test('costTrend replay-stable: a request replayed across two session files (same requestId + original timestamp) is counted ONCE, in its original window (AC1/AC3)', () => {
  const obs = [ms('2026-08-05T00:00:00Z'), ms('2026-08-06T00:00:00Z')];
  const original = costRecord('r1', '2026-08-04T00:00:00Z', { input: 1_000_000 });
  const replay = costRecord('r1', '2026-08-04T00:00:00Z', { input: 1_000_000 }); // verbatim replay, same ts
  const trend = costTrend([original, replay], obs);
  assert.equal(trend.points[0].usd, 0.8); // counted once, not doubled
  assert.equal(trend.points[1].usd, 0.8);
});

test('costTrend: records with no timestamp or an unpriced model are EXCLUDED — never dropped into a guessed window (AC3)', () => {
  const obs = [ms('2026-08-05T00:00:00Z'), ms('2026-08-20T00:00:00Z')];
  const noTs = { requestId: 'r1', message: { model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 1_000_000 } } };
  const unpriced = costRecord('r2', '2026-08-04T00:00:00Z', { input: 1_000_000, model: 'some-unpriced-model' });
  assert.equal(costTrend([noTs, unpriced], obs), null); // nothing attributable → null, not a fabricated series
});

test('costTrend: <2 observations → null (AC5)', () => {
  assert.equal(costTrend([costRecord('r1', '2026-08-04T00:00:00Z', { input: 1 })], [ms('2026-08-05T00:00:00Z')]), null);
});

// --- attach* joins ----------------------------------------------------------

test('attachVelocityTrend / attachCostTrend: pure joins attaching the trend or explicit null', () => {
  const data = { projects: [{ project: { id: 'a' } }, { project: { id: 'b' } }] };
  const vt = attachVelocityTrend(data, { a: { points: [{ atMs: 1, perWeek: 2 }] } });
  assert.deepEqual(vt.projects[0].velocityTrend, { points: [{ atMs: 1, perWeek: 2 }] });
  assert.equal(vt.projects[1].velocityTrend, null); // absent → explicit null, never fabricated
  const ct = attachCostTrend(data, {});
  assert.equal(ct.projects[0].costTrend, null);
});
