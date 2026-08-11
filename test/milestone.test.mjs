import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectActiveMilestone,
  selectNextMilestones,
  attachMilestones,
  extractReferencedSpecNumbers,
  milestoneSpecProgress,
} from '../src/milestone.mjs';

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

// --- 011-02: milestone progress from referenced parent specs --------------
// Pure deriver, unit-tested directly with plain fixture objects — mirrors
// scanSpecs's per-spec shape ({ id, title, status, slices }) so callers never
// need a real filesystem scan to exercise the rollup.

function spec(id, status) {
  return { id, title: id, status, slices: [] };
}

test('AC1: extractReferencedSpecNumbers finds `spec NNN` refs, case-insensitively, in first-appearance order', () => {
  const text = 'See Spec 011 and spec 012. Also jig spec 108 (upstream).';
  assert.deepEqual(extractReferencedSpecNumbers(text), ['011', '012', '108']);
});

test('AC1: slice references (009-01) collapse onto their parent (009), counted once', () => {
  const text = '[Spec 009 — complete the loop](../specs/009-complete-local-portfolio-loop/spec.md), '
    + 'see also spec 009-01 and spec 009-02 for the sub-slices.';
  assert.deepEqual(extractReferencedSpecNumbers(text), ['009']);
});

test('AC1: a word merely containing "spec" (e.g. "respect") is not a false match', () => {
  assert.deepEqual(extractReferencedSpecNumbers('We respect the spec 011 scope.'), ['011']);
});

test('AC2: rollup is done/denom over referenced parent specs, using the existing spec-status done rule', () => {
  const specs = [spec('009-x', 'DONE'), spec('010-y', 'IN_PROGRESS'), spec('011-z', 'DONE'), spec('012-w', 'DRAFT')];
  const progress = milestoneSpecProgress('spec 009, spec 010, spec 011, spec 012', specs);
  assert.equal(progress.done, 2);
  assert.equal(progress.denom, 4);
  assert.equal(progress.total, 4);
  assert.equal(progress.pct, 50);
});

test('AC1: a slice ref and its parent ref both counted once toward the same spec (dedupe)', () => {
  const specs = [spec('009-x', 'DONE'), spec('010-y', 'DONE')];
  // "spec 009" and "spec 009-01" must not double-count spec 009-x.
  const progress = milestoneSpecProgress('spec 009-01, spec 009, spec 010', specs);
  assert.equal(progress.denom, 2);
  assert.equal(progress.done, 2);
});

test('AC2: an abandoned/dropped referenced spec is excluded from the denominator, not counted as not-done', () => {
  const specs = [spec('009-x', 'DONE'), spec('010-y', 'IN_PROGRESS'), spec('011-z', 'ABANDONED')];
  const progress = milestoneSpecProgress('spec 009, spec 010, spec 011', specs);
  // 1 done / (3 total - 1 abandoned) = 1/2, not 1/3.
  assert.equal(progress.total, 3);
  assert.equal(progress.abandoned, 1);
  assert.equal(progress.denom, 2);
  assert.equal(progress.done, 1);
  assert.equal(progress.pct, 50);
});

test('AC4: a release referencing no `spec NNN` text at all yields unknown (null), never a fabricated 0%', () => {
  const specs = [spec('009-x', 'DONE')];
  assert.equal(milestoneSpecProgress('No spec references in this prose.', specs), null);
  assert.equal(milestoneSpecProgress('', specs), null);
  assert.equal(milestoneSpecProgress(undefined, specs), null);
});

test('AC4: a release referencing only specs absent from this project\'s scanned list yields unknown, not a fabricated 0%', () => {
  const specs = [spec('009-x', 'DONE')];
  // "spec 108" is a real reference (jig's own numbering) but not one of THIS
  // project's specs — nothing resolvable, so it must not fabricate 0/0.
  assert.equal(milestoneSpecProgress('See jig spec 108 for the upstream tracker.', specs), null);
});

test('attachMilestones attaches specProgress to the active milestone from its own body + the project\'s execution items', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [
          {
            type: 'execution', status: 'supported',
            value: { items: [spec('009-x', 'DONE'), spec('010-y', 'IN_PROGRESS')] },
          },
          {
            type: 'workstreams', status: 'supported',
            value: {
              items: [{
                kind: 'release', path: 'docs/releases/a.md', status: 'committed', title: 'a.md',
                body: 'This release covers spec 009 and spec 010.',
              }],
              discovered: [],
            },
          },
        ],
      },
    ],
  };
  const out = attachMilestones(data);
  const progress = out.projects[0].milestone.active.specProgress;
  assert.equal(progress.done, 1);
  assert.equal(progress.denom, 2);
});

// --- 011-05 hop 2: referencedSpecs attached to active + next milestones ---
// so the client's worktree→milestone join (public/index.html) never needs a
// second implementation of the release→spec parse — it just reads the field.

test('attachMilestones attaches referencedSpecs (via extractReferencedSpecNumbers) to the active milestone', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [{
          type: 'workstreams', status: 'supported',
          value: {
            items: [{
              kind: 'release', path: 'docs/releases/a.md', status: 'committed', title: 'a.md',
              body: 'This release covers spec 004 and spec 009.',
            }],
            discovered: [],
          },
        }],
      },
    ],
  };
  const out = attachMilestones(data);
  assert.deepEqual(out.projects[0].milestone.active.referencedSpecs, ['004', '009']);
});

test('attachMilestones attaches referencedSpecs to each next milestone (set-valued join AC1: a spec id can appear on several releases)', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [{
          type: 'workstreams', status: 'supported',
          value: {
            items: [
              { kind: 'release', path: 'docs/releases/a.md', status: 'committed', title: 'a.md', body: 'spec 004' },
              { kind: 'release', path: 'docs/releases/b.md', status: 'candidate', title: 'b.md', body: 'spec 004 and spec 012' },
            ],
            discovered: [],
          },
        }],
      },
    ],
  };
  const out = attachMilestones(data);
  assert.deepEqual(out.projects[0].milestone.active.referencedSpecs, ['004']);
  assert.deepEqual(out.projects[0].milestone.next[0].referencedSpecs, ['004', '012']);
});

test('attachMilestones: a release with no `spec NNN` refs attaches an empty referencedSpecs array, never undefined', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [{
          type: 'workstreams', status: 'supported',
          value: { items: [{ kind: 'release', path: 'docs/releases/a.md', status: 'committed', title: 'a.md', body: 'no refs' }], discovered: [] },
        }],
      },
    ],
  };
  const out = attachMilestones(data);
  assert.deepEqual(out.projects[0].milestone.active.referencedSpecs, []);
});

test('attachMilestones: no resolvable spec refs in the active milestone body → specProgress is null (unknown)', () => {
  const data = {
    generatedAt: '2026-08-11T00:00:00Z',
    projects: [
      {
        project: { id: 'alpha', label: 'Alpha' },
        signals: [
          { type: 'execution', status: 'supported', value: { items: [spec('009-x', 'DONE')] } },
          {
            type: 'workstreams', status: 'supported',
            value: {
              items: [{ kind: 'release', path: 'docs/releases/a.md', status: 'committed', title: 'a.md', body: 'No refs here.' }],
              discovered: [],
            },
          },
        ],
      },
    ],
  };
  const out = attachMilestones(data);
  assert.equal(out.projects[0].milestone.active.specProgress, null);
});
