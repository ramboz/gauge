import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverProfile, detectLayout } from '../src/discover.mjs';
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

// --- 008-02: auto-detect + discovery emission (ADR-0010 A3) ---

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('detectLayout: nested-only specs/ resolves nested (008-02 AC1)', () => {
  const dir = tmpDir('layout-nested-');
  try {
    fs.mkdirSync(path.join(dir, 'specs', '001-x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'specs', '001-x', 'spec.md'), '# X\n');
    assert.equal(detectLayout(dir), 'nested');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectLayout: flat-only specs/ resolves flat (008-02 AC1)', () => {
  const dir = tmpDir('layout-flat-');
  try {
    fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'specs', 'a-design.md'), '# A\n');
    fs.writeFileSync(path.join(dir, 'specs', 'README.md'), '# index\n');
    assert.equal(detectLayout(dir), 'flat');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectLayout: a mixed specs/ folder resolves toward nested (008-02 AC1, ADR-0010 A3)', () => {
  const dir = tmpDir('layout-mixed-');
  try {
    fs.mkdirSync(path.join(dir, 'specs', '001-x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'specs', '001-x', 'spec.md'), '# X\n');
    fs.writeFileSync(path.join(dir, 'specs', 'stray-design.md'), '# Stray\n');
    assert.equal(detectLayout(dir), 'nested');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectLayout: an empty or missing specs/ defaults to nested (008-02 AC1)', () => {
  const dir = tmpDir('layout-empty-');
  try {
    fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'specs', 'README.md'), '# index\n');
    assert.equal(detectLayout(dir), 'nested');
    // No specs/ dir at all is indeterminate, not a crash.
    const noSpecs = tmpDir('layout-nospecs-');
    try {
      assert.equal(detectLayout(noSpecs), 'nested');
    } finally {
      fs.rmSync(noSpecs, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery emits specLayout: flat only for the flat root; the nested root gets none, exact shape (008-02 AC2)', () => {
  const result = discoverProfile(fixture('proj-mixed'));
  assert.equal(result.source, 'heuristic');
  assert.ok(Array.isArray(result.profile.entries));
  const cwv = result.profile.entries.find((e) => e.artifactRoot === 'docs/opportunities/cwv');
  const superpowers = result.profile.entries.find((e) => e.artifactRoot === 'docs/superpowers');
  assert.deepEqual(cwv, { id: 'cwv', label: 'cwv', artifactRoot: 'docs/opportunities/cwv' });
  assert.deepEqual(superpowers, {
    id: 'superpowers', label: 'superpowers', artifactRoot: 'docs/superpowers', specLayout: 'flat',
  });
  assert.deepEqual(validateProfile(result.profile), []);
});

test('discovery emits no specLayout for nested-only corpora — 007 identity preserved (008-02 AC2)', () => {
  // proj-nested (single-entry heuristic) and proj-multiroot (multi-entry
  // heuristic) are both entirely nested; neither should carry specLayout.
  const nested = discoverProfile(fixture('proj-nested'));
  assert.ok(!('specLayout' in nested.profile));

  const multiroot = discoverProfile(fixture('proj-multiroot'));
  for (const entry of multiroot.profile.entries) {
    assert.ok(!('specLayout' in entry), `${entry.id} must not carry specLayout (nested default)`);
  }

  const declared = discoverProfile(fixture('proj-umbrella'));
  for (const entry of declared.profile.entries) {
    assert.ok(!('specLayout' in entry), `${entry.id} must not carry specLayout (nested default)`);
  }
});

test('read-only smoke: onboard on mystique proposes cwv nested + superpowers flat, drop-in (008-02 AC3)', (t) => {
  const mystique = '/Users/ramboz/Projects/spacecat/mystique';
  if (!fs.existsSync(mystique)) {
    t.skip('mystique corpus absent on this machine');
    return;
  }
  // Targeted read-only check, not a full-tree snapshot: mystique/docs is a
  // large real repo (unbounded subtree size, well beyond the tiny committed
  // fixtures), so only the two directories this discovery run actually
  // touches are compared before/after.
  const listing = (dir) => fs.readdirSync(dir).sort();
  const cwvSpecs = path.join(mystique, 'docs', 'opportunities', 'cwv', 'specs');
  const superpowersSpecs = path.join(mystique, 'docs', 'superpowers', 'specs');
  const before = { cwv: listing(cwvSpecs), superpowers: listing(superpowersSpecs) };
  const result = discoverProfile(mystique);
  assert.deepEqual(listing(cwvSpecs), before.cwv, 'discoverProfile must not touch cwv/specs');
  assert.deepEqual(listing(superpowersSpecs), before.superpowers, 'discoverProfile must not touch superpowers/specs');
  assert.equal(result.source, 'heuristic');
  const cwv = result.profile.entries.find((e) => e.artifactRoot === 'docs/opportunities/cwv');
  const superpowers = result.profile.entries.find((e) => e.artifactRoot === 'docs/superpowers');
  assert.ok(cwv, 'expected a docs/opportunities/cwv entry');
  assert.ok(!('specLayout' in cwv), 'cwv is nested; must carry no specLayout');
  assert.ok(superpowers, 'expected a docs/superpowers entry');
  assert.equal(superpowers.specLayout, 'flat');
  assert.deepEqual(validateProfile(result.profile), []);
});
