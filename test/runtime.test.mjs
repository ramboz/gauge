import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

test('runtime and example configuration use Gauge identity', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'gauge');
  assert.match(pkg.description, /Gauge/);
  const example = JSON.parse(read('gauge.config.example.json'));
  assert.equal(example.version, 1);
  assert.equal(example.stateDir, '.gauge');
  assert.ok(example.projects.every((project) => project.id && Array.isArray(project.adapters)));
  assert.doesNotMatch(read('src/server.mjs'), /DASHBOARD_CONFIG|project dashboard/);
});

test('browser consumes canonical signals and treats non-Jig observations as projects', () => {
  const html = read('public/index.html');
  assert.match(html, /<title>Gauge<\/title>/);
  assert.match(html, /function signal\(/);
  assert.match(html, /p\.signals/);
  assert.doesNotMatch(html, /p\.jigManaged|not jig-managed/);
  assert.match(html, /collection\.status/);
});

test('browser isolates malformed project cards instead of blanking the grid', () => {
  const html = read('public/index.html');
  assert.match(html, /function safeCard\(/);
  assert.match(html, /try\s*{\s*return card\(project\)/);
  assert.match(html, /data\.projects\.map\(safeCard\)/);
});

test('browser interprets only understood capability type and version pairs', () => {
  const html = read('public/index.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/load\(\);\s*setInterval\(load,120000\);/, '');
  const context = vm.createContext({});
  vm.runInContext(script, context);
  const base = {
    collection: { status: 'ok' },
    collectedAt: '2026-07-13T20:00:00Z',
    errors: [],
  };
  const payload = '"><img src=x onerror=alert(1)>';
  const malicious = {
    ...base,
    project: { id: 'future', label: 'Future adapter' },
    signals: [{
      type: 'execution', version: 2, status: 'supported',
      value: { progress: { pct: payload, done: 0, denom: 1 }, items: [] },
    }],
  };
  const healthy = {
    ...base,
    project: { id: 'healthy', label: 'Healthy project' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 50, done: 1, denom: 2, deferred: 0 }, items: [] },
    }],
  };
  const maliciousCard = context.safeCard(malicious);
  const portfolio = [malicious, healthy].map(context.safeCard).join('');
  assert.doesNotMatch(maliciousCard, /<img|onerror|alert\(1\)/);
  assert.match(maliciousCard, /Execution signal unknown/);
  assert.match(portfolio, /Healthy project/);
  assert.match(portfolio, /50%/);
});

// --- 011-01: card leads with the active milestone (goal=title,             ---
// --- deadline=appetite inline) + a compact Next list. Supersedes the       ---
// --- 009-01 project-description goal/deadline card tests below (ADR-0011's ---
// --- prose goal is no longer rendered on the card — AC3); those assertions ---
// --- are replaced, not just extended, per the slice's explicit AC3.       ---

function cardContext() {
  const html = read('public/index.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/load\(\);\s*setInterval\(load,120000\);/, '');
  const context = vm.createContext({});
  vm.runInContext(script, context);
  return context;
}

const cardBase = {
  collection: { status: 'ok' },
  collectedAt: '2026-08-05T00:00:00Z',
  errors: [],
  signals: [],
};

test('card renders the active milestone\'s title as the goal line, and no longer the project-description goal (011-01 AC3)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha', goal: { value: 'Retired description goal', provenance: 'product-vision' } },
    milestone: { active: { title: 'Ship the MVP', appetite: '≤ 2 weeks from start' }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /Ship the MVP/);
  assert.doesNotMatch(html, /Retired description goal/);
});

test('card renders the active milestone\'s appetite inline as timebox text (011-01 AC4)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    milestone: { active: { title: 'Ship the MVP', appetite: '≤ 2 weeks from start' }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /≤ 2 weeks from start/);
});

test('card renders "unknown" timebox when the active milestone has no appetite ("TBD"/absent) — never a fabricated date or blank (011-01 AC4)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    milestone: { active: { title: 'Ship the MVP', appetite: null }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /Timebox:\s*unknown/);
});

test('card renders a compact Next list from remaining candidate/committed releases (011-01 AC2)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    milestone: {
      active: { title: 'Ship V1', appetite: '2 weeks' },
      next: [{ title: 'V2 planning', path: 'docs/releases/v2.md' }, { title: 'V3 planning', path: 'docs/releases/v3.md' }],
    },
  };
  const html = context.card(project);
  assert.match(html, /Next:.*V2 planning.*V3 planning/);
});

test('card renders no milestone/goal line and does not crash when there is no active milestone (011-01 AC6)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, milestone: { active: null, next: [] } };
  assert.doesNotThrow(() => context.card(project));
  assert.doesNotMatch(context.card(project), /Goal:/);
});

test('card render does not regress when milestone is entirely absent (pre-011-01 identity)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' } };
  assert.doesNotThrow(() => context.card(project));
});

test('card no longer renders a per-spec <details> list (011-01 AC5)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 50, done: 1, denom: 2, deferred: 0 }, items: [{ id: '001-a', status: 'DONE' }] },
    }],
  };
  const html = context.card(project);
  assert.doesNotMatch(html, /<details><summary>specs<\/summary>/);
  assert.doesNotMatch(html, /001-a/);
  // The progress bar itself is unaffected — 011-02 replaces it with
  // milestone-scoped progress; until then the existing global bar is reused.
  assert.match(html, /50%/);
});

// --- 011-02: the active milestone's own bar (done/denom parent specs from --
// its release doc), replacing the project-global bar; falls back to it when
// the milestone's specProgress is unknown (null).

test('card renders the active milestone\'s own progress bar + count, not the project-global figure (011-02 AC3)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 10, done: 1, denom: 10, deferred: 0 }, items: [] },
    }],
    milestone: { active: { title: 'Ship V1', specProgress: { done: 3, denom: 4, total: 4, abandoned: 0, deferred: 0, pct: 75 } }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /75%/);
  assert.match(html, /3 \/ 4 specs/);
  assert.doesNotMatch(html, /10%/);
});

test('card falls back to the project-global bar when the active milestone has no resolvable spec refs (011-02 AC4)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 50, done: 1, denom: 2, deferred: 0 }, items: [] },
    }],
    milestone: { active: { title: 'Ship V1', specProgress: null }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /50%/);
});

test('card falls back to the project-global bar when every referenced spec resolved but none are measurable (denom 0) (011-02 AC4)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 20, done: 1, denom: 5, deferred: 0 }, items: [] },
    }],
    milestone: { active: { title: 'Ship V1', specProgress: { done: 0, denom: 0, total: 1, abandoned: 1, deferred: 0, pct: null } }, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /20%/);
});

test('card render does not regress when the active milestone carries no specProgress at all (pre-011-02 identity)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 33, done: 1, denom: 3, deferred: 0 }, items: [] },
    }],
    milestone: { active: { title: 'Ship V1' }, next: [] },
  };
  assert.doesNotThrow(() => context.card(project));
  assert.match(context.card(project), /33%/);
});

// --- 011-03: fallback card for projects with no active milestone (no       --
// release plan) — a labelled project-global bar plus the discovered         --
// checklist workstreams, instead of an empty milestone area. --------------

test('card renders a distinct fallback layout (not the milestone layout) when there is no active milestone (011-03 AC1)', () => {
  const context = cardContext();
  const withMilestone = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    milestone: { active: { title: 'Ship V1', appetite: '2 weeks' }, next: [] },
  };
  const withoutMilestone = {
    ...cardBase,
    project: { id: 'beta', label: 'Beta' },
    milestone: { active: null, next: [] },
  };
  const withHtml = context.card(withMilestone);
  const withoutHtml = context.card(withoutMilestone);
  assert.doesNotMatch(withHtml, /no release plan/i);
  assert.match(withoutHtml, /no release plan/i);
  assert.doesNotMatch(withoutHtml, /Goal:/);
});

test('card labels the global bar as fallback overall spec progress when there is no active milestone (011-03 AC2)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'execution', version: 1, status: 'supported',
      value: { progress: { pct: 40, done: 2, denom: 5, deferred: 0 }, items: [] },
    }],
    milestone: { active: null, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /40%/);
  assert.match(html, /no release plan/i);
  assert.match(html, /overall spec progress/i);
});

test('card surfaces discovered checklist workstreams compactly (title + step count), with a completed-treatment chip applied only where all checkboxes are done (011-03 AC3)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [{
      type: 'workstreams', version: 1, status: 'supported',
      value: {
        items: [],
        discovered: [
          { path: 'docs/onboarding.md', title: 'Onboarding checklist', steps: { done: 2, total: 5 } },
          { path: 'docs/setup.md', title: 'Setup guide', steps: { done: 4, total: 4 } },
        ],
      },
    }],
    milestone: { active: null, next: [] },
  };
  const html = context.card(project);
  assert.match(html, /Onboarding checklist/);
  assert.match(html, /2\/5/);
  assert.match(html, /Setup guide/);
  assert.match(html, /chip ok">done/);
  // The completed-treatment chip must come from ONLY the fully-done item —
  // workstreamRow (the pre-011-03 renderer discovered items already went
  // through, via the merged streams/workstreamRow render) has no notion of
  // "done" at all, so this assertion is only satisfiable by the new
  // discoveredRow helper, not by the old merged render: it fails red if the
  // fallback branch is reverted to `streams.map(workstreamRow)`.
  const onboardingRowStart = html.indexOf('Onboarding checklist');
  const onboardingRow = html.slice(onboardingRowStart, html.indexOf('</div>', onboardingRowStart));
  assert.doesNotMatch(onboardingRow, /chip ok">done/);
});

test('card fallback shows no per-spec <details> list and no raw discovered path when a title is present (011-03 AC4)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    signals: [
      {
        type: 'execution', version: 1, status: 'supported',
        value: { progress: { pct: 50, done: 1, denom: 2, deferred: 0 }, items: [{ id: '001-a', status: 'DONE' }] },
      },
      {
        type: 'workstreams', version: 1, status: 'supported',
        value: { items: [], discovered: [{ path: 'docs/onboarding.md', title: 'Onboarding checklist', steps: { done: 1, total: 3 } }] },
      },
    ],
    milestone: { active: null, next: [] },
  };
  const html = context.card(project);
  // No per-spec markup at all (the app's only <details> widget is the
  // worktree-paths expander, never a spec list) and no raw discovered path
  // once a title is available.
  assert.doesNotMatch(html, /001-a/);
  assert.doesNotMatch(html, /docs\/onboarding\.md/);
  assert.match(html, /Onboarding checklist/);
});

test('card fallback degrades cleanly when there are neither releases nor discovered workstreams (011-03)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, milestone: { active: null, next: [] } };
  assert.doesNotThrow(() => context.card(project));
  const html = context.card(project);
  assert.match(html, /no release plan/i);
  assert.doesNotMatch(html, /workstreams<\/span>/);
});

// --- 011-04: warnings collapse to a header ⚠ icon + tooltip ---------------
// warningItems(project) is the pure assembly of plain-language attention
// items (collection warning, repository stale, cleanup-worthy worktree docs,
// "no release plan" gap) — no file paths, never DOM. card() gates the header
// ⚠ icon on its length (AC1) and renders its items as the tooltip (AC2).

const cleanProject = {
  ...cardBase,
  project: { id: 'alpha', label: 'Alpha' },
  collection: { status: 'ok' },
  signals: [
    { type: 'repository', version: 1, status: 'supported', value: { git: { lastCommit: 'today' } }, freshness: { state: 'fresh' } },
  ],
  milestone: { active: { title: 'Ship V1', appetite: '2 weeks' }, next: [] },
};

test('warningItems returns an empty array for a fully clean project (011-04 AC1)', () => {
  const context = cardContext();
  // Array.from: warningItems returns a vm-realm Array; assert.deepEqual would
  // reject it against a main-realm [] as "not reference-equal" even when
  // structurally identical, so compare via a main-realm copy instead.
  assert.deepEqual(Array.from(context.warningItems(cleanProject)), []);
});

test('card renders no ⚠ icon for a clean project (011-04 AC1)', () => {
  const context = cardContext();
  const html = context.card(cleanProject);
  assert.doesNotMatch(html, /warn-icon/);
  assert.doesNotMatch(html, /⚠/);
});

test('warningItems flags a non-ok collection status (011-04 AC1)', () => {
  const context = cardContext();
  const project = { ...cleanProject, collection: { status: 'partial' }, errors: [{ message: 'adapter timed out' }] };
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /collection partial/.test(item)));
  assert.ok(items.some((item) => /adapter timed out/.test(item)));
});

test('warningItems flags a stale repository signal (011-04 AC1)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    signals: [{ type: 'repository', version: 1, status: 'supported', value: { git: { lastCommit: '3 weeks ago' } }, freshness: { state: 'stale' } }],
  };
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /repository stale/.test(item)));
});

test('warningItems flags the "no release plan" gap (011-04 AC1)', () => {
  const context = cardContext();
  const project = { ...cleanProject, milestone: { active: null, next: [] } };
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /no release plan/i.test(item)));
});

test('warningItems flags cleanup-worthy worktree docs (stale/pushed-stale/unknown) in plain language, and never a file path (011-04 AC1/AC2)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    signals: [
      ...cleanProject.signals,
      {
        type: 'hygiene', version: 1, status: 'supported',
        value: { worktreeOnlyDocs: [{ worktree: 'sad-jepsen', path: 'docs/wt/sad-jepsen/notes.md', state: 'stale', pushed: false }] },
      },
    ],
  };
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /forgotten/.test(item) && /sad-jepsen/.test(item)));
  for (const item of items) assert.doesNotMatch(item, /docs\/wt\/sad-jepsen\/notes\.md/);
});

test('warningItems does NOT flag healthy in-progress worktree docs (active/review groups) — only cleanup-worthy ones (011-04 AC1)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    signals: [
      ...cleanProject.signals,
      {
        type: 'hygiene', version: 1, status: 'supported',
        value: { worktreeOnlyDocs: [{ worktree: 'happy-turing', path: 'docs/wt/happy-turing/notes.md', state: 'active', pushed: false }] },
      },
    ],
  };
  const items = context.warningItems(project);
  assert.equal(items.length, 0);
});

test('card renders a ⚠ icon whose tooltip lists each attention item, with no file paths (011-04 AC1/AC2)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    collection: { status: 'partial' },
    errors: [{ message: 'adapter timed out' }],
    signals: [
      ...cleanProject.signals,
      {
        type: 'hygiene', version: 1, status: 'supported',
        value: { worktreeOnlyDocs: [{ worktree: 'sad-jepsen', path: 'docs/wt/sad-jepsen/notes.md', state: 'stale', pushed: false }] },
      },
    ],
  };
  const html = context.card(project);
  assert.match(html, /class="warn-icon"/);
  assert.match(html, /collection partial/);
  assert.match(html, /sad-jepsen/);
  assert.doesNotMatch(html, /docs\/wt\/sad-jepsen\/notes\.md/);
});

test('card ⚠ affordance is keyboard-reachable, not hover-only: focusable with an accessible name (011-04 AC4)', () => {
  const context = cardContext();
  const html = context.card({ ...cleanProject, collection: { status: 'partial' } });
  const iconTag = html.match(/<span class="warn-icon"[^>]*>/)[0];
  assert.match(iconTag, /tabindex="0"/);
  assert.match(iconTag, /role="img"/);
  assert.match(iconTag, /aria-label="[^"]+"/);
  assert.match(iconTag, /title="[^"]+"/);
});

test('card no longer renders the full-width worktree warnbox for cleanup-worthy docs (011-04 AC3)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    signals: [
      ...cleanProject.signals,
      {
        type: 'hygiene', version: 1, status: 'supported',
        value: { worktreeOnlyDocs: [{ worktree: 'sad-jepsen', path: 'docs/wt/sad-jepsen/notes.md', state: 'stale', pushed: false }] },
      },
    ],
  };
  const html = context.card(project);
  assert.doesNotMatch(html, /class="warnbox"/);
});

test('card retains the "in progress" info box for healthy active/review worktree docs (011-04 AC3, honesty of scope)', () => {
  const context = cardContext();
  const project = {
    ...cleanProject,
    signals: [
      ...cleanProject.signals,
      {
        type: 'hygiene', version: 1, status: 'supported',
        value: { worktreeOnlyDocs: [{ worktree: 'happy-turing', path: 'docs/wt/happy-turing/notes.md', state: 'active', pushed: false }] },
      },
    ],
  };
  const html = context.card(project);
  assert.match(html, /class="infobox"/);
  assert.match(html, /happy-turing/);
});

test('no leftover "warnbox" reference remains in the runtime source (011-04 AC3)', () => {
  const html = read('public/index.html');
  assert.doesNotMatch(html, /warnbox/);
});

// --- 011-05: map worktrees/PRs to their milestone --------------------------
// Two-hop join: worktree name -> spec id(s) (hop 1, extractBranchSpecIds) ->
// milestone(s) whose release references that spec (hop 2, joined against the
// `referencedSpecs` src/milestone.mjs already attaches to active/next — never
// a second reimplementation of extractReferencedSpecNumbers client-side).
// worktreeMilestoneMap(project) is the pure join; card()/worktreeInfo/
// warningItems render its output.

// Fixtures below use slashless BASENAMES with a trailing hash — the actual
// shape of `d.worktree` (a `readdirSync('.claude/worktrees')` directory
// name, e.g. `slice-007-03-jig-4c8845`, `gauge-e2e-exercise-1f0b0d`); it can
// never contain a `/` or a `claude/`-style branch prefix (those exist only
// on the git branch, which `d.worktree` does not carry — see the
// hop-1-operates-on-the-directory-name deviation note).

test('extractBranchSpecIds: a spec-NNN worktree name extracts its id (HOP 1 happy path)', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('spec-096-jig-ceremony-abc123')), ['096']);
});

test('extractBranchSpecIds: a slice-NNN-NN worktree name normalizes to its PARENT spec id, never the slice suffix as a second id', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('slice-007-03-jig-4c8845')), ['007']);
});

test('extractBranchSpecIds: a multi-spec branch (spec-018-019) extracts BOTH ids, never truncated (AC2)', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('spec-018-019-portfolio-sync-9f3a2b')), ['018', '019']);
});

test('extractBranchSpecIds: a codename with an incidental 3-digit run does NOT false-match (no `spec`/`slice` token)', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('mystifying-poincare-604')), []);
});

test('extractBranchSpecIds: a bug/issue/fix codename worktree (hop-1 miss) extracts no id', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('bug-028-fix-race-4c8845')), []);
  assert.deepEqual(Array.from(context.extractBranchSpecIds('issue-111-something-4c8845')), []);
  assert.deepEqual(Array.from(context.extractBranchSpecIds('fix-scaffold-py39-thing-4c8845')), []);
});

test('extractBranchSpecIds: a word merely containing "spec" (e.g. "respec-042") is not a false match', () => {
  const context = cardContext();
  assert.deepEqual(Array.from(context.extractBranchSpecIds('respec-042-thing-4c8845')), []);
});

const wt011ProjectBase = {
  ...cardBase,
  project: { id: 'alpha', label: 'Alpha' },
};

function withWorktreeDocs(project, docs) {
  return {
    ...project,
    signals: [
      ...(project.signals || []),
      { type: 'hygiene', version: 1, status: 'supported', value: { worktreeOnlyDocs: docs } },
    ],
  };
}

test('worktreeMilestoneMap: HOP1+HOP2 happy path — a spec-encoding worktree whose spec IS release-referenced maps to that milestone', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011', '012'] }, next: [] } },
    [{ worktree: 'slice-011-05-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped, unassociated } = context.worktreeMilestoneMap(project);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].milestone.path, 'docs/releases/v1.md');
  assert.equal(mapped[0].worktrees.length, 1);
  assert.equal(mapped[0].worktrees[0].worktree, 'slice-011-05-jig-4c8845');
  assert.equal(unassociated.length, 0);
});

test('worktreeMilestoneMap: HOP2 miss — a valid spec id that no release references lands unassociated, SHOWING the spec id (AC5)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Local Loop', path: 'docs/releases/local.md', referencedSpecs: ['003', '004', '009'] }, next: [] } },
    [{ worktree: 'slice-007-03-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped, unassociated } = context.worktreeMilestoneMap(project);
  assert.equal(mapped.length, 0);
  assert.equal(unassociated.length, 1);
  assert.equal(unassociated[0].worktree, 'slice-007-03-jig-4c8845');
  assert.deepEqual(Array.from(unassociated[0].specIds), ['007']);
});

test('worktreeMilestoneMap: HOP1 miss — a codename worktree maps to no milestone and lands unassociated with an empty specIds', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011'] }, next: [] } },
    [{ worktree: 'sad-jepsen-f75be4', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped, unassociated } = context.worktreeMilestoneMap(project);
  assert.equal(mapped.length, 0);
  assert.equal(unassociated[0].worktree, 'sad-jepsen-f75be4');
  assert.deepEqual(Array.from(unassociated[0].specIds), []);
});

test('worktreeMilestoneMap: multi-spec branch (spec-018-019) maps independently to each referenced id\'s milestone, never truncated (AC2)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    {
      ...wt011ProjectBase,
      milestone: {
        active: { title: 'Release A', path: 'docs/releases/a.md', referencedSpecs: ['018'] },
        next: [{ title: 'Release B', path: 'docs/releases/b.md', referencedSpecs: ['019'] }],
      },
    },
    [{ worktree: 'spec-018-019-portfolio-sync-9f3a2b', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped } = context.worktreeMilestoneMap(project);
  const paths = Array.from(mapped).map((m) => m.milestone.path).sort();
  assert.deepEqual(paths, ['docs/releases/a.md', 'docs/releases/b.md']);
});

test('worktreeMilestoneMap: set-valued join — one spec id referenced by SEVERAL milestones maps the worktree to EACH, never one picked arbitrarily (AC1)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    {
      ...wt011ProjectBase,
      milestone: {
        active: { title: 'Local Loop', path: 'docs/releases/local.md', referencedSpecs: ['004'] },
        next: [{ title: 'Terminal Analytics Loop', path: 'docs/releases/terminal.md', referencedSpecs: ['004'] }],
      },
    },
    [{ worktree: 'spec-004-jig-7e1a09', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped } = context.worktreeMilestoneMap(project);
  const paths = Array.from(mapped).map((m) => m.milestone.path).sort();
  assert.deepEqual(paths, ['docs/releases/local.md', 'docs/releases/terminal.md']);
  for (const entry of mapped) assert.equal(entry.worktrees[0].worktree, 'spec-004-jig-7e1a09');
});

test('worktreeMilestoneMap: normalizes digit-padding on BOTH sides of the join — an unpadded release reference ("spec 7") still maps a zero-padded branch id ("spec-007") (reconciliation)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['7'] }, next: [] } },
    [{ worktree: 'spec-007-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const { mapped, unassociated } = context.worktreeMilestoneMap(project);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].milestone.path, 'docs/releases/v1.md');
  assert.equal(unassociated.length, 0);
});

test('worktreeMilestoneMap: PR-based mapping — a resolved PR is carried onto the mapped worktree entry', () => {
  const context = cardContext();
  const pr = { number: 42, url: 'https://example.com/pr/42', state: 'OPEN' };
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011'] }, next: [] } },
    [{ worktree: 'slice-011-05-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: true, pr }],
  );
  const { mapped } = context.worktreeMilestoneMap(project);
  assert.deepEqual(mapped[0].worktrees[0].pr, pr);
});

test('worktreeMilestoneMap: a fallback (no-release-plan) project maps every worktree — spec-encoding or not — to unassociated', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: null, next: [] } },
    [
      { worktree: 'slice-011-05-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: false },
      { worktree: 'sad-jepsen-9c21af', path: 'docs/wt/y/notes.md', state: 'stale', pushed: false },
    ],
  );
  const { mapped, unassociated } = context.worktreeMilestoneMap(project);
  assert.equal(mapped.length, 0);
  assert.equal(unassociated.length, 2);
});

test('card renders a milestone-attributed "in progress" section for a mapped healthy worktree, with a compact PR badge and NO file paths (AC3/AC6)', () => {
  const context = cardContext();
  const pr = { number: 7, url: 'https://example.com/pr/7', state: 'OPEN' };
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011'] }, next: [] } },
    [{ worktree: 'slice-011-05-jig-4c8845', path: 'docs/wt/should-not-appear/notes.md', state: 'active', pushed: true, pr }],
  );
  const html = context.card(project);
  assert.match(html, /Ship V1/);
  assert.match(html, /slice-011-05-jig-4c8845/);
  assert.match(html, /PR #7/);
  assert.doesNotMatch(html, /docs\/wt\/should-not-appear\/notes\.md/);
});

test('card surfaces an unassociated worktree in a clearly-labelled affordance, showing its encoded spec id on a HOP2 miss (AC5)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Local Loop', path: 'docs/releases/local.md', referencedSpecs: ['003'] }, next: [] } },
    [{ worktree: 'slice-007-03-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'active', pushed: false }],
  );
  const html = context.card(project);
  assert.match(html, /unassociated/i);
  assert.match(html, /slice-007-03-jig-4c8845/);
  assert.match(html, /007/);
  assert.doesNotMatch(html, /docs\/wt\/x\/notes\.md/);
});

test('card ⚠ tooltip attributes a cleanup-worthy worktree to its milestone when both hops resolve (AC4)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011'] }, next: [] } },
    [{ worktree: 'slice-011-05-jig-4c8845', path: 'docs/wt/x/notes.md', state: 'stale', pushed: false }],
  );
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /forgotten/.test(item) && /slice-011-05-jig-4c8845/.test(item) && /Ship V1/.test(item)));
});

test('card ⚠ tooltip notes a cleanup-worthy worktree as unassociated when the join does not resolve (AC4)', () => {
  const context = cardContext();
  const project = withWorktreeDocs(
    { ...wt011ProjectBase, milestone: { active: { title: 'Ship V1', path: 'docs/releases/v1.md', referencedSpecs: ['011'] }, next: [] } },
    [{ worktree: 'sad-jepsen-9c21af', path: 'docs/wt/x/notes.md', state: 'stale', pushed: false }],
  );
  const items = context.warningItems(project);
  assert.ok(items.some((item) => /forgotten/.test(item) && /sad-jepsen-9c21af/.test(item) && /unassociated/i.test(item)));
});

// --- 009-02: card shows the forecast/risk read (ADR-0006/ADR-0012, AC5) ---

test('card renders an on_track forecast with its reason (AC5)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, forecast: { state: 'on_track', reason: 'pace-meets-required' } };
  const html = context.card(project);
  assert.match(html, /forecast: on_track/);
  assert.match(html, /pace-meets-required/);
});

test('card renders an at_risk forecast with its reason (AC5)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, forecast: { state: 'at_risk', reason: 'pace-behind-required' } };
  const html = context.card(project);
  assert.match(html, /forecast: at_risk/);
  assert.match(html, /pace-behind-required/);
});

test('card renders unknown forecast as an explicit, legible state — never blank or a green default (AC5)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, forecast: { state: 'unknown', reason: 'insufficient-history' } };
  const html = context.card(project);
  assert.match(html, /forecast: unknown/);
  assert.match(html, /insufficient-history/);
  // "unknown" must not render inside the same chip class used for on_track
  // (the "ok"/green class) — it gets its own ("partial") legible treatment.
  assert.doesNotMatch(html, /chip ok">forecast: unknown/);
});

test('card render does not regress when forecast is entirely absent (pre-009-02 identity)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' } };
  assert.doesNotThrow(() => context.card(project));
  assert.doesNotMatch(context.card(project), /forecast:/);
});

// --- 009-02 AC1/AC5: server read layer wires the history-derived forecast ---

test('server /api/data wiring reads each project\'s history and attaches the forecast via the pure fold (AC1/AC5)', () => {
  const src = read('src/server.mjs');
  assert.match(src, /import\s*\{\s*readObservationHistory\s*\}\s*from\s*'\.\/state\.mjs'/);
  assert.match(src, /import\s*\{\s*attachForecasts,\s*attentionQueue\s*\}\s*from\s*'\.\/derive\.mjs'/);
  assert.match(src, /attachForecasts\(/);
  assert.match(src, /readObservationHistory\(/);
});

// --- 009-01 AC5: runtime never reads/parses product-vision.md, a release doc, ---
// or a README to derive a goal/deadline — the only reader of those source
// artifacts (for goal/deadline purposes) is src/discover.mjs (surfacing) and
// scripts/onboard.mjs (its CLI). This does not forbid scan.mjs's unrelated,
// pre-existing read of docs/releases/*.md for workstream display (007), which
// never produces a goal/deadline value.
test('the literal string "product-vision.md" appears only in the onboarding/discover surfacing path (AC5)', () => {
  const files = ['src/observation.mjs', 'src/scan.mjs', 'src/config.mjs', 'src/server.mjs', 'src/lib.mjs', 'src/state.mjs'];
  for (const file of files) {
    assert.doesNotMatch(read(file), /product-vision\.md/, file);
  }
  // The only runtime/CLI file allowed to reference it is discover.mjs itself.
  assert.match(read('src/discover.mjs'), /product-vision\.md/);
});

// --- 009-03: global attention queue (ADR-0013, AC5) ------------------------

// --- 011-01: active/next milestone wiring -----------------------------

test('server /api/data wiring attaches the active/next milestone via the pure fold (011-01)', () => {
  const src = read('src/server.mjs');
  assert.match(src, /import\s*\{\s*attachMilestones\s*\}\s*from\s*'\.\/milestone\.mjs'/);
  assert.match(src, /attachMilestones\(/);
});

test('server /api/data wiring attaches the attention queue via the pure ranking fold (AC5)', () => {
  const src = read('src/server.mjs');
  assert.match(src, /import\s*\{\s*attachForecasts,\s*attentionQueue\s*\}\s*from\s*'\.\/derive\.mjs'/);
  assert.match(src, /attentionQueue\(/);
  assert.match(src, /attention:\s*attentionQueue/);
});

// --- 012-02: git velocity wiring --------------------------------------------

test('server /api/data wiring reads each project\'s git history and attaches velocity via the pure fold (AC1/AC5/AC6)', () => {
  const src = read('src/server.mjs');
  assert.match(src, /import\s*\{\s*gitVelocity,\s*attachVelocity\s*\}\s*from\s*'\.\/velocity\.mjs'/);
  assert.match(src, /gitVelocity\(/);
  assert.match(src, /attachVelocity\(/);
});

test('dashboard renders a ranked attention queue region distinct from the per-project cards (AC5)', () => {
  const html = read('public/index.html');
  // A distinct container/section, rendered by a distinct function from the
  // per-project safeCard/.grid render — not folded into the cards grid.
  assert.match(html, /class="queue-section"/);
  assert.match(html, /<ol class="queue" id="queue">/);
  assert.match(html, /function queueRow\(/);
  assert.match(html, /data\.attention/);
  // The queue section markup appears before the per-project .grid container.
  assert.ok(html.indexOf('id="queue"') < html.indexOf('id="grid"'));
});

test('queueRow renders the project and its explained reason', () => {
  const context = cardContext();
  const html = context.queueRow({ id: 'alpha', label: 'Alpha', tier: 1, reason: 'at risk · deadline in 3 days' });
  assert.match(html, /Alpha/);
  assert.match(html, /at risk · deadline in 3 days/);
});

test('queueRow escapes attention-entry text — no raw markup injected from a project label or reason (AC5, XSS safety)', () => {
  const context = cardContext();
  const payload = '"><img src=x onerror=alert(1)>';
  const html = context.queueRow({ id: 'x', label: payload, tier: 1, reason: payload });
  // The dangerous characters (< > ") must be entity-escaped, not passed
  // through raw — the payload text itself is expected to survive (as inert
  // text), just never as a live tag.
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('safeQueueRow isolates a malformed attention entry instead of breaking the whole queue render', () => {
  const context = cardContext();
  assert.doesNotThrow(() => context.safeQueueRow(null));
  assert.match(context.safeQueueRow(null), /Invalid attention entry/);
});

test('no runtime module (outside discover.mjs) computes a "goal" or "deadline" value from file content (AC3/AC5)', () => {
  // observation.mjs's join (joinProjectProfileFields) only ever echoes
  // `profile.goal`/`profile.deadline` — verified file-I/O-free in
  // observation.test.mjs. This is the companion static check: scan.mjs (the
  // only module that reads release-doc content, for the pre-existing
  // workstream feature) must never assign a goal/deadline field.
  const scan = read('src/scan.mjs');
  assert.doesNotMatch(scan, /\bgoal\s*:/);
  assert.doesNotMatch(scan, /\bdeadline\s*:/);
});

// --- 012-02: git velocity on the card ---------------------------------------
// `p.velocity` is attached by the server read layer (src/velocity.mjs's
// attachVelocity), mirroring milestone/forecast — either `{ perWeek, buckets }`
// or `null` (explicit unknown, AC4). The card renders a headline "commits/wk"
// number plus a compact sparkline (AC2/AC3), or the literal word "unknown"
// when velocity is null, never a fabricated 0 (AC4).

test('card renders the commits/wk headline and a sparkline from a supported velocity (AC2/AC3)', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    velocity: { perWeek: 3.5, buckets: [0, 1, 2, 3, 4, 5, 6, 7] },
  };
  const html = context.card(project);
  assert.match(html, /3\.5 commits\/wk/i);
  assert.doesNotMatch(html, /velocity.*unknown/i);
});

test('card renders explicit "unknown" (never a fabricated 0) when velocity is null (AC4)', () => {
  const context = cardContext();
  const project = { ...cardBase, project: { id: 'alpha', label: 'Alpha' }, velocity: null };
  const html = context.card(project);
  // Scoped to the velocity block's own markup, not just any "unknown" text on
  // the card (the card's unrelated execution-signal fallback also renders
  // "Execution signal unknown.", which would make a bare /\bunknown\b/i
  // assertion pass even if velocityBlock rendered nothing at all).
  assert.match(html, /velocity <span class="unknown">unknown<\/span>/);
  assert.doesNotMatch(html, /0 commits\/wk/i);
});

test('card renders the headline AND an empty (non-crashing) sparkline span on an empty bucket series', () => {
  const context = cardContext();
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    velocity: { perWeek: 0.1, buckets: [] },
  };
  const html = context.card(project);
  assert.match(html, /≈ 0\.1 commits\/wk/);
  assert.match(html, /<span class="spark"[^>]*><\/span>/);
});

test('card shows "< 0.1 commits/wk" — never "≈ 0" — when a real, non-null velocity rounds to zero (AC4 zero-as-healthy guard)', () => {
  const context = cardContext();
  // A genuine but sub-0.1/wk rate (e.g. 1 commit over a large window) still
  // rounds `perWeek` to 0 at the data layer (see velocity.test.mjs), yet the
  // velocity object stays non-null — this is KNOWN, near-zero activity, not
  // the unknown state AC4 guards. The display must not collapse that into
  // the same "0" text an unknown/healthy-zero would use.
  const project = {
    ...cardBase,
    project: { id: 'alpha', label: 'Alpha' },
    velocity: { perWeek: 0, buckets: [0, 0, 0, 0, 0, 0, 0, 1] },
  };
  const html = context.card(project);
  assert.match(html, /&lt; 0\.1 commits\/wk/);
  assert.doesNotMatch(html, /≈ 0 commits\/wk/);
});
