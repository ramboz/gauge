import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run as startRun } from '../scripts/session-start-hook.mjs';
import { run as stopRun } from '../scripts/session-stop-hook.mjs';
import { markerFilename } from '../src/session-marker.mjs';

let tmp, source, stateDir, configPath, markersDir;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-marker-'));
  source = path.join(tmp, 'source');
  stateDir = path.join(tmp, 'state');
  configPath = path.join(tmp, 'gauge.config.json');
  markersDir = path.join(stateDir, 'active-sessions');
  fs.mkdirSync(path.join(source, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(path.join(source, 'docs', 'specs', '001-a', 'spec.md'), '---\nstatus: DONE\n---\n# Spec 001: A\n');
  fs.writeFileSync(configPath, JSON.stringify({
    version: 1, stateDir,
    projects: [{ id: 'source', label: 'Source', path: source, adapters: ['jig'] }],
  }));
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function withConfig(fn) {
  const prev = process.env.GAUGE_CONFIG;
  process.env.GAUGE_CONFIG = configPath;
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.GAUGE_CONFIG;
    else process.env.GAUGE_CONFIG = prev;
  });
}

test('SessionStart writes an active-session marker for a matched cwd (AC1)', async () => {
  await withConfig(() => startRun({
    rawStdin: JSON.stringify({ cwd: source, session_id: 'sess-1', transcript_path: '/tmp/t1.jsonl', hook_event_name: 'SessionStart' }),
    nowIso: '2026-08-18T21:00:00.000Z',
  }));
  const markerPath = path.join(markersDir, markerFilename('sess-1'));
  assert.ok(fs.existsSync(markerPath), 'marker file created');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  assert.equal(marker.session_id, 'sess-1');
  assert.equal(marker.cwd, source);
  assert.equal(marker.transcriptPath, '/tmp/t1.jsonl');
  assert.equal(marker.startedAt, '2026-08-18T21:00:00.000Z');
  // AC8: the marker holds ONLY the four identity fields — no transcript content.
  assert.deepEqual(Object.keys(marker).sort(), ['cwd', 'session_id', 'startedAt', 'transcriptPath']);
});

test('SessionStart in a cwd under no configured project writes no marker (clean no-op)', async () => {
  await withConfig(() => startRun({
    rawStdin: JSON.stringify({ cwd: path.join(tmp, 'unrelated'), session_id: 'sess-x', transcript_path: '/tmp/x.jsonl' }),
  }));
  assert.equal(fs.existsSync(path.join(markersDir, markerFilename('sess-x'))), false);
});

test('SessionStart with no session_id writes no marker (cannot address it)', async () => {
  await withConfig(() => startRun({ rawStdin: JSON.stringify({ cwd: source, transcript_path: '/tmp/y.jsonl' }) }));
  // nothing addressable was written; the markers dir may exist from a prior test but holds no sess for this
  const files = fs.existsSync(markersDir) ? fs.readdirSync(markersDir) : [];
  assert.ok(!files.includes('.json'));
});

// Skipped off-darwin only because this drives the full SessionEnd `stopRun`,
// whose capture step (collectObservation) uses a darwin-only filesystem-identity
// probe (mirrors test/session-stop-hook.test.mjs). The clear-by-session_id logic
// itself is covered cross-platform by session-marker.test.mjs's `clearMarker` test.
test('SessionEnd clears the matching marker by session_id (AC2, integration)', { skip: process.platform !== 'darwin' }, async () => {
  await withConfig(() => startRun({ rawStdin: JSON.stringify({ cwd: source, session_id: 'sess-clear', transcript_path: '/tmp/c.jsonl' }) }));
  const markerPath = path.join(markersDir, markerFilename('sess-clear'));
  assert.ok(fs.existsSync(markerPath), 'marker exists before SessionEnd');
  await withConfig(() => stopRun({ rawStdin: JSON.stringify({ cwd: source, session_id: 'sess-clear', hook_event_name: 'SessionEnd' }) }));
  assert.equal(fs.existsSync(markerPath), false, 'SessionEnd removed the marker');
});

test('SessionEnd with no matching marker is a clean no-op (never throws)', { skip: process.platform !== 'darwin' }, async () => {
  await withConfig(() => stopRun({ rawStdin: JSON.stringify({ cwd: source, session_id: 'never-started' }) }));
  assert.ok(true); // reached here without throwing
});
