import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_VELOCITY_WINDOW_WEEKS } from '../src/velocity.mjs';
import {
  teamFromCommits,
  gitTeamSignals,
  attachTeamSignals,
} from '../src/team.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse('2026-08-11T00:00:00Z');

// --- teamFromCommits (pure) ------------------------------------------------

test('teamFromCommits: split computation over a mixed fixture (AC1)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true },
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true },
    { ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false },
    { ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false },
  ];
  const result = teamFromCommits(commits, NOW_MS, 8);
  assert.ok(result);
  assert.equal(result.agentCoauthoredPct, 50); // 2 of 4 commits carry the trailer
  assert.equal(result.agentCoauthoredCount, 2);
  assert.equal(result.commitCount, 4);
});

test('teamFromCommits: all-human commits yield a real 0% split, NOT unknown (commits are present, AC4)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: false },
    { ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false },
  ];
  const result = teamFromCommits(commits, NOW_MS, 8);
  assert.notEqual(result, null); // known, real activity — not unknown
  assert.equal(result.agentCoauthoredPct, 0);
  assert.equal(result.agentCoauthoredCount, 0); // TRUE zero — no agent-coauthored commits at all
  assert.equal(result.commitCount, 2);
});

test('teamFromCommits: a real-but-sub-1% share still carries a non-zero agentCoauthoredCount even though the rounded pct is 0 (reconciliation: render layer needs this to distinguish "< 1%" from a true 0%)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [{ ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true }];
  for (let i = 0; i < 299; i += 1) commits.push({ ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false });
  const result = teamFromCommits(commits, NOW_MS, 8); // 1 / 300 -> 0.33% -> rounds to 0
  assert.equal(result.agentCoauthoredPct, 0);
  assert.equal(result.agentCoauthoredCount, 1); // real, non-zero — the render layer must not call this "0%"
  assert.equal(result.commitCount, 300);
});

test('teamFromCommits: empty commit set is explicit unknown, never 0% (AC4)', () => {
  assert.equal(teamFromCommits([], NOW_MS, 8), null);
});

test('teamFromCommits: commits entirely outside the window are also unknown (AC4)', () => {
  const longAgo = Math.floor((NOW_MS - 52 * WEEK_MS) / 1000);
  const commits = [{ ts: longAgo, authorName: 'Alice', hasClaudeCoAuthor: true }];
  assert.equal(teamFromCommits(commits, NOW_MS, 8), null);
});

test('teamFromCommits: contributor count is distinct authors within the window (AC3)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true },
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: false },
    { ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false },
    { ts: thisWeek, authorName: 'Carol', hasClaudeCoAuthor: true },
  ];
  const result = teamFromCommits(commits, NOW_MS, 8);
  assert.equal(result.contributorCount, 3);
});

test('teamFromCommits: a commit outside the window does not count toward contributors either (AC3/AC4)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const longAgo = Math.floor((NOW_MS - 52 * WEEK_MS) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: false },
    { ts: longAgo, authorName: 'Ghost', hasClaudeCoAuthor: false },
  ];
  const result = teamFromCommits(commits, NOW_MS, 8);
  assert.equal(result.contributorCount, 1);
  assert.equal(result.commitCount, 1);
});

test('teamFromCommits: no author identity is present anywhere in the returned object (AC5, no PII)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice Secret', hasClaudeCoAuthor: true },
    { ts: thisWeek, authorName: 'Bob Confidential', hasClaudeCoAuthor: false },
  ];
  const result = teamFromCommits(commits, NOW_MS, 8);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /Alice|Bob|Secret|Confidential/);
  assert.deepEqual(
    Object.keys(result).sort(),
    ['agentCoauthoredCount', 'agentCoauthoredPct', 'commitCount', 'contributorCount'],
  );
});

test('teamFromCommits: window is a documented parameter shared with velocity\'s default (AC6)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [{ ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true }];
  const result = teamFromCommits(commits, NOW_MS); // uses the default window
  assert.notEqual(result, null);
});

test('DEFAULT_VELOCITY_WINDOW_WEEKS is reused (not redefined) — team.mjs imports the shared constant', () => {
  const src = fs.readFileSync(new URL('../src/team.mjs', import.meta.url), 'utf8');
  assert.match(src, /import\s*\{[^}]*\bDEFAULT_VELOCITY_WINDOW_WEEKS\b[^}]*\}\s*from\s*'\.\/velocity\.mjs'/);
  assert.doesNotMatch(src, /export const DEFAULT_VELOCITY_WINDOW_WEEKS/);
});

test('teamFromCommits: deterministic — same input + clock produces byte-identical output on repeated calls (AC6)', () => {
  const thisWeek = Math.floor((NOW_MS - 1000) / 1000);
  const commits = [
    { ts: thisWeek, authorName: 'Alice', hasClaudeCoAuthor: true },
    { ts: thisWeek, authorName: 'Bob', hasClaudeCoAuthor: false },
  ];
  const a = teamFromCommits(commits, NOW_MS, 8);
  const b = teamFromCommits(commits, NOW_MS, 8);
  assert.deepEqual(a, b);
});

// --- gitTeamSignals (thin git wrapper + combinator) ------------------------

function initRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-team-')));
  const commitAt = (isoDate, authorName, message, coAuthored) => {
    fs.writeFileSync(path.join(root, 'f.txt'), `${message}\n`, { flag: 'a' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    const body = coAuthored ? `${message}\n\nCo-Authored-By: Claude <noreply@anthropic.com>` : message;
    execFileSync('git', ['-C', root, 'commit', '-qm', body], {
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: isoDate,
        GIT_COMMITTER_DATE: isoDate,
        GIT_AUTHOR_NAME: authorName,
        GIT_AUTHOR_EMAIL: `${authorName.replace(/\s+/g, '.').toLowerCase()}@example.com`,
      },
    });
  };
  execFileSync('git', ['-C', root, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
  return { root, commitAt };
}

test('gitTeamSignals: reads real commit split + contributor count from a fixture repo, case-insensitively (AC1/AC2/AC3/AC6)', () => {
  const { root, commitAt } = initRepo();
  try {
    commitAt('2025-01-01T10:00:00', 'Ghost', 'ancient', false); // outside window
    commitAt('2026-08-09T10:00:00', 'Alice', 'agent commit 1', true);
    commitAt('2026-08-09T11:00:00', 'Alice', 'human-only commit', false); // no trailer -> not agent-coauthored
    commitAt('2026-08-10T10:00:00', 'Bob', 'human commit', false);
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    const result = gitTeamSignals(root, nowMs, 8);
    assert.ok(result);
    assert.equal(result.commitCount, 3); // ancient excluded
    assert.equal(result.agentCoauthoredPct, 33); // 1 of 3 commits carry the trailer
    assert.equal(result.contributorCount, 2); // Alice, Bob (ancient Ghost excluded)
    // Determinism: fixed clock + repo state -> identical output on repeated calls.
    assert.deepEqual(gitTeamSignals(root, nowMs, 8), result);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitTeamSignals: detects the Co-Authored-By trailer case-insensitively', () => {
  const { root, commitAt } = initRepo();
  try {
    // commitAt always emits "Co-Authored-By" with this exact casing; write a
    // lower-cased trailer directly to exercise the case-insensitive match.
    fs.writeFileSync(path.join(root, 'f.txt'), 'lower-case-trailer\n', { flag: 'a' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, 'commit', '-qm', 'lower-case-trailer\n\nco-authored-by: claude <x@y.com>'], {
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: '2026-08-10T10:00:00', GIT_COMMITTER_DATE: '2026-08-10T10:00:00' },
    });
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    const result = gitTeamSignals(root, nowMs, 8);
    assert.ok(result);
    assert.equal(result.agentCoauthoredPct, 100);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitTeamSignals: a body that merely QUOTES "Co-authored-by: Claude" mid-paragraph (not as a trailer line) is NOT counted, while a real trailer line IS (reconciliation fix — line-anchored match)', () => {
  const { root, commitAt } = initRepo();
  try {
    // Quoted in prose, not a trailer line (e.g. a revert echoing the
    // original message) — the substring-only regex this reconciliation
    // fixed would have matched this and inflated the split.
    fs.writeFileSync(path.join(root, 'f.txt'), 'quoted\n', { flag: 'a' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync(
      'git',
      ['-C', root, 'commit', '-qm', 'Revert "agent commit"\n\nThis reverts a commit that said: Co-authored-by: Claude in its body.'],
      {
        stdio: 'ignore',
        env: { ...process.env, GIT_AUTHOR_DATE: '2026-08-09T10:00:00', GIT_COMMITTER_DATE: '2026-08-09T10:00:00' },
      },
    );
    commitAt('2026-08-10T10:00:00', 'Alice', 'real agent commit', true); // genuine trailer line
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    const result = gitTeamSignals(root, nowMs, 8);
    assert.ok(result);
    assert.equal(result.commitCount, 2);
    assert.equal(result.agentCoauthoredPct, 50); // only the real trailer line counts, not the quoted mention
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitTeamSignals: a human co-author literally named "Claudette" is not miscounted as agent-coauthored (word-boundary guard)', () => {
  const { root } = initRepo();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'pair\n', { flag: 'a' });
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync(
      'git',
      ['-C', root, 'commit', '-qm', 'paired commit\n\nCo-authored-by: Claudette Dubois <claudette@example.com>'],
      {
        stdio: 'ignore',
        env: { ...process.env, GIT_AUTHOR_DATE: '2026-08-10T10:00:00', GIT_COMMITTER_DATE: '2026-08-10T10:00:00' },
      },
    );
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    const result = gitTeamSignals(root, nowMs, 8);
    assert.ok(result);
    assert.equal(result.agentCoauthoredPct, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitTeamSignals: no commits in the window renders unknown (null), not 0%/0 authors (AC4)', () => {
  const { root, commitAt } = initRepo();
  try {
    commitAt('2020-01-01T10:00:00', 'Ghost', 'ancient', false);
    const nowMs = Date.parse('2026-08-11T00:00:00Z');
    assert.equal(gitTeamSignals(root, nowMs, 8), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitTeamSignals: no git (unreadable history) renders unknown (null), never a crash (AC4/AC6)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-team-nogit-'));
  try {
    assert.equal(gitTeamSignals(root, NOW_MS, 8), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- attachTeamSignals (pure read-layer join) ------------------------------

test('attachTeamSignals: joins precomputed per-project team signals onto each project (mirrors attachVelocity)', () => {
  const data = { generatedAt: 'x', projects: [{ project: { id: 'alpha' } }, { project: { id: 'beta' } }] };
  const result = attachTeamSignals(data, {
    alpha: { agentCoauthoredPct: 42, agentCoauthoredCount: 4, commitCount: 10, contributorCount: 3 },
  });
  assert.deepEqual(result.projects[0].team, { agentCoauthoredPct: 42, agentCoauthoredCount: 4, commitCount: 10, contributorCount: 3 });
  assert.equal(result.projects[1].team, null); // no entry -> explicit unknown, never 0
});
