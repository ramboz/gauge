import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

test('runtime and example configuration use Gauge identity', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'gauge');
  assert.match(pkg.description, /Gauge/);
  const example = JSON.parse(read('gauge.config.example.json'));
  assert.equal(example.version, 1);
  assert.equal(example.stateDir, '.gauge');
  assert.ok(example.projects.every((project) => project.id && Array.isArray(project.adapters)));
  assert.doesNotMatch(read('src/server.mjs'), /DASHBOARD_CONFIG|project dashboard/);
});

test('browser consumes canonical signals and treats non-Jig observations as projects', () => {
  const html = read('public/index.html');
  assert.match(html, /<title>Gauge<\/title>/);
  assert.match(html, /function signal\(/);
  assert.match(html, /p\.signals/);
  assert.doesNotMatch(html, /p\.jigManaged|not jig-managed/);
  assert.match(html, /collection\.status/);
});

test('browser isolates malformed project cards instead of blanking the grid', () => {
  const html = read('public/index.html');
  assert.match(html, /function safeCard\(/);
  assert.match(html, /try\s*{\s*return card\(project\)/);
  assert.match(html, /data\.projects\.map\(safeCard\)/);
});

test('browser interprets only understood capability type and version pairs', () => {
  const html = read('public/index.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/load\(\);\s*setInterval\(load,120000\);/, '');
  const context = vm.createContext({});
  vm.runInContext(script, context);
  const base = {
    collection: { status: 'ok' },
    collectedAt: '2026-07-13T20:00:00Z',
    errors: [],
  };
  const payload = '"><img src=x onerror=alert(1)>';
  const malicious = {
    ...base,
    project: { id: 'future', label: 'Future adapter' },
    signals: [{
      type: 'execution', version: 2, status: 'supported',
      value: { progress: { pct: payload, done: 0, denom: 1 }, items: [] },
    }],
  };
  const healthy = {
    ...base,
    project: { id: 'healthy', label: 'Healthy project' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 50, done: 1, denom: 2, deferred: 0 }, items: [] },
    }],
  };
  const maliciousCard = context.safeCard(malicious);
  const portfolio = [malicious, healthy].map(context.safeCard).join('');
  assert.doesNotMatch(maliciousCard, /<img|onerror|alert\(1\)/);
  assert.match(maliciousCard, /Execution signal unknown/);
  assert.match(portfolio, /Healthy project/);
  assert.match(portfolio, /50%/);
});

// --- 009-01: card shows goal + deadline (AC6) ---

function cardContext() {
  const html = read('public/index.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/load\(\);\s*setInterval\(load,120000\);/, '');
  const context = vm.createContext({});
  vm.runInContext(script, context);
  return context;
}

const cardBase = {
  collection: { status: 'ok' },
  collectedAt: '2026-08-05T00:00:00Z',
  errors: [],
  signals: [],
};

test('card renders the authored goal and a concrete deadline date (AC6)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: {
      id: 'alpha', label: 'Alpha',
      goal: { value: 'Ship the MVP', provenance: 'product-vision' },
      deadline: { value: '2026-09-01', provenance: 'release' },
    },
  };
  const html = context.card(project);
  assert.match(html, /Ship the MVP/);
  assert.match(html, /2026-09-01/);
});

test('card renders an explicit "deadline: unknown" for an authored-but-unknown deadline, never blank (AC3/AC6)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: {
      id: 'alpha', label: 'Alpha',
      goal: { value: 'Ship the MVP', provenance: 'user' },
      deadline: { value: 'unknown', provenance: 'user' },
    },
  };
  const html = context.card(project);
  assert.match(html, /Deadline:\s*unknown/);
});

test('card shows an explicit "no goal set" affordance when goal is absent — never fabricated or blank (AC6)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' } };
  const html = context.card(project);
  assert.match(html, /no goal set/);
  assert.match(html, /no deadline set/);
});

test('card render does not regress when goal/deadline are entirely absent (007/008 identity)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' } };
  assert.doesNotThrow(() => context.card(project));
});

// --- 009-01 AC5: runtime never reads/parses product-vision.md, a release doc, ---
// or a README to derive a goal/deadline — the only reader of those source
// artifacts (for goal/deadline purposes) is src/discover.mjs (surfacing) and
// scripts/onboard.mjs (its CLI). This does not forbid scan.mjs's unrelated,
// pre-existing read of docs/releases/*.md for workstream display (007), which
// never produces a goal/deadline value.
test('the literal string "product-vision.md" appears only in the onboarding/discover surfacing path (AC5)', () => {
  const files = ['src/observation.mjs', 'src/scan.mjs', 'src/config.mjs', 'src/server.mjs', 'src/lib.mjs', 'src/state.mjs'];
  for (const file of files) {
    assert.doesNotMatch(read(file), /product-vision\.md/, file);
  }
  // The only runtime/CLI file allowed to reference it is discover.mjs itself.
  assert.match(read('src/discover.mjs'), /product-vision\.md/);
});

test('no runtime module (outside discover.mjs) computes a "goal" or "deadline" value from file content (AC3/AC5)', () => {
  // observation.mjs's join (joinProjectProfileFields) only ever echoes
  // `profile.goal`/`profile.deadline` — verified file-I/O-free in
  // observation.test.mjs. This is the companion static check: scan.mjs (the
  // only module that reads release-doc content, for the pre-existing
  // workstream feature) must never assign a goal/deadline field.
  const scan = read('src/scan.mjs');
  assert.doesNotMatch(scan, /\bgoal\s*:/);
  assert.doesNotMatch(scan, /\bdeadline\s*:/);
});
