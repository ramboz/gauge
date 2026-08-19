import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { markerFilename, runningProjectIds, attachRunningNow, readActiveSessionMarkers, clearMarker, RUNNING_STALE_AFTER_MS } from '../src/session-marker.mjs';

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

// --- readActiveSessionMarkers (I/O reader — behavioral, cross-platform) ------

test('readActiveSessionMarkers: absent markers directory → empty (absent-safe, AC7)', () => {
  const missing = path.join(os.tmpdir(), 'gauge-no-such-dir-xyz', 'active-sessions');
  assert.deepEqual(readActiveSessionMarkers(missing), { markers: [], mtimeByPath: {} });
});

test('readActiveSessionMarkers: reads valid markers, stats their transcript mtime, skips malformed, maps missing transcript to null (AC7/AC8)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-markers-'));
  try {
    const realTranscript = path.join(dir, 'real.jsonl');
    fs.writeFileSync(realTranscript, '{}\n');
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ session_id: 'a', cwd: '/repos/a', transcriptPath: realTranscript }));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ session_id: 'b', cwd: '/repos/b', transcriptPath: path.join(dir, 'gone.jsonl') }));
    fs.writeFileSync(path.join(dir, 'bad.json'), '{ not valid json'); // malformed → skipped
    fs.writeFileSync(path.join(dir, 'note.txt'), 'ignored'); // non-json → ignored
    const { markers, mtimeByPath } = readActiveSessionMarkers(dir);
    assert.equal(markers.length, 2); // a + b; bad.json skipped, note.txt ignored
    assert.equal(typeof mtimeByPath[realTranscript], 'number'); // real transcript → mtime
    assert.equal(mtimeByPath[path.join(dir, 'gone.jsonl')], null); // missing transcript → null (not running)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readActiveSessionMarkers → runningProjectIds end-to-end: a fresh transcript reads running, a missing one does not (AC3/AC4/AC7)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-markers-e2e-'));
  try {
    const t = path.join(dir, 't.jsonl');
    fs.writeFileSync(t, '{}\n'); // just written → recent mtime
    fs.writeFileSync(path.join(dir, 's1.json'), JSON.stringify({ session_id: 's1', cwd: '/repos/a', transcriptPath: t }));
    const { markers, mtimeByPath } = readActiveSessionMarkers(dir);
    const running = runningProjectIds(markers, mtimeByPath, Date.now(), [{ id: 'a', path: '/repos/a' }]);
    assert.deepEqual([...running], ['a']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('clearMarker: removes the marker by session id; a missing marker is a clean no-op (AC2, cross-platform)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-clear-'));
  try {
    const markersDir = path.join(dir, 'active-sessions');
    fs.mkdirSync(markersDir, { recursive: true });
    const markerPath = path.join(markersDir, markerFilename('s9'));
    fs.writeFileSync(markerPath, JSON.stringify({ session_id: 's9' }));
    assert.ok(fs.existsSync(markerPath));
    clearMarker(dir, 's9');
    assert.equal(fs.existsSync(markerPath), false); // removed
    clearMarker(dir, 's9'); // second call — no marker, no throw
    clearMarker(dir, undefined); // no session id — no-op, no throw
    assert.ok(true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
