import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverProfile } from '../src/discover.mjs';
import { validateProfile } from '../src/profile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(HERE, 'fixtures', name);
const ONBOARD = path.join(HERE, '..', 'scripts', 'onboard.mjs');

// Run the onboard CLI as a child process (AC1 is phrased around the command).
function onboard(...argv) {
  return spawnSync(process.execPath, [ONBOARD, ...argv], { encoding: 'utf8' });
}

// Snapshot every file's path + mtime under a dir (read-only assertion, AC4).
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = fs.statSync(p).mtimeMs;
    }
  };
  walk(dir);
  return out;
}

test('heuristic single nested root: proj-nested → artifactRoot docs/opportunities/cwv (AC1)', () => {
  const result = discoverProfile(fixture('proj-nested'));
  assert.equal(result.source, 'heuristic');
  assert.deepEqual(result.profile, { artifactRoot: 'docs/opportunities/cwv' });
  assert.deepEqual(validateProfile(result.profile), []);
});

test('heuristic multi nested root drops the bare-docs incidental root (AC1, mystique)', () => {
  const result = discoverProfile(fixture('proj-multiroot'));
  assert.equal(result.source, 'heuristic');
  assert.ok(Array.isArray(result.profile.entries), 'expected a multi-entry profile');
  const roots = result.profile.entries.map((e) => e.artifactRoot);
  assert.deepEqual(roots, ['docs/opportunities/cwv', 'docs/superpowers']);
  // The stray docs/specs incidental root must not appear as an entry.
  assert.ok(!roots.includes('docs'), 'bare docs root must be excluded');
  assert.deepEqual(result.profile.entries.map((e) => e.id), ['cwv', 'superpowers']);
  assert.deepEqual(result.profile.entries.map((e) => e.label), ['cwv', 'superpowers']);
  assert.deepEqual(validateProfile(result.profile), []);
});

test('declaration via tracks/* layout: proj-umbrella → 3 entries incl. decisions-only track (AC2)', () => {
  const result = discoverProfile(fixture('proj-umbrella'));
  assert.equal(result.source, 'declaration');
  assert.deepEqual(result.profile.entries.map((e) => e.id), ['a', 'b', 'c']);
  assert.deepEqual(result.profile.entries.map((e) => e.artifactRoot), ['tracks/a', 'tracks/b', 'tracks/c']);
  assert.ok(result.notes.some((n) => /tracks\/\*/.test(n)), 'note should cite tracks/* layout');
  assert.deepEqual(validateProfile(result.profile), []);
});

test('declaration via repos.yaml scope tags drives entry ordering (AC2)', () => {
  const result = discoverProfile(fixture('proj-declared'));
  assert.equal(result.source, 'declaration');
  // Dirs sort alpha < beta, but repos.yaml declares scope beta before alpha.
  assert.deepEqual(result.profile.entries.map((e) => e.id), ['beta', 'alpha']);
  assert.deepEqual(result.profile.entries.map((e) => e.artifactRoot), ['tracks/beta', 'tracks/alpha']);
  assert.ok(result.notes.some((n) => /repos\.yaml/.test(n)), 'note should cite repos.yaml');
  assert.deepEqual(validateProfile(result.profile), []);
});

test('default flat layout: proj-jig → artifactRoot docs, source default (AC1)', () => {
  const result = discoverProfile(fixture('proj-jig'));
  assert.equal(result.source, 'default');
  assert.deepEqual(result.profile, { artifactRoot: 'docs' });
  assert.deepEqual(validateProfile(result.profile), []);
});

test('none: a source with no jig artifacts yields a null profile (AC1)', () => {
  const result = discoverProfile(fixture('proj-plain'));
  assert.equal(result.source, 'none');
  assert.equal(result.profile, null);
  assert.ok(result.notes.some((n) => /no jig artifacts/.test(n)));
});

test('discovery is read-only: no writes to the source (AC4)', () => {
  const dir = fixture('proj-multiroot');
  const before = snapshot(dir);
  discoverProfile(dir);
  const after = snapshot(dir);
  assert.deepEqual(after, before, 'discoverProfile must not create or touch any file');
});

test('discover module is edge-reusable: imports none of observation/state/server (AC5)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'src', 'discover.mjs'), 'utf8');
  for (const forbidden of ['observation.mjs', 'state.mjs', 'server.mjs']) {
    assert.ok(!src.includes(forbidden), `discover.mjs must not import ${forbidden} (pure, edge-reusable)`);
  }
});

test('onboard CLI emits a drop-in profile on stdout, meta on stderr, exit 0 (AC1/AC3)', () => {
  const run = onboard('--path', fixture('proj-umbrella'));
  assert.equal(run.status, 0);
  const profile = JSON.parse(run.stdout); // stdout must be clean JSON for piping
  assert.deepEqual(profile.entries.map((e) => e.id), ['a', 'b', 'c']);
  assert.deepEqual(validateProfile(profile), []);
  assert.match(run.stderr, /source=declaration/);
});

test('onboard CLI fails gracefully without --path (AC1)', () => {
  const run = onboard();
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /--path <repo> is required/);
  assert.match(run.stderr, /usage:/);
  assert.equal(run.stdout, '');
});

test('onboard CLI fails on a source with no jig artifacts (AC1)', () => {
  const run = onboard('--path', fixture('proj-plain'));
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /no jig artifacts detected/);
  assert.equal(run.stdout, '');
});
