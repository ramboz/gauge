import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectActiveMilestone, selectNextMilestones, attachMilestones } from '../src/milestone.mjs';

// --- 011-01: active-and-next milestone from release Status -----------------
// Pure, unit-testable deriver over an already-scanned workstreams array
// (src/scan.mjs's scanWorkstreams output, each release enriched with a
// `status` field parsed from its `## Status`). No filesystem access here —
// plain fixture objects are enough to exercise every AC.

function release(path, status, extra = {}) {
  return { kind: 'release', path, status, title: path, ...extra };
}

test('AC1: shipping wins over committed', () => {
  const ws = [release('docs/releases/b.md', 'committed'), release('docs/releases/a.md', 'shipping')];
  const active = selectActiveMilestone(ws);
  assert.equal(active.path, 'docs/releases/a.md');
});

test('AC1: committed is active when no shipping release exists', () => {
  const ws = [release('docs/releases/b.md', 'candidate'), release('docs/releases/a.md', 'committed')];
  const active = selectActiveMilestone(ws);
  assert.equal(active.path, 'docs/releases/a.md');
});

test('AC1/AC2: shipped/dropped are never active or next', () => {
  const ws = [release('a.md', 'shipped'), release('b.md', 'dropped')];
  assert.equal(selectActiveMilestone(ws), null);
  assert.deepEqual(selectNextMilestones(ws, null), []);
});

test('AC1: tie-break among several releases sharing the winning status is deterministic (lexicographic by path)', () => {
  const ws = [release('docs/releases/zed.md', 'shipping'), release('docs/releases/alpha.md', 'shipping')];
  assert.equal(selectActiveMilestone(ws).path, 'docs/releases/alpha.md');
  // Order-independence: reversing input order yields the same winner.
  assert.equal(selectActiveMilestone([...ws].reverse()).path, 'docs/releases/alpha.md');
});

test('AC2: next list is every candidate plus any committed release not chosen active, in stable order, excluding shipped/dropped', () => {
  const ws = [
    release('docs/releases/d-shipping.md', 'shipping'),
    release('docs/releases/b-committed.md', 'committed'),
    release('docs/releases/a-candidate.md', 'candidate'),
    release('docs/releases/e-shipped.md', 'shipped'),
    release('docs/releases/f-dropped.md', 'dropped'),
  ];
  const active = selectActiveMilestone(ws);
  assert.equal(active.path, 'docs/releases/d-shipping.md');
  const next = selectNextMilestones(ws, active);
  assert.deepEqual(next.map((m) => m.path), ['docs/releases/a-candidate.md', 'docs/releases/b-committed.md']);
});

test('AC2: when active is a committed release, the remaining committed releases still surface as next', () => {
  const ws = [release('docs/releases/a-committed.md', 'committed'), release('docs/releases/b-committed.md', 'committed')];
  const active = selectActiveMilestone(ws);
  assert.equal(active.path, 'docs/releases/a-committed.md');
  const next = selectNextMilestones(ws, active);
  assert.deepEqual(next.map((m) => m.path), ['docs/releases/b-committed.md']);
});

test('AC6: no active milestone when every release is shipped/dropped, or status did not parse — graceful, no crash', () => {
  const ws = [release('a.md', null), release('b.md', 'shipped'), release('c.md', 'dropped')];
  assert.doesNotThrow(() => selectActiveMilestone(ws));
  assert.equal(selectActiveMilestone(ws), null);
  assert.deepEqual(selectNextMilestones(ws, null), []);
  // Empty/absent workstreams input degrades the same way.
  assert.equal(selectActiveMilestone([]), null);
  assert.equal(selectActiveMilestone(undefined), null);
  assert.deepEqual(selectNextMilestones(undefined, null), []);
});

test('non-release workstreams (pinned runbooks, discovered checklists) never become active or next', () => {
  const ws = [
    { kind: 'runbook', path: 'docs/runbook.md', status: 'committed' },
    release('docs/releases/a.md', 'committed'),
  ];
  const active = selectActiveMilestone(ws);
  assert.equal(active.path, 'docs/releases/a.md');
  assert.deepEqual(selectNextMilestones(ws, active), []);
});

// --- attachMilestones: read-layer composition, mirroring derive.mjs's -----
// attachForecasts/attentionQueue style (structural signal lookup, no I/O).

test('attachMilestones reads the workstreams signal per project and attaches {active, next}', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [{
          type: 'workstreams', status: 'supported',
          value: { items: [release('docs/releases/a.md', 'committed')], discovered: [] },
        }],
      },
    ],
  };
  const out = attachMilestones(data);
  assert.equal(out.projects[0].milestone.active.path, 'docs/releases/a.md');
  assert.deepEqual(out.projects[0].milestone.next, []);
});

test('attachMilestones degrades to {active: null, next: []} when the workstreams signal is missing/unsupported', () => {
  const data = { generatedAt: '2026-08-11T00:00:00Z', projects: [{ project: { id: 'alpha' }, signals: [] }] };
  const out = attachMilestones(data);
  assert.deepEqual(out.projects[0].milestone, { active: null, next: [] });
});

test('attachMilestones does not mutate its input', () => {
  const data = { generatedAt: '2026-08-11T00:00:00Z', projects: [{ project: { id: 'alpha' }, signals: [] }] };
  attachMilestones(data);
  assert.equal(data.projects[0].milestone, undefined);
});
