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
    const price = priceTable[model];
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
