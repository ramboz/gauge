import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markerFilename, runningProjectIds, attachRunningNow, RUNNING_STALE_AFTER_MS } from '../src/session-marker.mjs';

const NOW = Date.parse('2026-08-18T21:00:00Z');
const recent = NOW - 60 * 1000; // 1 min ago — within window
const stale = NOW - (RUNNING_STALE_AFTER_MS + 60 * 1000); // past the window
const projects = [{ id: 'a', path: '/repos/a' }, { id: 'b', path: '/repos/b' }];

test('markerFilename: sanitizes the session id to a safe .json name', () => {
  assert.equal(markerFilename('abc-123'), 'abc-123.json');
  assert.equal(markerFilename('../../etc/passwd'), 'etcpasswd.json'); // path chars stripped
});

test('runningProjectIds: a marker with a recent transcript mtime + matching cwd → project is running (AC4)', () => {
  const markers = [{ session_id: 's1', cwd: '/repos/a/src', transcriptPath: '/t/a.jsonl' }];
  const running = runningProjectIds(markers, { '/t/a.jsonl': recent }, NOW, projects);
  assert.deepEqual([...running], ['a']);
});

test('runningProjectIds: a stale transcript mtime is excluded (AC5)', () => {
  const markers = [{ session_id: 's1', cwd: '/repos/a', transcriptPath: '/t/a.jsonl' }];
  assert.equal(runningProjectIds(markers, { '/t/a.jsonl': stale }, NOW, projects).size, 0);
});

test('runningProjectIds: a marker whose cwd maps to no configured project is ignored', () => {
  const markers = [{ session_id: 's1', cwd: '/elsewhere', transcriptPath: '/t/x.jsonl' }];
  assert.equal(runningProjectIds(markers, { '/t/x.jsonl': recent }, NOW, projects).size, 0);
});

test('runningProjectIds: a missing/unreadable transcript mtime (null) → not running, never a throw (AC7)', () => {
  const markers = [{ session_id: 's1', cwd: '/repos/a', transcriptPath: '/t/gone.jsonl' }];
  assert.equal(runningProjectIds(markers, { '/t/gone.jsonl': null }, NOW, projects).size, 0);
  assert.equal(runningProjectIds(markers, {}, NOW, projects).size, 0); // absent from map
});

test('runningProjectIds: two concurrent markers in one project collapse to a single running id', () => {
  const markers = [
    { session_id: 's1', cwd: '/repos/a', transcriptPath: '/t/a1.jsonl' },
    { session_id: 's2', cwd: '/repos/a/sub', transcriptPath: '/t/a2.jsonl' },
  ];
  const running = runningProjectIds(markers, { '/t/a1.jsonl': recent, '/t/a2.jsonl': recent }, NOW, projects);
  assert.deepEqual([...running], ['a']);
});

test('runningProjectIds: a marker without a cwd is skipped; empty/absent markers → empty set (AC7)', () => {
  assert.equal(runningProjectIds([{ session_id: 's1', transcriptPath: '/t/a.jsonl' }], { '/t/a.jsonl': recent }, NOW, projects).size, 0);
  assert.equal(runningProjectIds([], {}, NOW, projects).size, 0);
  assert.equal(runningProjectIds(undefined, undefined, NOW, projects).size, 0);
});

test('attachRunningNow: attaches runningNow boolean; empty set → all false (absent-safe, AC6/AC7)', () => {
  const data = { projects: [{ project: { id: 'a' } }, { project: { id: 'b' } }] };
  const withSet = attachRunningNow(data, new Set(['a']));
  assert.equal(withSet.projects[0].runningNow, true);
  assert.equal(withSet.projects[1].runningNow, false);
  const empty = attachRunningNow(data, new Set());
  assert.equal(empty.projects[0].runningNow, false);
  const absent = attachRunningNow(data, undefined);
  assert.equal(absent.projects[0].runningNow, false); // absent-safe
});
