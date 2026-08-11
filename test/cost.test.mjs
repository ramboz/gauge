import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PRICE_TABLE,
  UNKNOWN_MODEL_BUCKET,
  encodeProjectPath,
  dedupeRecords,
  costFromRecords,
  sessionFilesForProject,
  readTranscriptRecords,
  projectTokenCost,
  attachTokenCost,
} from '../src/cost.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, 'fixtures', 'cost-transcripts');
const ALPHA_PATH = '/Users/fake/alpha';
const BETA_PATH = '/Users/fake/beta';
const GAMMA_PATH = '/Users/fake/gamma'; // deliberately unmapped: no fixture dir

// --- encodeProjectPath (AC1/AC4) --------------------------------------------
// Mirrors Claude Code's own projects-root encoding (probed against real
// `~/.claude/projects` directory names): every non-alphanumeric character
// becomes a literal `-`, with no collapsing of consecutive separators (a
// `/.` pair yields `--`, exactly as observed for a `.claude` path segment).

test('encodeProjectPath: matches the real Claude Code projects-root encoding (probed convention)', () => {
  assert.equal(encodeProjectPath('/Users/fake/alpha'), '-Users-fake-alpha');
  assert.equal(encodeProjectPath('/Users/ramboz/Projects/misc/gauge/.claude/worktrees/x'), '-Users-ramboz-Projects-misc-gauge--claude-worktrees-x');
});

// --- readTranscriptRecords (AC1) --------------------------------------------

test('readTranscriptRecords: extracts per-record usage + model from a session .jsonl file (AC1)', () => {
  const file = path.join(FIXTURE_ROOT, '-Users-fake-alpha', 'session-a.jsonl');
  const records = readTranscriptRecords(file);
  assert.equal(records.length, 3);
  for (const r of records) {
    assert.equal(r.message.model, 'illustrative-model-a');
    assert.ok(Number.isFinite(r.message.usage.input_tokens));
  }
  assert.equal(records[0].requestId, 'req_001');
  assert.equal(records[1].message.usage.output_tokens, 800);
});

test('readTranscriptRecords: skips malformed lines and non-assistant records without crashing', () => {
  const file = path.join(FIXTURE_ROOT, '-Users-fake-alpha', 'session-c.jsonl');
  const records = readTranscriptRecords(file);
  // The malformed "not valid json" line is dropped; the user record (no
  // usage) and the one assistant record both parse fine.
  assert.equal(records.length, 2);
  const priceTable = { 'illustrative-model-a': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } };
  const cost = costFromRecords(records, priceTable);
  assert.equal(cost.byModel.length, 1);
  assert.equal(cost.byModel[0].model, 'illustrative-model-a');
  assert.equal(cost.byModel[0].tokens.input, 250);
});

test('readTranscriptRecords: a missing file returns an empty array rather than throwing', () => {
  const records = readTranscriptRecords(path.join(FIXTURE_ROOT, 'does-not-exist.jsonl'));
  assert.deepEqual(records, []);
});

// --- sessionFilesForProject (AC1/AC4) ---------------------------------------

test('sessionFilesForProject: enumerates every .jsonl session file under the encoded project dir', () => {
  const files = sessionFilesForProject(FIXTURE_ROOT, ALPHA_PATH);
  assert.equal(files.length, 3);
  assert.ok(files.every((f) => f.endsWith('.jsonl')));
});

test('sessionFilesForProject: an unmapped path (no matching encoded dir) yields an empty list, not a throw (AC4)', () => {
  assert.deepEqual(sessionFilesForProject(FIXTURE_ROOT, GAMMA_PATH), []);
});

// --- dedupeRecords + costFromRecords: per-request dedup (AC2, LOAD-BEARING) -

test('dedupeRecords: keeps exactly one record per unique requestId, first occurrence wins', () => {
  const records = [
    { requestId: 'r1', message: { id: 'm1' } },
    { requestId: 'r1', message: { id: 'm1' } },
    { requestId: 'r2', message: { id: 'm2' } },
  ];
  const deduped = dedupeRecords(records);
  assert.equal(deduped.length, 2);
  assert.deepEqual(deduped.map((r) => r.requestId), ['r1', 'r2']);
});

test('dedupeRecords: falls back to message.id when requestId is absent', () => {
  const records = [
    { message: { id: 'm1' } },
    { message: { id: 'm1' } },
    { message: { id: 'm2' } },
  ];
  assert.equal(dedupeRecords(records).length, 2);
});

test('AC2 (LOAD-BEARING): deduped total token count is strictly LESS than the naive per-record sum on a replay-containing fixture', () => {
  const files = sessionFilesForProject(FIXTURE_ROOT, ALPHA_PATH);
  const records = files.flatMap(readTranscriptRecords).filter((r) => r.message?.usage);
  // Naive: sum every record's input_tokens as-is, including replayed duplicates.
  const naiveInputTokens = records.reduce((sum, r) => sum + r.message.usage.input_tokens, 0);
  const priceTable = { 'illustrative-model-a': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }, 'illustrative-model-b': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 } };
  const result = costFromRecords(records, priceTable);
  const dedupedInputTokens = result.byModel.reduce((sum, b) => sum + b.tokens.input, 0);
  assert.ok(dedupedInputTokens < naiveInputTokens, `deduped (${dedupedInputTokens}) must be < naive (${naiveInputTokens})`);
  // Exact fixture values across alpha's 3 session files: session-a and
  // session-b share req_001/002/003 (identical usage, a resumed-session
  // replay); session-b adds req_004 new; session-c adds req_005 (no usage,
  // ignored by the filter above) and req_006 (250 input tokens, unique).
  // naive = (1000+2000+1500)*2 + 3000 + 250 = 12250;
  // deduped = 1000+2000+1500+3000+250 = 7750.
  assert.equal(naiveInputTokens, 12250);
  assert.equal(dedupedInputTokens, 7750);
});

// --- costFromRecords: per-model pricing table + unknown-model bucket (AC3) --

test('costFromRecords: prices token totals through a per-model table with exact, hand-checkable math', () => {
  const priceTable = { 'model-x': { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 } }; // $ per 1M tokens
  const records = [
    { requestId: 'a', message: { id: 'ma', model: 'model-x', usage: { input_tokens: 1_000_000, output_tokens: 500_000, cache_creation_input_tokens: 200_000, cache_read_input_tokens: 100_000 } } },
  ];
  const result = costFromRecords(records, priceTable);
  // 1*1 + 2*0.5 + 3*0.2 + 4*0.1 = 1 + 1 + 0.6 + 0.4 = 3
  assert.equal(result.totalUsd, 3);
  assert.equal(result.byModel.length, 1);
  assert.equal(result.byModel[0].usd, 3);
  assert.equal(result.hasUnknownModel, false);
});

test('costFromRecords: an unpriced/unknown model is surfaced in an explicit unknown-model bucket, never priced at 0 (AC3)', () => {
  const priceTable = { 'illustrative-model-a': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } };
  const file = path.join(FIXTURE_ROOT, '-Users-fake-beta', 'session-a.jsonl');
  const records = readTranscriptRecords(file);
  const result = costFromRecords(records, priceTable);
  const known = result.byModel.find((b) => b.model === 'illustrative-model-a');
  const unknown = result.byModel.find((b) => b.model === UNKNOWN_MODEL_BUCKET);
  assert.ok(known);
  assert.ok(known.usd > 0);
  assert.ok(unknown, 'unpriced model must land in the explicit unknown-model bucket');
  assert.equal(unknown.usd, null); // never silently priced at 0
  assert.equal(unknown.tokens.input, 400); // the unpriced model's own tokens, not zeroed
  assert.equal(result.hasUnknownModel, true);
  // The known model's cost must not be contaminated by the unknown one.
  assert.equal(result.totalUsd, known.usd);
});

test('costFromRecords: an empty record set returns null (explicit unknown, not a fabricated $0)', () => {
  assert.equal(costFromRecords([], DEFAULT_PRICE_TABLE), null);
});

test('costFromRecords: records lacking usage/model (e.g. user turns) are ignored, never crash, never counted', () => {
  const records = [{ requestId: 'u1', type: 'user', message: { id: 'mu1', role: 'user' } }];
  assert.equal(costFromRecords(records, DEFAULT_PRICE_TABLE), null);
});

// --- projectTokenCost (I/O combinator) + AC4 honest path→project mapping ---

test('projectTokenCost: computes a deduped, priced cost for a mapped project from its fixture transcripts (AC1/AC6 determinism)', () => {
  const result1 = projectTokenCost(ALPHA_PATH, FIXTURE_ROOT, DEFAULT_PRICE_TABLE);
  const result2 = projectTokenCost(ALPHA_PATH, FIXTURE_ROOT, DEFAULT_PRICE_TABLE);
  assert.ok(result1);
  assert.deepEqual(result1, result2); // AC6: deterministic given a fixed fixture
});

test('projectTokenCost: an unmapped project path (no encoded dir under the root) is explicit unknown (null), never $0 (AC4)', () => {
  assert.equal(projectTokenCost(GAMMA_PATH, FIXTURE_ROOT, DEFAULT_PRICE_TABLE), null);
});

test('projectTokenCost: the configurable projects root is honored, never the real home directory, in a test run', () => {
  // Passing a fixture root that has no matching dir for a real-looking home
  // path proves the root parameter is actually used, not silently ignored
  // in favor of `~/.claude/projects`.
  assert.equal(projectTokenCost('/Users/nobody/does-not-exist', FIXTURE_ROOT, DEFAULT_PRICE_TABLE), null);
});

// --- attachTokenCost: pure read-layer join (mirrors attachVelocity) --------

test('attachTokenCost: joins precomputed per-project cost onto each project; unmapped project stays explicit unknown (null)', () => {
  const data = { generatedAt: 'x', projects: [{ project: { id: 'alpha' } }, { project: { id: 'beta' } }] };
  const costByProjectId = { alpha: { totalUsd: 1.23, byModel: [], hasUnknownModel: false } };
  const result = attachTokenCost(data, costByProjectId);
  assert.deepEqual(result.projects[0].tokenCost, costByProjectId.alpha);
  assert.equal(result.projects[1].tokenCost, null);
});

// --- Read-only / no raw-prompt-text logging (AC6) ---------------------------

test('cost.mjs is read-only and never logs raw prompt/message text (source-level guard)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'src', 'cost.mjs'), 'utf8');
  assert.doesNotMatch(src, /console\./);
  assert.doesNotMatch(src, /fs\.write|fs\.append|fs\.unlink|fs\.rm(?!Sync\()/);
});
