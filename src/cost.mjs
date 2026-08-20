// Token cost deriver (spec 012, slice 012-03): the spec's one deliberate
// depth exception (cost goes deeper than the otherwise-shallow manager lens).
// Sourced from Claude Code's own session transcripts — a NEW local telemetry
// source outside the source repos (spec.md `## Assumptions`), never the
// observation loop / adapters. Read-only; never writes, never logs raw
// prompt/message text (AC6, guarded by a source-level test in
// test/cost.test.mjs).
//
// Structured for testability, mirroring src/velocity.mjs's pure-fold +
// thin-I/O-wrapper + attach* combinator shape:
//   - encodeProjectPath / sessionFilesForProject / readTranscriptRecords: the
//     thin, replaceable I/O layer (enumerate + parse .jsonl files).
//   - dedupeRecords / costFromRecords: PURE folds over already-read records —
//     unit-testable with plain arrays, no filesystem.
//   - projectTokenCost: the per-project I/O + pure-fold combinator.
//   - attachTokenCost: the pure read-layer join the server calls, mirroring
//     attachVelocity/attachMilestones.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// AC1/AC4: the Claude Code projects root is configurable/overridable — tests
// point this at a fixture directory, production defaults to the real
// `~/.claude/projects`. Never hardcoded past this one default constant.
export const DEFAULT_TRANSCRIPTS_ROOT = path.join(os.homedir(), '.claude', 'projects');

// AC4: sessions map to projects by the SAME encoding Claude Code itself uses
// for its own projects-root directory names (probed against real directory
// names — see test/cost.test.mjs) — every non-alphanumeric character becomes
// a literal `-`, with no collapsing of runs (a `/.` pair yields `--`).
export function encodeProjectPath(absPath) {
  return String(absPath).replace(/[^a-zA-Z0-9]/g, '-');
}

// AC3: illustrative per-model pricing (USD per 1,000,000 tokens) — NOT real
// Anthropic rates. The mechanism (table lookup + an explicit unknown-model
// bucket for anything not listed) is the point; real rates are a local
// config concern, never committed to this public repo.
export const DEFAULT_PRICE_TABLE = {
  'claude-opus-4-5-20250929': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};

// Family-tier prices (illustrative, $/1M tokens) used as a FALLBACK when a model
// id is not an exact table entry — so a new dated/point release
// (claude-opus-4-8, claude-sonnet-5, claude-fable-5, …) is still priced at its
// tier instead of dropping to the unknown-model bucket. Without this, every
// model refresh silently zeroed out cost until someone edited the table; this is
// what keeps token-cost estimates working across releases.
const FAMILY_PRICES = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  fable: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};

// Resolve a model id to a price: exact table entry first, else a family-tier
// fallback matched on the model-family keyword (opus/sonnet/fable/haiku). The
// fallback applies ONLY to the default production table — a custom priceTable
// (tests, or a caller pinning exact prices) is honored verbatim, so an id absent
// from it still resolves to null (the honest unknown-model bucket, never $0). A
// non-Anthropic or unrecognizable id (a local model, "<synthetic>") also
// resolves to null.
export function resolvePrice(model, priceTable = DEFAULT_PRICE_TABLE) {
  const exact = priceTable[model];
  if (exact) return exact;
  if (priceTable !== DEFAULT_PRICE_TABLE) return null;
  const m = String(model || '').toLowerCase();
  for (const family of ['opus', 'sonnet', 'fable', 'haiku']) {
    if (m.includes(family)) return FAMILY_PRICES[family];
  }
  return null;
}

// AC3: the explicit bucket name unpriced/unrecognized models are grouped
// under — never silently priced at $0, and never dropped.
export const UNKNOWN_MODEL_BUCKET = 'unknown-model';

// AC2 (LOAD-BEARING): the unique key a "request" is deduped on. `requestId`
// is the primary key (identifies one API call); `message.id` is the
// documented fallback when a record carries no `requestId`. Records with
// neither (malformed/unexpected shape) return null and are never
// deduplicated against one another — they pass straight through, so a
// genuinely unparseable record is never silently dropped as a "duplicate".
function requestKey(record) {
  return record?.requestId ?? record?.message?.id ?? null;
}

// AC2 (LOAD-BEARING): running totals repeat per record and resumed sessions
// replay earlier history verbatim, so the same request appears many times
// across a project's session files — global (cross-file) dedup on requestKey
// is what makes the total honest. First occurrence wins (later "replays" of
// the same request carry identical usage, by construction of the replay).
export function dedupeRecords(records) {
  const seen = new Set();
  const out = [];
  for (const record of records || []) {
    const key = requestKey(record);
    if (key === null) {
      out.push(record); // no stable key: can't dedupe, never silently dropped
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

function emptyTokenBucket() {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
}

function addUsageInto(bucket, usage) {
  bucket.input += Number(usage.input_tokens) || 0;
  bucket.output += Number(usage.output_tokens) || 0;
  bucket.cacheWrite += Number(usage.cache_creation_input_tokens) || 0;
  bucket.cacheRead += Number(usage.cache_read_input_tokens) || 0;
}

function priceTokens(tokens, price) {
  return (tokens.input / 1_000_000) * price.input
    + (tokens.output / 1_000_000) * price.output
    + (tokens.cacheWrite / 1_000_000) * price.cacheWrite
    + (tokens.cacheRead / 1_000_000) * price.cacheRead;
}

// AC1/AC2/AC3: the pure core. Dedupes globally by request key, tallies raw
// token fields per `model` (records with no `message.model`/`message.usage`
// — e.g. user turns — are silently skipped, never counted or crashed on),
// then prices each model bucket through `priceTable`. A model absent from
// the table is never priced at 0 — its tokens are folded into the single
// explicit `unknown-model` bucket with `usd: null`, and `hasUnknownModel`
// flags that the total is a floor, not the whole truth. An empty/all-
// unusable input returns `null` — explicit unknown, never a fabricated $0
// (mirrors velocity.mjs's null-on-nothing-in-window contract).
// Per-record USD (014-03 cost trend): price a single record's usage in
// isolation, so records can be bucketed into trend windows by their timestamp.
// Returns null when the record carries no model/usage OR its model is unpriced
// — an un-priceable record's spend is NEVER attributed to a window (honest
// unknown, mirroring costFromRecords' unknown-model handling), never a
// fabricated 0. Callers dedupe first; this prices one deduped record.
export function recordUsd(record, priceTable = DEFAULT_PRICE_TABLE) {
  const model = record?.message?.model;
  const usage = record?.message?.usage;
  if (!model || !usage) return null;
  const price = resolvePrice(model, priceTable);
  if (!price) return null; // unknown-model: not attributed to a trend window
  const bucket = emptyTokenBucket();
  addUsageInto(bucket, usage);
  return priceTokens(bucket, price);
}

export function costFromRecords(records, priceTable = DEFAULT_PRICE_TABLE) {
  const deduped = dedupeRecords(records);
  const tokensByModel = new Map();
  for (const record of deduped) {
    const model = record?.message?.model;
    const usage = record?.message?.usage;
    if (!model || !usage) continue;
    const bucket = tokensByModel.get(model) || emptyTokenBucket();
    addUsageInto(bucket, usage);
    tokensByModel.set(model, bucket);
  }
  if (tokensByModel.size === 0) return null;

  const byModel = [];
  const unknownTokens = emptyTokenBucket();
  let hasUnknownModel = false;
  for (const [model, tokens] of tokensByModel) {
    const price = resolvePrice(model, priceTable);
    if (!price) {
      hasUnknownModel = true;
      unknownTokens.input += tokens.input;
      unknownTokens.output += tokens.output;
      unknownTokens.cacheWrite += tokens.cacheWrite;
      unknownTokens.cacheRead += tokens.cacheRead;
      continue;
    }
    byModel.push({ model, tokens, usd: priceTokens(tokens, price) });
  }
  if (hasUnknownModel) byModel.push({ model: UNKNOWN_MODEL_BUCKET, tokens: unknownTokens, usd: null });
  byModel.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  // `recordCount` (not `requestCount`): it counts every deduped record this
  // fold looked at, including usage-less ones that never reach a model
  // bucket (e.g. a user turn sharing no requestId with any assistant
  // record) — "request count" would over-promise. Unsurfaced in the UI
  // today; kept as a low-risk, honestly-named diagnostic field.
  const totalUsd = byModel.reduce((sum, b) => sum + (b.usd ?? 0), 0);
  return { totalUsd, hasUnknownModel, byModel, recordCount: deduped.length };
}

// Thin I/O wrapper (AC1/AC4): every `.jsonl` session file under the
// project's encoded directory, or an empty list when the directory doesn't
// exist — an unmapped/temp/probe path or a project with no captured
// sessions is NOT an error, just nothing to enumerate (the caller turns
// that into explicit unknown, never $0).
export function sessionFilesForProject(projectsRoot, projectPath) {
  const dir = path.join(projectsRoot, encodeProjectPath(projectPath));
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith('.jsonl')).sort().map((name) => path.join(dir, name));
}

// Thin I/O wrapper (AC1/AC6): reads and JSON-parses one session's records,
// line by line (Claude Code transcripts are JSONL — one JSON object per
// line). A malformed line or an unreadable file is skipped/returns empty
// rather than throwing — a corrupt transcript must never take down the
// read layer. Never logs a line's content (AC6).
export function readTranscriptRecords(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const records = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      continue; // malformed line: skipped, never crashes the read
    }
  }
  return records;
}

// AC1/AC4/AC6: the per-project combinator — enumerate a project's session
// files (I/O), read + concatenate their records (I/O), then fold them
// through the pure costFromRecords. A project with no mapped sessions
// returns null (AC4's honest "unknown", never $0) before ever calling the
// pure fold. Deterministic given a fixed fixture (AC6): no clock, no
// randomness, same files in → same cost out.
export function projectTokenCost(projectPath, projectsRoot = DEFAULT_TRANSCRIPTS_ROOT, priceTable = DEFAULT_PRICE_TABLE) {
  const files = sessionFilesForProject(projectsRoot, projectPath);
  if (files.length === 0) return null;
  const records = files.flatMap(readTranscriptRecords);
  return costFromRecords(records, priceTable);
}

// Read-layer composition (AC1/AC4), mirroring src/velocity.mjs's
// attachVelocity: a pure fold that attaches each project's already-computed
// cost onto its current-state read. The one I/O (enumerating + reading
// transcripts, per project) happens in the caller (src/server.mjs), exactly
// as attachVelocity's git reads do — this function itself touches no
// filesystem. A project absent from the map (or one projectTokenCost
// resolved to null) attaches explicit `null`, never a fabricated $0.
export function attachTokenCost(data, costByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      tokenCost: costByProjectId?.[entry.project.id] ?? null,
    })),
  };
}

// === Slice 012-04: token cost — by-activity + by-skill ======================
// The deeper cut, for a project's DETAIL tier (never the card face — that
// stays 012-03's totalUsd/byModel headline). Reuses dedupeRecords and
// costFromRecords wholesale — dedup and pricing are never reimplemented here.

// AC5: the explicit bucket both cuts fall back to when no phase tag (by-
// activity) or no skill signal (by-skill) is available — never dropped,
// never silently zero-cost.
export const UNATTRIBUTED = 'unattributed';

const PHASE_TAG_RE = /\[jig:phase=([A-Za-z0-9_.:-]+)\]/;

// AC1: `[jig:phase=...]` is emitted by jig-telemetry.sh into the USER-turn
// prompt text (never the assistant's own usage record) — probed as either a
// plain string `message.content`, or a content-block array whose first
// `{type:'text'}` block carries the tagged text (both observed real-world
// shapes). Any other record (assistant, tool-result, malformed) returns
// null: no tag, no state change.
function extractPhaseTag(record) {
  const message = record?.message;
  if (!message || message.role !== 'user') return null;
  const content = message.content;
  let text = null;
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    const block = content.find((entry) => entry?.type === 'text' && typeof entry.text === 'string');
    text = block?.text ?? null;
  }
  if (!text) return null;
  const match = PHASE_TAG_RE.exec(text);
  return match ? match[1] : null;
}

// Shared by costByActivity/costBySkill: re-runs costFromRecords per bucket
// (never a second dedup/pricing implementation) and sorts priced-first,
// mirroring costFromRecords' own byModel ordering. Every bucket's record
// list is non-empty by construction (only usage-bearing records are ever
// pushed into a bucket), so costFromRecords never returns null here.
function finalizeBuckets(recordsByBucket, labelKey, priceTable) {
  const buckets = [];
  for (const [label, recs] of recordsByBucket) {
    buckets.push({ [labelKey]: label, ...costFromRecords(recs, priceTable) });
  }
  buckets.sort((a, b) => b.totalUsd - a.totalUsd);
  return buckets;
}

// AC1/AC4/AC5 (LOAD-BEARING): dedupes ONCE up front (the same global dedup
// costFromRecords itself performs), then partitions the deduped set by
// activity phase before re-pricing each partition — since price is a linear
// function of token counts, summing every bucket's totalUsd reproduces
// costFromRecords' own whole-set total exactly (asserted by the
// reconciles-to-total test). Phase state is tracked PER SESSION, in the
// given record order: a `[jig:phase=X]` tag sets the "current phase" for
// every subsequent usage-bearing record in that same session until the next
// tag changes it; a session with no tag yet falls to `unattributed` (AC5),
// never dropped and never borrowed from another session's phase.
export function costByActivity(records, priceTable = DEFAULT_PRICE_TABLE) {
  const deduped = dedupeRecords(records);
  const currentPhaseBySession = new Map();
  const recordsByBucket = new Map();
  for (const record of deduped) {
    const tag = extractPhaseTag(record);
    if (tag) {
      currentPhaseBySession.set(record?.sessionId ?? null, tag);
      continue; // the tag-bearing user turn itself carries no usage to price
    }
    if (!record?.message?.model || !record?.message?.usage) continue;
    const activity = currentPhaseBySession.get(record?.sessionId ?? null) ?? UNATTRIBUTED;
    if (!recordsByBucket.has(activity)) recordsByBucket.set(activity, []);
    recordsByBucket.get(activity).push(record);
  }
  return finalizeBuckets(recordsByBucket, 'activity', priceTable);
}

// AC2: session_id -> skill_name, built from jig's own skill-usage.jsonl
// telemetry (`{session_id, event:'skill_invoked', skill_name}`, written by
// jig-skill-trace.sh). Only `skill_invoked` entries with a non-empty
// `skill_name` count as a signal; other event kinds (e.g. `task_spawned`)
// and empty names are skipped. First signal per session wins — a session
// commonly invokes one skill; where several fire, the first is the one that
// framed the work.
export function buildSkillBySession(skillUsageRecords) {
  const bySession = new Map();
  for (const rec of skillUsageRecords || []) {
    if (rec?.event !== 'skill_invoked') continue;
    const sessionId = rec?.session_id;
    const skillName = rec?.skill_name;
    if (!sessionId || !skillName) continue;
    if (!bySession.has(sessionId)) bySession.set(sessionId, skillName);
  }
  return bySession;
}

// AC2/AC4/AC5 (LOAD-BEARING): same dedup-once-then-partition-then-reprice
// shape as costByActivity, joined on session id instead of a stateful
// in-session tag. `skillBySession` is a Map (buildSkillBySession's shape);
// a session absent from the map — no skill signal available — falls to
// `unattributed` (AC5).
export function costBySkill(records, skillBySession, priceTable = DEFAULT_PRICE_TABLE) {
  const deduped = dedupeRecords(records);
  const recordsByBucket = new Map();
  for (const record of deduped) {
    if (!record?.message?.model || !record?.message?.usage) continue;
    const skill = skillBySession?.get?.(record?.sessionId ?? null) ?? UNATTRIBUTED;
    if (!recordsByBucket.has(skill)) recordsByBucket.set(skill, []);
    recordsByBucket.get(skill).push(record);
  }
  return finalizeBuckets(recordsByBucket, 'skill', priceTable);
}

// AC2: the write location jig-skill-trace.sh/jig-telemetry.sh actually use
// — a project-local log under the SOURCE project's own `.claude/` dir, never
// under the Claude Code transcripts root. Exposed so the default location
// (production) and an overridden fixture path (tests) share one rule.
export function skillUsagePathForProject(projectPath) {
  return path.join(projectPath, '.claude', 'skill-usage.jsonl');
}

// Thin I/O wrapper (AC2), mirroring readTranscriptRecords: JSONL, tolerant
// of a missing file or a malformed line — jig telemetry being absent (most
// projects) or partially corrupt must never take down cost detail, it just
// yields no skill signal (AC5's `unattributed`, never a crash).
export function readSkillUsageRecords(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const records = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return records;
}

// Per-project I/O + pure-fold combinators (AC1/AC4), mirroring
// projectTokenCost: enumerate + read a project's session transcripts (same
// files 012-03 reads), then fold through the pure costByActivity/
// costBySkill. A project with no mapped session transcripts returns null
// (honest unknown, never an empty array masquerading as "measured zero").
export function projectCostByActivity(projectPath, projectsRoot = DEFAULT_TRANSCRIPTS_ROOT, priceTable = DEFAULT_PRICE_TABLE) {
  const files = sessionFilesForProject(projectsRoot, projectPath);
  if (files.length === 0) return null;
  const records = files.flatMap(readTranscriptRecords);
  return costByActivity(records, priceTable);
}

// `skillUsagePath` defaults to the project's own real skill-usage.jsonl
// location; tests override it to point at a fixture file (a fake project
// path like `/Users/fake/delta` has no real `.claude/` dir to read).
export function projectCostBySkill(
  projectPath,
  projectsRoot = DEFAULT_TRANSCRIPTS_ROOT,
  priceTable = DEFAULT_PRICE_TABLE,
  skillUsagePath = skillUsagePathForProject(projectPath),
) {
  const files = sessionFilesForProject(projectsRoot, projectPath);
  if (files.length === 0) return null;
  const records = files.flatMap(readTranscriptRecords);
  const skillBySession = buildSkillBySession(readSkillUsageRecords(skillUsagePath));
  return costBySkill(records, skillBySession, priceTable);
}

// Reconciliation fix (012-04 review): projectTokenCost + projectCostByActivity
// + projectCostBySkill each independently re-enumerate, re-read/parse, and
// re-dedupe the SAME project's transcripts — 3x the I/O per project per
// `/api/data` request for bytes that don't change between the three calls.
// This is the single combinator production code (src/server.mjs) should
// call: it reads the session files and dedupes ONCE, then fans the one
// deduped record set out to all three pure folds (costFromRecords,
// costByActivity, costBySkill) plus one skill-usage read. The pure folds
// themselves are untouched — costFromRecords/costByActivity/costBySkill
// still call dedupeRecords internally, but on an already-deduped array
// that's a cheap no-op set-membership pass, not a second read+parse. The
// three single-purpose combinators above stay exported (still directly unit-
// tested, still valid utilities), but production wiring now uses this one.
export function projectCostBundle(
  projectPath,
  projectsRoot = DEFAULT_TRANSCRIPTS_ROOT,
  priceTable = DEFAULT_PRICE_TABLE,
  skillUsagePath = skillUsagePathForProject(projectPath),
) {
  const files = sessionFilesForProject(projectsRoot, projectPath);
  if (files.length === 0) return null;
  const deduped = dedupeRecords(files.flatMap(readTranscriptRecords));
  const skillBySession = buildSkillBySession(readSkillUsageRecords(skillUsagePath));
  return {
    tokenCost: costFromRecords(deduped, priceTable),
    tokenCostBreakdown: {
      byActivity: costByActivity(deduped, priceTable),
      bySkill: costBySkill(deduped, skillBySession, priceTable),
    },
    // 014-03: expose the already-deduped record set (timestamps intact) so the
    // cost TREND reuses this single read instead of re-enumerating + re-parsing
    // + re-deduping the same transcripts — preserving 012-04's single-read
    // invariant rather than reintroducing the per-request duplicate I/O.
    records: deduped,
  };
}

// AC3: the read-layer join the server calls to attach the detail-tier
// breakdown, mirroring attachTokenCost. A project absent from the map (or
// one whose combinators resolved to null) attaches explicit `null`.
export function attachCostBreakdown(data, breakdownByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      tokenCostBreakdown: breakdownByProjectId?.[entry.project.id] ?? null,
    })),
  };
}
