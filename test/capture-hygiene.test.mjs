import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameCaptureState } from '../src/capture-hygiene.mjs';

function observation({ rev, done, denom, execStatus = 'supported' } = {}) {
  const signals = [];
  if (execStatus === 'supported') {
    signals.push({ type: 'execution', status: 'supported', value: { progress: { done, denom } } });
  } else if (execStatus) {
    signals.push({ type: 'execution', status: execStatus });
  }
  return { provenance: { sourceRevision: rev ?? null }, signals };
}

test('sameCaptureState: identical HEAD + execution {done,denom} → true', () => {
  const a = observation({ rev: 'abc123', done: 3, denom: 10 });
  const b = observation({ rev: 'abc123', done: 3, denom: 10 });
  assert.equal(sameCaptureState(a, b), true);
});

test('sameCaptureState: different HEAD → false (a commit is a genuine change point, kept)', () => {
  const a = observation({ rev: 'abc123', done: 3, denom: 10 });
  const b = observation({ rev: 'def456', done: 3, denom: 10 }); // same progress, new commit
  assert.equal(sameCaptureState(a, b), false);
});

test('sameCaptureState: same HEAD but different progress → false', () => {
  const a = observation({ rev: 'abc123', done: 3, denom: 10 });
  const b = observation({ rev: 'abc123', done: 4, denom: 10 });
  assert.equal(sameCaptureState(a, b), false);
});

test('sameCaptureState: same HEAD but different denom (scope moved) → false', () => {
  const a = observation({ rev: 'abc123', done: 3, denom: 10 });
  const b = observation({ rev: 'abc123', done: 3, denom: 12 });
  assert.equal(sameCaptureState(a, b), false);
});

test('sameCaptureState: same HEAD, both execution unsupported → true (HEAD is the key)', () => {
  const a = observation({ rev: 'abc123', execStatus: 'unknown' });
  const b = observation({ rev: 'abc123', execStatus: 'unknown' });
  assert.equal(sameCaptureState(a, b), true);
});

test('sameCaptureState: one supported, one unsupported (same HEAD) → false', () => {
  const a = observation({ rev: 'abc123', done: 3, denom: 10 });
  const b = observation({ rev: 'abc123', execStatus: 'unknown' });
  assert.equal(sameCaptureState(a, b), false);
});

test('sameCaptureState: null/absent operands → false (never coalesce on missing data)', () => {
  assert.equal(sameCaptureState(null, observation({ rev: 'x', done: 1, denom: 2 })), false);
  assert.equal(sameCaptureState(observation({ rev: 'x', done: 1, denom: 2 }), undefined), false);
});
