// Pure parsing helpers — no filesystem access, fully unit-testable.
// Hand-rolled for the flat YAML subset jig emits (ADR-0001): do not
// replace with an npm parser.

export function parseFrontmatter(text) {
  const out = { data: {}, body: text };
  if (!text.startsWith('---')) return out;
  const lines = text.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return out;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim();
    let value;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim();
      value = inner ? inner.split(',').map((s) => stripQuotes(s.trim())) : [];
    } else {
      // Drop an unquoted trailing YAML comment ("IN_PROGRESS  # note" → "IN_PROGRESS").
      // The marker must be at line start or whitespace-preceded, so values like
      // "C#" survive; a bare "# comment" scalar collapses to an empty value.
      const scalar = raw.startsWith('"') || raw.startsWith("'")
        ? raw
        : raw.replace(/(?:^|\s)#.*$/, '').trim();
      value = stripQuotes(scalar);
      if (value === '') value = null;
    }
    out.data[key] = value;
  }
  out.body = lines.slice(end + 1).join('\n');
  return out;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function normStatus(s) {
  return typeof s === 'string' ? s.trim().toUpperCase() : null;
}

// Honest progress: ABANDONED leaves the denominator, DEFERRED stays in it
// but is reported separately (parked, not "not done").
export function progressOf(items) {
  const total = items.length;
  const by = {};
  for (const it of items) {
    const s = it.status || 'UNKNOWN';
    by[s] = (by[s] || 0) + 1;
  }
  const abandoned = by.ABANDONED || 0;
  const deferred = by.DEFERRED || 0;
  const done = by.DONE || 0;
  const denom = total - abandoned;
  const pct = denom > 0 ? Math.round((done / denom) * 100) : null;
  return { done, total, abandoned, deferred, denom, pct, by };
}

const BOX_RE = /^(\s*)(?:([-*])|(\d+)[.)])\s+\[([ xX])\]\s*(.*)$/;
const HEADING_RE = /^(#{2,4})\s+(.+)$/;

// Owner comes only from the bold tag convention: **(you)** / **(Claude)**,
// including suffixed forms like **GENERATION RUN (you, tokens)**.
// "(your choice)" or a plain un-bolded "(you)" must not match.
export function ownerOf(text) {
  const m = text.match(/\*\*[^*]*\((you|claude)\b[^)]*\)[^*]*\*\*/i);
  return m ? m[1].toLowerCase() : null;
}

export function cleanStepText(text) {
  return text
    .replace(/\*\*[^*]*\((?:you|claude)[^)]*\)[^*]*\*\*/gi, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parses runbook/roadmap-shaped markdown. Steps = numbered checkboxes when
// any exist (jig runbook convention), else top-level bulleted checkboxes.
// A doc with no checkboxes at all still yields its phase headings.
export function parseRunbook(text) {
  const lines = text.split('\n');
  const titleLine = lines.find((l) => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s*/, '').trim() : null;
  const numbered = [];
  const bullets = [];
  const headings = [];
  let heading = null;
  for (const line of lines) {
    const h = line.match(HEADING_RE);
    if (h) {
      heading = h[2].trim();
      headings.push(heading);
      continue;
    }
    const b = line.match(BOX_RE);
    if (!b) continue;
    const item = {
      checked: b[4].toLowerCase() === 'x',
      text: cleanStepText(b[5]),
      owner: ownerOf(b[5]),
      phase: heading,
      topLevel: b[1].length === 0,
    };
    if (b[3] !== undefined) numbered.push(item);
    else bullets.push(item);
  }
  const steps = numbered.length ? numbered : bullets.filter((i) => i.topLevel);
  const done = steps.filter((s) => s.checked).length;
  const firstOpen = steps.find((s) => !s.checked) || null;
  const phases = steps.length
    ? [...new Set(steps.map((s) => s.phase).filter(Boolean))]
    : headings.slice(0, 12);
  return {
    title,
    steps: { done, total: steps.length },
    phases,
    currentPhase: firstOpen ? firstOpen.phase : null,
    next: firstOpen ? { text: firstOpen.text, owner: firstOpen.owner } : null,
  };
}

export function countCheckboxes(text) {
  let done = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const m = line.match(BOX_RE);
    if (!m) continue;
    total++;
    if (m[4].toLowerCase() === 'x') done++;
  }
  return { done, total };
}

export function countInboxItems(text) {
  return (text.match(/^- \[\d{4}-\d{2}-\d{2}\]/gm) || []).length;
}

// Approximate by design: a section is closed when its heading carries
// RESOLVED (and not PARTIALLY), or its body opens a **Resolved** field
// without a **Still deferred** remainder.
export function countRefinement(text) {
  const sections = text.split(/^###\s+/m).slice(1);
  let open = 0;
  for (const section of sections) {
    const head = section.split('\n')[0];
    const headResolved = /\bRESOLVED\b/.test(head) && !/PARTIALLY/i.test(head);
    const bodyResolved =
      /^\*\*Resolved\b/im.test(section) && !/^\*\*Still deferred\b/im.test(section);
    const headPartial = /PARTIALLY/i.test(head);
    if (!(headResolved || (bodyResolved && !headPartial))) open++;
  }
  return { open, total: sections.length };
}

export const BUG_CLOSED = new Set(['DONE', 'RESOLVED_ON_MAIN', 'CLOSED', 'WONT_FIX']);

// Last valid snapshot line wins; malformed lines are counted, never fatal.
export function parseCompassHistory(text) {
  let latest = null;
  let malformed = 0;
  let count = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    count++;
    try {
      const obj = JSON.parse(line);
      if (
        obj &&
        typeof obj.ts === 'string' &&
        !Number.isNaN(Date.parse(obj.ts)) &&
        typeof obj.headline === 'string'
      ) {
        latest = obj;
      } else {
        malformed++;
      }
    } catch {
      malformed++;
    }
  }
  return { latest, malformed, count };
}

// Writer-side validation of the full ADR-0002 schema. The reader
// (parseCompassHistory) stays deliberately lenient — it only needs ts and
// headline to render — but nothing malformed should ever be written.
export function validateSnapshot(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return ['snapshot must be a JSON object'];
  if (typeof obj.v !== 'number') {
    errors.push('v (schema version) is required and must be a number');
  }
  if (typeof obj.ts !== 'string' || Number.isNaN(Date.parse(obj.ts))) {
    errors.push('ts must be an ISO-8601 string');
  }
  if (typeof obj.headline !== 'string' || !obj.headline.trim()) {
    errors.push('headline must be a non-empty string');
  }
  if (obj.next !== undefined && typeof obj.next !== 'string') {
    errors.push('next must be a string when present');
  }
  if (obj.blockers !== undefined && !Array.isArray(obj.blockers)) {
    errors.push('blockers must be an array when present');
  }
  if (obj.specs !== undefined) {
    if (
      !obj.specs ||
      typeof obj.specs !== 'object' ||
      typeof obj.specs.done !== 'number' ||
      typeof obj.specs.total !== 'number'
    ) {
      errors.push('specs must be {done: number, total: number} when present');
    }
  }
  return errors;
}

// Human age of a snapshot: "this morning" / "this afternoon" /
// "this evening" / "yesterday" / "N days ago"; null for unparseable ts.
export function ageLabel(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) {
    const h = d.getHours();
    if (h < 12) return 'this morning';
    if (h < 18) return 'this afternoon';
    return 'this evening';
  }
  const dayMs = 86400000;
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / dayMs
  );
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function ageDays(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86400000);
}
