import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PRICE_TABLE,
  resolvePrice,
  UNKNOWN_MODEL_BUCKET,
  UNATTRIBUTED,
  encodeProjectPath,
  dedupeRecords,
  costFromRecords,
  sessionFilesForProject,
  readTranscriptRecords,
  projectTokenCost,
  attachTokenCost,
  costByActivity,
  costBySkill,
  buildSkillBySession,
  skillUsagePathForProject,
  readSkillUsageRecords,
  projectCostByActivity,
  projectCostBySkill,
  projectCostBundle,
  attachCostBreakdown,
  projectTranscriptDirs,
  trackTranscriptDirs,
  trackOptionsForProjects,
} from '../src/cost.mjs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, 'fixtures', 'cost-transcripts');
const ALPHA_PATH = '/Users/fake/alpha';
const BETA_PATH = '/Users/fake/beta';
const GAMMA_PATH = '/Users/fake/gamma'; // deliberately unmapped: no fixture dir
const DELTA_PATH = '/Users/fake/delta'; // 012-04: phase-tagged + skill-mappable fixtures
const ILLUSTRATIVE_A_PRICE = { 'illustrative-model-a': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } };

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

test('projectTranscriptDirs / sessionFilesForProject: worktree session dirs are included (worktree-undercount fix), without grabbing a sibling project by prefix', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-cost-wt-'));
  try {
    const enc = encodeProjectPath('/Users/fake/wt-proj'); // -Users-fake-wt-proj
    const wt = `${enc}--claude-worktrees-slice-01`;
    const sibling = encodeProjectPath('/Users/fake/wt-proj-experiments'); // must NOT be grabbed
    for (const [dir, file] of [[enc, 'main.jsonl'], [wt, 'wt.jsonl'], [sibling, 'other.jsonl']]) {
      fs.mkdirSync(path.join(root, dir));
      fs.writeFileSync(path.join(root, dir, file), '');
    }
    const dirs = projectTranscriptDirs(root, '/Users/fake/wt-proj');
    assert.ok(dirs.includes(enc) && dirs.includes(wt), 'exact + worktree dirs are both included');
    assert.ok(!dirs.includes(sibling), 'the -experiments sibling project is not grabbed by the prefix');
    assert.equal(sessionFilesForProject(root, '/Users/fake/wt-proj').length, 2); // main + worktree, not the sibling
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('trackTranscriptDirs: a monorepo track claims its slug-matched worktrees; the primary (most matches) also gets the repo-root + unmatched worktrees; a never-touched track gets nothing (Superpowers → 0)', () => {
  const enc = '-Users-x-mystique';
  const dirs = [
    enc,
    `${enc}--claude-worktrees-alt-text-cwv-review`,
    `${enc}--claude-worktrees-cwv-audit`,
    `${enc}--claude-worktrees-random-cleanup`,
  ];
  const slugs = ['cwv', 'superpowers'];
  const cwv = trackTranscriptDirs(dirs, enc, 'cwv', slugs);
  const superpowers = trackTranscriptDirs(dirs, enc, 'superpowers', slugs);
  // cwv owns its 2 matched worktrees AND, as primary, the repo-root + the unmatched cleanup worktree.
  assert.equal(cwv.length, 4);
  assert.ok(cwv.includes(enc), 'primary track gets the repo-root sessions');
  // superpowers matched no worktree and is not primary → nothing (0 cost), never the full repo total.
  assert.deepEqual(superpowers, []);
});

test('trackOptionsForProjects: path-sharing projects become tracks with slugs from the shared id-prefix; a unique-path project maps to undefined', () => {
  const opts = trackOptionsForProjects([
    { id: 'mystique-cwv', path: '/m' },
    { id: 'mystique-superpowers', path: '/m' },
    { id: 'gauge', path: '/g' },
  ]);
  assert.deepEqual(opts['mystique-cwv'], { claimSlug: 'cwv', siblingSlugs: ['cwv', 'superpowers'] });
  assert.deepEqual(opts['mystique-superpowers'], { claimSlug: 'superpowers', siblingSlugs: ['cwv', 'superpowers'] });
  assert.equal(opts.gauge, undefined);
});

test('explicit costPaths: sessionFilesForProject / projectCostBundle union transcripts across declared repos (worktree-inclusive); an empty list reads $0 (per-track config declaration)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-cost-paths-'));
  try {
    const rec = (id) => JSON.stringify({ requestId: id, message: { id: `m${id}`, model: 'claude-opus-4-8', usage: { input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
    const repoA = '/Users/fake/repo-a';
    const repoB = '/Users/fake/repo-b';
    const layout = {
      [encodeProjectPath(repoA)]: 'a1',
      [`${encodeProjectPath(repoA)}--claude-worktrees-wt`]: 'a2',
      [encodeProjectPath(repoB)]: 'b1',
    };
    for (const [dir, r] of Object.entries(layout)) {
      fs.mkdirSync(path.join(root, dir));
      fs.writeFileSync(path.join(root, dir, 's.jsonl'), rec(r));
    }
    // Union across repoA (main + worktree) + repoB (main) = 3 files.
    assert.equal(sessionFilesForProject(root, '/ignored', { costPaths: [repoA, repoB] }).length, 3);
    const bundle = projectCostBundle('/ignored', root, DEFAULT_PRICE_TABLE, undefined, { costPaths: [repoA, repoB] });
    assert.ok(bundle.tokenCost.totalUsd > 0, 'declared repos produce a real cost');
    // An empty list → no files → null (explicit $0 for a never-touched track).
    assert.deepEqual(sessionFilesForProject(root, '/ignored', { costPaths: [] }), []);
    assert.equal(projectCostBundle('/ignored', root, DEFAULT_PRICE_TABLE, undefined, { costPaths: [] }), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

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

test('resolvePrice: current-family models price via the family fallback so a model refresh never silently zeroes cost (#4)', () => {
  // Real ids seen in session transcripts that the exact table does not list.
  for (const model of ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-5', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-fable-5']) {
    assert.ok(resolvePrice(model), `${model} should resolve a price via the family fallback`);
  }
  // Non-Anthropic / synthetic ids stay honestly unknown (null), never $0.
  assert.equal(resolvePrice('qwen3.6:27b'), null);
  assert.equal(resolvePrice('<synthetic>'), null);
  // The fallback is DEFAULT-table only — a custom price table is honored verbatim.
  assert.equal(resolvePrice('claude-opus-4-8', { other: { input: 1, output: 1, cacheWrite: 1, cacheRead: 1 } }), null);
});

test('costFromRecords: a current-family model (claude-opus-4-8) is priced into a real by-model bucket via the fallback, not dumped into unknown-model (#4)', () => {
  const records = [{ requestId: 'r1', message: { id: 'm1', model: 'claude-opus-4-8', usage: { input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }];
  const result = costFromRecords(records); // default table → family fallback active
  assert.equal(result.hasUnknownModel, false);
  assert.ok(result.totalUsd > 0, 'opus-4-8 tokens must produce a real cost, not $0');
  assert.ok(result.byModel.find((b) => b.model === 'claude-opus-4-8' && b.usd > 0));
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

// === 012-04: by-activity + by-skill cost detail =============================
// Delta fixtures (-Users-fake-delta): session sess-d1 carries two
// `[jig:phase=...]` tags mid-session (impl, then compliance) in user-turn
// records; session sess-d2 opens with an untagged assistant record (must
// land in `unattributed`) before a `[jig:phase=plan]` tag (as a content-block
// array, not a bare string — the other real-world shape) flips later
// records to `plan`.

function deltaRecords() {
  const files = sessionFilesForProject(FIXTURE_ROOT, DELTA_PATH);
  return files.flatMap(readTranscriptRecords);
}

// Dollar math on real-world token counts is IEEE-754 float division, so
// hand-checked expectations are compared with tolerance rather than strict
// equality (mirrors the LOAD-BEARING reconciliation tests further below).
function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, message || `${actual} !~= ${expected}`);
}

// --- costByActivity (AC1) ----------------------------------------------------

test('costByActivity: attributes cost to the most-recent-preceding [jig:phase=...] tag within a session (AC1)', () => {
  const buckets = costByActivity(deltaRecords(), ILLUSTRATIVE_A_PRICE);
  const byLabel = Object.fromEntries(buckets.map((b) => [b.activity, b]));
  assert.ok(byLabel.impl, 'impl bucket must exist');
  assert.ok(byLabel.compliance, 'compliance bucket must exist');
  assert.ok(byLabel.plan, 'plan bucket must exist');
  // impl: req_d1 only (1000 in, 500 out) => 0.003 + 0.0075 = 0.0105
  closeTo(byLabel.impl.totalUsd, 0.0105);
  // compliance: req_d2 (2000,300) + req_d3 (500,100) => 0.0075+0.006 = 0.0135
  closeTo(byLabel.compliance.totalUsd, 0.0135);
  // plan: req_d5 (300,100) => 0.0009+0.0015 = 0.0024
  closeTo(byLabel.plan.totalUsd, 0.0024);
});

test('costByActivity: a record before any phase tag in its session falls into the explicit "unattributed" bucket, never dropped (AC1/AC5)', () => {
  const buckets = costByActivity(deltaRecords(), ILLUSTRATIVE_A_PRICE);
  const unattributed = buckets.find((b) => b.activity === UNATTRIBUTED);
  assert.ok(unattributed, 'unattributed bucket must be present, not dropped');
  // req_d4 (700,200) => 0.0021+0.003 = 0.0051
  closeTo(unattributed.totalUsd, 0.0051);
});

test('costByActivity: parses the [jig:phase=...] tag from a content-block array, not only a bare string (real-world shape)', () => {
  // sess-d2's tag arrives as message.content = [{type:'text', text:'[jig:phase=plan] ...'}]
  const buckets = costByActivity(deltaRecords(), ILLUSTRATIVE_A_PRICE);
  assert.ok(buckets.some((b) => b.activity === 'plan'));
});

// --- costBySkill (AC2) -------------------------------------------------------

test('buildSkillBySession: maps session id -> skill name from skill_invoked entries, ignoring empty names and other events', () => {
  const raw = readSkillUsageRecords(path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl'));
  const bySession = buildSkillBySession(raw);
  assert.equal(bySession.get('sess-d1'), 'spec-workflow');
  assert.equal(bySession.has('sess-d2'), false); // empty skill_name + wrong event: no signal
});

test('costBySkill: attributes cost to the joined skill for the session, "unattributed" where no skill signal exists (AC2/AC5)', () => {
  const bySession = buildSkillBySession(readSkillUsageRecords(path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl')));
  const buckets = costBySkill(deltaRecords(), bySession, ILLUSTRATIVE_A_PRICE);
  const byLabel = Object.fromEntries(buckets.map((b) => [b.skill, b]));
  assert.ok(byLabel['spec-workflow'], 'skill bucket must exist');
  assert.ok(byLabel[UNATTRIBUTED], 'unattributed bucket must exist for sess-d2 (no skill signal)');
  // spec-workflow == all of sess-d1: req_d1+req_d2+req_d3 => input 3500, output 900
  // usd = (3500/1e6)*3 + (900/1e6)*15 = 0.0105 + 0.0135 = 0.024
  closeTo(byLabel['spec-workflow'].totalUsd, 0.024);
  // unattributed == all of sess-d2: req_d4+req_d5 => input 1000, output 300
  // usd = 0.003 + 0.0045 = 0.0075
  closeTo(byLabel[UNATTRIBUTED].totalUsd, 0.0075);
});

test('readSkillUsageRecords: a missing skill-usage file returns an empty array, not a throw', () => {
  assert.deepEqual(readSkillUsageRecords(path.join(FIXTURE_ROOT, 'does-not-exist.jsonl')), []);
});

test('readSkillUsageRecords: skips malformed lines without crashing', () => {
  const records = readSkillUsageRecords(path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl'));
  assert.equal(records.length, 3); // the trailing "not valid json" line is dropped
});

test('skillUsagePathForProject: points at <projectPath>/.claude/skill-usage.jsonl (the jig-telemetry.sh write location)', () => {
  assert.equal(skillUsagePathForProject('/Users/fake/delta'), path.join('/Users/fake/delta', '.claude', 'skill-usage.jsonl'));
});

// --- Reconciles-to-total invariant (AC4, LOAD-BEARING) ----------------------
// For any record set, the sum of by-activity buckets — and separately the
// sum of by-skill buckets — must equal costFromRecords' own deduped total
// exactly (both cuts partition the SAME deduped records; price is linear per
// token, so summing bucketed totals must reproduce the whole-set total).

test('costByActivity: the sum of all buckets (incl. unattributed) equals costFromRecords\' deduped total (AC4, LOAD-BEARING)', () => {
  const records = deltaRecords();
  const total = costFromRecords(records, ILLUSTRATIVE_A_PRICE).totalUsd;
  const buckets = costByActivity(records, ILLUSTRATIVE_A_PRICE);
  const sum = buckets.reduce((s, b) => s + b.totalUsd, 0);
  assert.ok(Math.abs(sum - total) < 1e-9, `by-activity sum (${sum}) must equal total (${total})`);
});

test('costBySkill: the sum of all buckets (incl. unattributed) equals costFromRecords\' deduped total (AC4, LOAD-BEARING)', () => {
  const records = deltaRecords();
  const bySession = buildSkillBySession(readSkillUsageRecords(path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl')));
  const total = costFromRecords(records, ILLUSTRATIVE_A_PRICE).totalUsd;
  const buckets = costBySkill(records, bySession, ILLUSTRATIVE_A_PRICE);
  const sum = buckets.reduce((s, b) => s + b.totalUsd, 0);
  assert.ok(Math.abs(sum - total) < 1e-9, `by-skill sum (${sum}) must equal total (${total})`);
});

test('costByActivity/costBySkill: the invariant holds even with a mix of known + unpriced ("unknown-model") records, without inflating or losing dollars', () => {
  // Combine delta (phase-tagged) with beta (a known + an unpriced model,
  // no phase tags -> all unattributed) to exercise both dimensions at once.
  const combined = [...deltaRecords(), ...readTranscriptRecords(path.join(FIXTURE_ROOT, '-Users-fake-beta', 'session-a.jsonl'))];
  const priceTable = { ...ILLUSTRATIVE_A_PRICE };
  const total = costFromRecords(combined, priceTable).totalUsd;
  const activitySum = costByActivity(combined, priceTable).reduce((s, b) => s + b.totalUsd, 0);
  const skillSum = costBySkill(combined, new Map(), priceTable).reduce((s, b) => s + b.totalUsd, 0);
  assert.ok(Math.abs(activitySum - total) < 1e-9);
  assert.ok(Math.abs(skillSum - total) < 1e-9);
});

// --- projectCostByActivity / projectCostBySkill (I/O combinators) -----------

test('projectCostByActivity: computes activity buckets for a mapped project from its fixture transcripts, matching the pure fold', () => {
  const result = projectCostByActivity(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE);
  assert.deepEqual(result, costByActivity(deltaRecords(), ILLUSTRATIVE_A_PRICE));
});

test('projectCostByActivity: an unmapped project path is explicit unknown (null), never an empty array (AC4/AC5 parity with projectTokenCost)', () => {
  assert.equal(projectCostByActivity(GAMMA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE), null);
});

test('projectCostBySkill: computes skill buckets for a mapped project, honoring an overridden skill-usage file path (testability)', () => {
  const skillUsagePath = path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl');
  const result = projectCostBySkill(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE, skillUsagePath);
  const expectedSession = buildSkillBySession(readSkillUsageRecords(skillUsagePath));
  assert.deepEqual(result, costBySkill(deltaRecords(), expectedSession, ILLUSTRATIVE_A_PRICE));
});

test('projectCostBySkill: with no skill-usage file present (default path, unmapped fake project dir), every bucket falls to "unattributed"', () => {
  const result = projectCostBySkill(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE);
  assert.equal(result.length, 1);
  assert.equal(result[0].skill, UNATTRIBUTED);
});

test('projectCostBySkill: an unmapped project path is explicit unknown (null), never an empty array', () => {
  assert.equal(projectCostBySkill(GAMMA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE), null);
});

// --- attachCostBreakdown: pure read-layer join (mirrors attachTokenCost) ----

test('attachCostBreakdown: joins precomputed {byActivity, bySkill} onto each project; unmapped project stays explicit unknown (null) (AC3)', () => {
  const data = { generatedAt: 'x', projects: [{ project: { id: 'alpha' } }, { project: { id: 'beta' } }] };
  const breakdown = { byActivity: [{ activity: 'impl', totalUsd: 1, hasUnknownModel: false, byModel: [], recordCount: 1 }], bySkill: [] };
  const breakdownByProjectId = { alpha: breakdown };
  const result = attachCostBreakdown(data, breakdownByProjectId);
  assert.deepEqual(result.projects[0].tokenCostBreakdown, breakdown);
  assert.equal(result.projects[1].tokenCostBreakdown, null);
});

// --- projectCostBundle: single-read combinator (reconciliation fix) --------
// Both reviewers flagged the same project's transcripts being enumerated,
// read/parsed, and deduped three times per `/api/data` request (once each
// for projectTokenCost/projectCostByActivity/projectCostBySkill). This
// combinator reads + dedupes ONCE and fans the same deduped set out to all
// three pure folds — production wiring (src/server.mjs) calls only this.

test('projectCostBundle: reads a project\'s transcripts once and returns {tokenCost, tokenCostBreakdown}, matching the three separate combinators exactly', () => {
  const skillUsagePath = path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl');
  const bundle = projectCostBundle(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE, skillUsagePath);
  assert.deepEqual(bundle.tokenCost, costFromRecords(deltaRecords(), ILLUSTRATIVE_A_PRICE));
  assert.deepEqual(bundle.tokenCostBreakdown.byActivity, projectCostByActivity(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE));
  assert.deepEqual(bundle.tokenCostBreakdown.bySkill, projectCostBySkill(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE, skillUsagePath));
});

test('projectCostBundle: an unmapped project path is explicit unknown (null), never a partially-populated object (AC4)', () => {
  assert.equal(projectCostBundle(GAMMA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE), null);
});

test('projectCostBundle: the by-activity/by-skill buckets still reconcile to the bundled tokenCost total (AC4, LOAD-BEARING, single-read path)', () => {
  const bundle = projectCostBundle(DELTA_PATH, FIXTURE_ROOT, ILLUSTRATIVE_A_PRICE, path.join(FIXTURE_ROOT, 'skill-usage-delta.jsonl'));
  const activitySum = bundle.tokenCostBreakdown.byActivity.reduce((s, b) => s + b.totalUsd, 0);
  const skillSum = bundle.tokenCostBreakdown.bySkill.reduce((s, b) => s + b.totalUsd, 0);
  closeTo(activitySum, bundle.tokenCost.totalUsd);
  closeTo(skillSum, bundle.tokenCost.totalUsd);
});
