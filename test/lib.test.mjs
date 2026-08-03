import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  progressOf,
  parseRunbook,
  countCheckboxes,
  countInboxItems,
  countRefinement,
  parseCompassHistory,
  validateSnapshot,
  ownerOf,
  ageLabel,
  ageDays,
} from '../src/lib.mjs';

test('parseFrontmatter: flat keys, arrays, quotes, comments', () => {
  const { data, body } = parseFrontmatter(
    '---\nstatus: DONE\ndependencies: [002-01, 002-02]\n# a comment line\nlast_verified: 2026-07-13\ntitle: "quoted"\nempty:\n---\nbody here'
  );
  assert.equal(data.status, 'DONE');
  assert.deepEqual(data.dependencies, ['002-01', '002-02']);
  assert.equal(data.last_verified, '2026-07-13');
  assert.equal(data.title, 'quoted');
  assert.equal(data.empty, null);
  assert.equal(body.trim(), 'body here');
});

test('parseFrontmatter: no frontmatter → empty data, body untouched', () => {
  const { data, body } = parseFrontmatter('# just a doc');
  assert.deepEqual(data, {});
  assert.equal(body, '# just a doc');
});

test('parseFrontmatter: strips unquoted inline comments, keeps quoted # (real jig defect)', () => {
  const { data } = parseFrontmatter(
    '---\nstatus: IN_PROGRESS  # 083-08 handoff remains DRAFT —\nlang: "C#"\nnote:  # only a comment\n---\n'
  );
  // A whitespace-preceded # begins a YAML comment and must not pollute the value.
  assert.equal(data.status, 'IN_PROGRESS');
  // A quoted value keeps its #, and a bare-# value is an empty (null) scalar.
  assert.equal(data.lang, 'C#');
  assert.equal(data.note, null);
});

test('progressOf: ABANDONED leaves denominator, DEFERRED reported separately (AC2)', () => {
  const items = [
    ...Array(27).fill({ status: 'DONE' }),
    { status: 'IN_PROGRESS' },
    { status: 'ABANDONED' },
    { status: 'ABANDONED' },
  ];
  const p = progressOf(items);
  assert.equal(p.total, 30);
  assert.equal(p.denom, 28);
  assert.equal(p.done, 27);
  assert.equal(p.pct, 96);

  const withDeferred = progressOf([{ status: 'DONE' }, { status: 'DEFERRED' }]);
  assert.equal(withDeferred.deferred, 1);
  assert.equal(withDeferred.pct, 50);
});

test('progressOf: empty and all-abandoned yield null pct, not NaN', () => {
  assert.equal(progressOf([]).pct, null);
  assert.equal(progressOf([{ status: 'ABANDONED' }]).pct, null);
});

test('parseRunbook: numbered steps win, sub-bullets ignored, owner tags parsed (002-02 AC2)', () => {
  const text = [
    '# Caption runbook',
    '## What finished means',
    '- [ ] loop closed',
    '- [ ] gaps fixed',
    '### Phase A — close the loop',
    '1. [ ] **(you)** First curation round.',
    '### Phase B — fix it',
    '2. [ ] **(Claude)** New small spec.',
    '   - [ ] sub item ignored',
    '3. [x] **GENERATION RUN (you, tokens)** — fresh batch.',
  ].join('\n');
  const rb = parseRunbook(text);
  assert.equal(rb.title, 'Caption runbook');
  assert.deepEqual(rb.steps, { done: 1, total: 3 });
  assert.equal(rb.currentPhase, 'Phase A — close the loop');
  assert.equal(rb.next.owner, 'you');
  assert.match(rb.next.text, /First curation round/);
  assert.deepEqual(rb.phases, ['Phase A — close the loop', 'Phase B — fix it']);
});

test('parseRunbook: bulleted fallback counts only top-level boxes', () => {
  const rb = parseRunbook('# Plan\n- [x] one\n- [ ] two\n  - [ ] nested ignored\n');
  assert.deepEqual(rb.steps, { done: 1, total: 2 });
  assert.equal(rb.next.text, 'two');
});

test('parseRunbook: no checkboxes → phases from headings, no next', () => {
  const rb = parseRunbook('# Roadmap\n## Phase 1 — beta\n## Phase 2 — GA\n');
  assert.equal(rb.steps.total, 0);
  assert.equal(rb.next, null);
  assert.deepEqual(rb.phases, ['Phase 1 — beta', 'Phase 2 — GA']);
});

test('countCheckboxes counts all indent levels', () => {
  assert.deepEqual(countCheckboxes('- [x] a\n  - [ ] b\n1. [ ] c\n'), { done: 1, total: 3 });
});

test('countInboxItems counts only dated bullets', () => {
  assert.equal(countInboxItems('- [2026-07-01] a\n- [2026-07-02] b\n- plain\n'), 2);
});

test('countRefinement: RESOLVED heading closed, partial stays open', () => {
  const text = [
    '### Decision: One — RESOLVED',
    '**Resolved (2026-07-01):** yes.',
    '### Decision: Two',
    '**Deferred:** no signal.',
    '### Decision: Three (partially resolved)',
    '**Resolved:** part.',
    '**Still deferred:** rest.',
  ].join('\n');
  assert.deepEqual(countRefinement(text), { open: 2, total: 3 });
});

test('parseCompassHistory: last valid line wins, malformed skipped (002-03 AC2)', () => {
  const text =
    '{"v":1,"ts":"2026-07-10T08:00:00Z","headline":"old"}\n' +
    '{"v":1,"ts":"2026-07-12T20:00:00Z","headline":"newer","next":"do x"}\n' +
    'not json at all\n';
  const { latest, malformed, count } = parseCompassHistory(text);
  assert.equal(latest.headline, 'newer');
  assert.equal(malformed, 1);
  assert.equal(count, 3);
});

test('parseCompassHistory: empty text → no latest', () => {
  assert.equal(parseCompassHistory('').latest, null);
});

test('parseCompassHistory: unparseable ts counts as malformed, never surfaces (review finding 5)', () => {
  const { latest, malformed } = parseCompassHistory('{"v":1,"ts":"garbage","headline":"x"}\n');
  assert.equal(latest, null);
  assert.equal(malformed, 1);
});

test('validateSnapshot enforces full ADR-0002 schema incl. v and specs (review finding 3)', () => {
  const ok = { v: 1, ts: '2026-07-13T08:00:00Z', headline: 'ok' };
  assert.equal(validateSnapshot(ok).length, 0);
  assert.equal(validateSnapshot({ ...ok, specs: { done: 1, total: 2 } }).length, 0);
  assert.ok(validateSnapshot({ ts: '2026-07-13T08:00:00Z', headline: 'no v' }).length > 0);
  assert.ok(validateSnapshot({ v: 1, headline: 'no ts' }).length > 0);
  assert.ok(validateSnapshot({ v: 1, ts: 'not-a-date', headline: 'x' }).length > 0);
  assert.ok(validateSnapshot({ ...ok, blockers: 'nope' }).length > 0);
  assert.ok(validateSnapshot({ ...ok, specs: { done: 'one' } }).length > 0);
});

test('ownerOf: only bold owner tags match (review finding 2)', () => {
  assert.equal(ownerOf('**(you)** First curation round'), 'you');
  assert.equal(ownerOf('**(Claude)** New small spec'), 'claude');
  assert.equal(ownerOf('**GENERATION RUN (you, tokens)** — fresh batch'), 'you');
  assert.equal(ownerOf('pick whatever suits (your choice)'), null);
  assert.equal(ownerOf('**(your choice)** of options'), null);
  assert.equal(ownerOf('plain (you) without bold'), null);
});

test('ageLabel: morning/afternoon/evening/yesterday/N days, null on garbage (002-03 AC3+AC5)', () => {
  const now = new Date('2026-07-13T20:00:00').getTime();
  assert.equal(ageLabel('2026-07-13T09:00:00', now), 'this morning');
  assert.equal(ageLabel('2026-07-13T14:00:00', now), 'this afternoon');
  assert.equal(ageLabel('2026-07-13T19:00:00', now), 'this evening');
  assert.equal(ageLabel('2026-07-12T22:00:00', now), 'yesterday');
  assert.equal(ageLabel('2026-07-10T08:00:00', now), '3 days ago');
  assert.equal(ageLabel('garbage', now), null);
  assert.equal(ageDays('2026-07-10T20:00:00', now), 3);
  assert.equal(ageDays('garbage', now), null);
});
