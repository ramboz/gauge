// Integration tests for the compatibility-named central Gauge collector.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'snapshot.mjs');
let tmp;
let source;
let stateDir;
let configPath;

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

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-collect-'));
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

test('snapshot compatibility command collects central Gauge observations without source writes', { skip: process.platform !== 'darwin' }, () => {
  const beforeTree = tree(source);
  const output = execFileSync(process.execPath, [SCRIPT, '--config', configPath], { encoding: 'utf8' });
  assert.match(output, /Gauge collected Source/);
  assert.deepEqual(tree(source), beforeTree);
  assert.equal(fs.existsSync(path.join(source, 'docs', 'status', 'compass-history.jsonl')), false);
  const records = fs.readdirSync(path.join(stateDir, 'observations', 'source'));
  assert.equal(records.filter((name) => name.endsWith('.json')).length, 1);
  const observation = JSON.parse(fs.readFileSync(path.join(stateDir, 'observations', 'source', records[0]), 'utf8'));
  assert.equal(observation.schemaVersion, 1);
  assert.equal(observation.project.id, 'source');
});

test('collector requires a Gauge config rather than accepting a source write target', () => {
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, '--project', source, '--headline', 'old'], { stdio: 'pipe' }));
  assert.equal(fs.existsSync(path.join(source, 'docs', 'status', 'compass-history.jsonl')), false);
});
