import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_VELOCITY_WINDOW_WEEKS,
  velocityFromTimestamps,
  gitVelocity,
  attachVelocity,
} from '../src/velocity.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse('2026-08-11T00:00:00Z');

// --- velocityFromTimestamps (pure) ---------------------------------------

test('velocityFromTimestamps: cadence over a known timestamp set (AC1/AC2)', () => {
  // 3 commits this week, 1 commit 3 weeks ago, over an 8-week window → 4 total.
  const thisWeek = NOW_MS - 1000;
  const threeWeeksAgo = NOW_MS - 3 * WEEK_MS - 1000;
  const timestamps = [thisWeek, thisWeek, thisWeek, threeWeeksAgo].map((ms) => Math.floor(ms / 1000));
  const result = velocityFromTimestamps(timestamps, NOW_MS, 8);
  assert.equal(result.perWeek, 0.5); // 4 commits / 8 weeks
  assert.equal(result.buckets.length, 8);
  assert.equal(result.buckets[7], 3); // most recent week bucket, last index
  assert.equal(result.buckets[4], 1); // 3-weeks-ago bucket
});

test('velocityFromTimestamps: empty commit set is explicit unknown, never 0 (AC4)', () => {
  assert.equal(velocityFromTimestamps([], NOW_MS, 8), null);
});

test('velocityFromTimestamps: commits entirely outside the window are also unknown (AC4)', () => {
  const longAgo = Math.floor((NOW_MS - 52 * WEEK_MS) / 1000);
  assert.equal(velocityFromTimestamps([longAgo], NOW_MS, 8), null);
});

test('velocityFromTimestamps: short history degrades to a sparser bucket series, never a crash (AC3)', () => {
  const oneCommit = Math.floor((NOW_MS - 1000) / 1000);
  const result = velocityFromTimestamps([oneCommit], NOW_MS, 8);
  assert.equal(result.buckets.length, 8);
  assert.equal(result.buckets.filter((n) => n > 0).length, 1);
  assert.equal(result.buckets.reduce((a, b) => a + b, 0), 1);
});

test('velocityFromTimestamps: bucket-series shape is always windowWeeks long, oldest-first', () => {
  const result5 = velocityFromTimestamps([Math.floor(NOW_MS / 1000)], NOW_MS, 5);
  assert.equal(result5.buckets.length, 5);
  assert.equal(result5.buckets[4], 1);
  const result12 = velocityFromTimestamps([Math.floor(NOW_MS / 1000)], NOW_MS, 12);
  assert.equal(result12.buckets.length, 12);
  assert.equal(result12.buckets[11], 1);
});

test('velocityFromTimestamps: window is a documented parameter — same input, deterministic across repeated calls, differs by window', () => {
  const timestamps = [Math.floor((NOW_MS - 1000) / 1000), Math.floor((NOW_MS - 3 * WEEK_MS) / 1000)];
  const a1 = velocityFromTimestamps(timestamps, NOW_MS, 4);
  const a2 = velocityFromTimestamps(timestamps, NOW_MS, 4);
  assert.deepEqual(a1, a2); // deterministic: same clock + input → same output
  const b = velocityFromTimestamps(timestamps, NOW_MS, 8);
  assert.notEqual(a1.perWeek, b.perWeek); // window is a real parameter, not hardcoded
});

test('DEFAULT_VELOCITY_WINDOW_WEEKS is the documented 8-week default', () => {
  assert.equal(DEFAULT_VELOCITY_WINDOW_WEEKS, 8);
});

test('velocityFromTimestamps: a real but sub-0.1/wk rate stays a non-null object (perWeek rounds to 0) — the render layer, not this fold, must not display it as an unknown/healthy 0', () => {
  const oneCommit = Math.floor((NOW_MS - 1000) / 1000);
  const result = velocityFromTimestamps([oneCommit], NOW_MS, 25); // 1 commit / 25 weeks → 0.04, rounds to 0.0
  assert.notEqual(result, null); // known, near-zero activity — not unknown
  assert.equal(result.perWeek, 0);
  assert.equal(result.buckets.reduce((a, b) => a + b, 0), 1); // the one real commit is still in the bucket series
});

// --- gitVelocity (thin git wrapper + combinator) --------------------------

function initRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-velocity-')));
  const commitAt = (isoDate, message) => {
    fs.writeFileSync(path.join(root, 'f.txt'), `${message}\n`, { flag: 'a' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, 'commit', '-qm', message], {
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
    });
  };
  execFileSync('git', ['-C', root, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
  return { root, commitAt };
}

test('gitVelocity: reads real commit cadence from a fixture repo, windowed and deterministic', () => {
  const { root, commitAt } = initRepo();
  try {
    // Chronological order (oldest → newest): `git log --since` assumes commit
    // dates are non-decreasing walking root→HEAD and prunes early otherwise,
    // so a fixture must commit in real date order to exercise it faithfully.
    // 1 commit well outside the 8-week window, 1 three weeks ago, 2 this week.
    commitAt('2025-01-01T10:00:00', 'ancient');
    commitAt('2026-07-21T10:00:00', 'three-weeks-ago');
    commitAt('2026-08-10T10:00:00', 'recent-1');
    commitAt('2026-08-10T11:00:00', 'recent-2');
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    const result = gitVelocity(root, nowMs, 8);
    assert.ok(result);
    assert.equal(result.buckets.length, 8);
    assert.equal(result.buckets.reduce((a, b) => a + b, 0), 3); // ancient commit excluded
    assert.equal(result.buckets[7], 2); // this-week bucket
    // Determinism: fixed clock + repo state → identical output on repeated calls.
    assert.deepEqual(gitVelocity(root, nowMs, 8), result);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitVelocity: no commits in the window renders unknown (null), not 0 (AC4)', () => {
  const { root, commitAt } = initRepo();
  try {
    commitAt('2020-01-01T10:00:00', 'ancient');
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    assert.equal(gitVelocity(root, nowMs, 8), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitVelocity: no git (unreadable history) renders unknown (null), never a crash (AC4/AC6)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-velocity-nogit-'));
  try {
    assert.equal(gitVelocity(root, NOW_MS, 8), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- attachVelocity (pure read-layer join) --------------------------------

test('attachVelocity: joins precomputed per-project velocity onto each project (mirrors attachMilestones)', () => {
  const data = { generatedAt: 'x', projects: [{ project: { id: 'alpha' } }, { project: { id: 'beta' } }] };
  const result = attachVelocity(data, { alpha: { perWeek: 3.5, buckets: [1, 2, 3] } });
  assert.deepEqual(result.projects[0].velocity, { perWeek: 3.5, buckets: [1, 2, 3] });
  assert.equal(result.projects[1].velocity, null); // no entry → explicit unknown, never 0
});
