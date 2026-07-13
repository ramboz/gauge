// Integration tests for scripts/snapshot.mjs (slice 002-03 AC5) against a
// throwaway project in a temp dir — fixtures stay pristine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/scan.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'snapshot.mjs');
let tmp;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-snap-'));
  fs.mkdirSync(path.join(tmp, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'docs', 'specs', '001-a', 'spec.md'), '---\nstatus: DONE\n---\n# Spec 001: A\n');
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const cfg = () => ({ path: tmp, pinnedWorkstreams: [], hiddenWorkstreams: [] });
const historyFile = () => path.join(tmp, 'docs', 'status', 'compass-history.jsonl');

test('missing history file → compass null, no warnings (002-03 AC2)', () => {
  const p = scanProject(cfg());
  assert.equal(p.compass, null);
  assert.deepEqual(p.warnings, []);
});

test('snapshot.mjs appends a valid line with auto-filled specs (002-03 AC4+AC5)', () => {
  execFileSync(process.execPath, [SCRIPT, '--project', tmp, '--headline', 'first', '--next', 'do x', '--blockers', 'a; b']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const snap = JSON.parse(lines[0]);
  assert.equal(snap.v, 1);
  assert.equal(snap.headline, 'first');
  assert.deepEqual(snap.blockers, ['a', 'b']);
  assert.deepEqual(snap.specs, { done: 1, total: 1 });

  execFileSync(process.execPath, [SCRIPT, '--project', tmp, '--headline', 'second']);
  const after2 = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  assert.equal(after2.length, 2, 'append-only: second run adds a line');

  const p = scanProject(cfg());
  assert.equal(p.compass.headline, 'second');
  assert.equal(typeof p.compass.ageLabel, 'string');
  assert.equal(p.compass.stale, false);
});

test('snapshot.mjs --auto builds a deterministic headline and tags source (routine mode)', () => {
  execFileSync(process.execPath, [SCRIPT, '--project', tmp, '--auto']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  const snap = JSON.parse(lines[lines.length - 1]);
  assert.equal(snap.source, 'auto');
  assert.match(snap.headline, /^auto: 1\/1 specs done/);
  assert.deepEqual(snap.specs, { done: 1, total: 1 });
});

test('snapshot.mjs refuses invalid input and writes nothing (002-03 AC4)', () => {
  const beforeText = fs.readFileSync(historyFile(), 'utf8');
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, '--project', tmp], { stdio: 'pipe' }));
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, '--project', tmp, '--headline', 'x', '--ts', 'garbage'], { stdio: 'pipe' })
  );
  assert.equal(fs.readFileSync(historyFile(), 'utf8'), beforeText, 'file unchanged after refusals');
});
