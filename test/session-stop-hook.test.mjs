// Tests for the SessionEnd capture hook (slice 014-01). The pure
// parse/match logic (src/session-hook.mjs) is unit-tested directly with no
// stdin/git involved; the hook entrypoint (scripts/session-stop-hook.mjs) is
// exercised end-to-end via child_process, mirroring test/snapshot.test.mjs's
// real-fixture pattern.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseHookPayload, matchProjectForCwd } from '../src/session-hook.mjs';
import { run } from '../scripts/session-stop-hook.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'session-stop-hook.mjs');

// --- src/session-hook.mjs: pure logic --------------------------------------

test('parseHookPayload: accepts the verified SessionEnd stdin shape and extracts cwd', () => {
  const payload = parseHookPayload(JSON.stringify({
    cwd: '/some/project',
    session_id: 'abc',
    transcript_path: '/tmp/t.jsonl',
    hook_event_name: 'SessionEnd',
    exit_reason: 'clear',
  }));
  assert.equal(payload.cwd, '/some/project');
});

test('parseHookPayload: rejects invalid JSON', () => {
  assert.throws(() => parseHookPayload('not json'), /invalid SessionEnd payload/);
});

test('parseHookPayload: rejects a non-object payload', () => {
  assert.throws(() => parseHookPayload('[]'), /expected a JSON object/);
  assert.throws(() => parseHookPayload('"hello"'), /expected a JSON object/);
});

test('parseHookPayload: rejects a payload missing cwd', () => {
  assert.throws(() => parseHookPayload(JSON.stringify({ session_id: 'abc' })), /missing cwd/);
});

test('matchProjectForCwd: matches when cwd equals project.path exactly', () => {
  const projects = [{ id: 'a', path: '/repos/a' }];
  const match = matchProjectForCwd(projects, '/repos/a');
  assert.equal(match.id, 'a');
});

test('matchProjectForCwd: matches a descendant cwd under project.path', () => {
  const projects = [{ id: 'a', path: '/repos/a' }];
  const match = matchProjectForCwd(projects, '/repos/a/src/nested');
  assert.equal(match.id, 'a');
});

test('matchProjectForCwd: a `.claude/worktrees/*` linked worktree cwd matches its main project (nested under project.path)', () => {
  const projects = [{ id: 'a', path: '/repos/a' }];
  const match = matchProjectForCwd(projects, '/repos/a/.claude/worktrees/some-feature');
  assert.equal(match.id, 'a');
});

test('matchProjectForCwd: nested configured entries — the longest (most specific) project.path wins', () => {
  const projects = [
    { id: 'parent', path: '/repos/parent' },
    { id: 'child', path: '/repos/parent/packages/child' },
  ];
  assert.equal(matchProjectForCwd(projects, '/repos/parent/packages/child/lib').id, 'child');
  assert.equal(matchProjectForCwd(projects, '/repos/parent/other').id, 'parent');
});

test('matchProjectForCwd: does not falsely match a sibling with a shared string prefix', () => {
  const projects = [{ id: 'a', path: '/repos/a' }];
  assert.equal(matchProjectForCwd(projects, '/repos/a-other'), null);
});

test('matchProjectForCwd: returns null for a cwd under no configured project', () => {
  const projects = [{ id: 'a', path: '/repos/a' }];
  assert.equal(matchProjectForCwd(projects, '/repos/unrelated'), null);
});

// --- scripts/session-stop-hook.mjs: end-to-end ------------------------------

function tree(root) {
  const out = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, entry.name);
      out.push(entry.isDirectory()
        ? `d:${path.relative(root, absolute)}`
        : `f:${path.relative(root, absolute)}:${fs.readFileSync(absolute, 'hex')}`);
      if (entry.isDirectory()) visit(absolute);
    }
  }
  visit(root);
  return out;
}

function runHook({ cwd, sessionId, env = {} }) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify({ cwd, session_id: sessionId, hook_event_name: 'SessionEnd', exit_reason: 'clear' }),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, `hook failed to spawn: ${result.error}`);
  return result;
}

let tmp;
let source;
let stateDir;
let configPath;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-hook-'));
  source = path.join(tmp, 'source');
  stateDir = path.join(tmp, 'state');
  configPath = path.join(tmp, 'gauge.config.json');
  fs.mkdirSync(path.join(source, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(path.join(source, 'docs', 'specs', '001-a', 'spec.md'), '---\nstatus: DONE\n---\n# Spec 001: A\n');
  fs.writeFileSync(configPath, JSON.stringify({
    version: 1,
    stateDir,
    projects: [{ id: 'source', label: 'Source', path: source, adapters: ['jig'] }],
  }));
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function recordCount() {
  try {
    return fs.readdirSync(path.join(stateDir, 'observations', 'source')).filter((n) => n.endsWith('.json')).length;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

test('AC1: a SessionEnd payload whose cwd matches a configured project writes exactly one observation record', { skip: process.platform !== 'darwin' }, () => {
  const before = recordCount();
  const result = runHook({ cwd: source, sessionId: 's1', env: { GAUGE_CONFIG: configPath } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(recordCount(), before + 1);
  const records = fs.readdirSync(path.join(stateDir, 'observations', 'source')).filter((n) => n.endsWith('.json'));
  const latest = records.sort().at(-1);
  const observation = JSON.parse(fs.readFileSync(path.join(stateDir, 'observations', 'source', latest), 'utf8'));
  assert.equal(observation.project.id, 'source');
});

test('AC1: a nested cwd (subdirectory of project.path, e.g. a worktree) also matches and writes', { skip: process.platform !== 'darwin' }, () => {
  const nestedCwd = path.join(source, '.claude', 'worktrees', 'feature-x');
  fs.mkdirSync(nestedCwd, { recursive: true });
  const result = runHook({ cwd: nestedCwd, sessionId: 's2', env: { GAUGE_CONFIG: configPath } });
  assert.equal(result.status, 0);
  // 014-02: the hook coalesces identical-state captures (this run observes the
  // same unchanged `source` main tree as prior runs), so the project keeps
  // exactly one record at the newest capture rather than accreting one per run.
  assert.equal(recordCount(), 1);
});

test('AC2: an unmatched cwd is a clean no-op — exit 0, no stdout, one stderr diagnostic, no new record', { skip: process.platform !== 'darwin' }, () => {
  const before = recordCount();
  const result = runHook({ cwd: path.join(tmp, 'unrelated'), sessionId: 's3', env: { GAUGE_CONFIG: configPath } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  const stderrLines = result.stderr.trim().split('\n').filter(Boolean);
  assert.equal(stderrLines.length, 1);
  assert.match(stderrLines[0], /no configured project matches cwd/);
  assert.equal(recordCount(), before);
});

test('AC3: the hook never writes inside any configured project.path (read-only-source boundary)', { skip: process.platform !== 'darwin' }, () => {
  const beforeTree = tree(source);
  runHook({ cwd: source, sessionId: 's5', env: { GAUGE_CONFIG: configPath } });
  assert.deepEqual(tree(source), beforeTree);
});

test('AC5: the write is atomic — no leftover temp files in the state dir after a run', { skip: process.platform !== 'darwin' }, () => {
  runHook({ cwd: source, sessionId: 's6', env: { GAUGE_CONFIG: configPath } });
  const leftovers = fs.readdirSync(path.join(stateDir, 'observations', 'source')).filter((n) => n.includes('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('AC7: a malformed config surfaces a stderr diagnostic and a non-disruptive exit 0, never throws', () => {
  const badConfig = path.join(tmp, 'bad.config.json');
  fs.writeFileSync(badConfig, '{ this is not json');
  const result = runHook({ cwd: source, sessionId: 's7', env: { GAUGE_CONFIG: badConfig } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /failed to load config/);
});

test('AC7: an unreadable/invalid stateDir (a file where a directory is expected) surfaces a diagnostic, never a crash, and leaves no partial record', { skip: process.platform !== 'darwin' }, () => {
  const brokenTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-hook-broken-'));
  const brokenSource = path.join(brokenTmp, 'source');
  fs.mkdirSync(brokenSource, { recursive: true });
  const brokenStateDir = path.join(brokenTmp, 'state-is-a-file');
  fs.writeFileSync(brokenStateDir, 'not a directory');
  const brokenConfig = path.join(brokenTmp, 'gauge.config.json');
  fs.writeFileSync(brokenConfig, JSON.stringify({
    version: 1,
    stateDir: brokenStateDir,
    projects: [{ id: 'broken', label: 'Broken', path: brokenSource, adapters: [] }],
  }));
  const result = runHook({ cwd: brokenSource, sessionId: 's8', env: { GAUGE_CONFIG: brokenConfig } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /failed to capture snapshot/);
  fs.rmSync(brokenTmp, { recursive: true, force: true });
});

// --- Reconciliation: in-process run() coverage (014-01 review nit) ----------
// The exported run() is both a test seam and the 014-04 extension point; this
// drives the capture path in-process (no child, no real stdin) to keep the
// export honest.
test('run(): in-process capture writes a record for a matched cwd (coalesced to the newest)', async () => {
  const prevConfig = process.env.GAUGE_CONFIG;
  process.env.GAUGE_CONFIG = configPath;
  try {
    await run({ rawStdin: JSON.stringify({ cwd: source, session_id: 'inproc', hook_event_name: 'SessionEnd' }) });
  } finally {
    if (prevConfig === undefined) delete process.env.GAUGE_CONFIG;
    else process.env.GAUGE_CONFIG = prevConfig;
  }
  // 014-02 coalescing: identical-state captures against the unchanged `source`
  // collapse to one record at the newest collectedAt.
  assert.equal(recordCount(), 1, 'run() captures the matched project (coalesced to one record)');
});

test('run(): an unmatched cwd writes nothing (in-process no-op)', async () => {
  const before = recordCount();
  const prevConfig = process.env.GAUGE_CONFIG;
  process.env.GAUGE_CONFIG = configPath;
  try {
    await run({ rawStdin: JSON.stringify({ cwd: '/nowhere/unconfigured', session_id: 'inproc2' }) });
  } finally {
    if (prevConfig === undefined) delete process.env.GAUGE_CONFIG;
    else process.env.GAUGE_CONFIG = prevConfig;
  }
  assert.equal(recordCount(), before, 'run() must not write for an unmatched cwd');
});
