#!/usr/bin/env node
// No two adjacent sections may share a background colour.
//
// THE RULE IS NOT NEW AND THIS IS NOT ITS FIRST HOME. `assertGroundSequence` in the app's
// docShell.js has enforced it for printed documents since the 2026-08-18 brief: "Never two
// identical grounds on adjacent sheets. If you add a page, re-check the whole sequence rather
// than matching the neighbour." A reader cannot re-check a whole run by eye after inserting a
// section, so the document renderer asserts instead. The public site had the same rule and no
// assertion, and on 2026-09-25 for-providers.html ran the advisory prose and the join gate on
// bg-card-solid back to back, which read as one undifferentiated slab.
//
// IT COMPARES COLOURS, NOT CLASS NAMES. Two different class names can resolve to one value, and
// on this site several do: --cream and --cream2 are both #F1E9DB today. A check on class names
// would have called `bg-cream` next to a hypothetical `bg-cream2` a pass.
//
// IT RESOLVES BY ANY CLASS, NOT JUST bg-*. The v4 pages use the bg-* convention. The MargaZine
// article template predates it and paints its sections through .refs and .related. A check that
// only understood bg-* would silently skip four pages, which is the failure mode this estate
// keeps finding: a guard reporting green while measuring nothing.
//
// A SECTION THAT PAINTS NOTHING IS NOT A BAND. The MargaZine article template runs .refs and
// .related straight down one continuous body ground on purpose: a reading page is meant to be one
// surface, and consecutive transparent blocks are that surface rather than two bands that failed
// to differ. So adjacency is only a defect when at least one of the pair explicitly paints. Two
// painted sections that match still fail, including one that paints the same colour the body
// already has, which is a band a viewer cannot see.
//
// WHAT IT DOES NOT DO. It reads single-class background declarations in source order and does not
// implement the cascade, so a background set through a descendant or compound selector is not
// resolved. Such a section is reported as unresolved and FAILS rather than being skipped, because
// a section this cannot measure is a section nobody is checking.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = 'assets/marga-v3.css';

const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** `--tok: #hex` pairs, so `var(--sand2)` can be reduced to the colour a viewer sees. */
function tokens(css) {
  const t = {};
  for (const [, k, v] of strip(css).matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8}|var\([^)]+\))\s*[;}]/g)) t[k] = v;
  return t;
}
function resolve(value, t, depth = 0) {
  const v = String(value).trim();
  const m = /^var\(\s*--([\w-]+)\s*\)$/.exec(v);
  if (m && depth < 8) return t[m[1]] ? resolve(t[m[1]], t, depth + 1) : null;
  return /^#[0-9A-Fa-f]{3,8}$/.test(v) ? expand(v.toLowerCase()) : null;
}
const expand = (h) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h.slice(0, 7));

/** Single-class rules that set a background, in source order. Later wins, as the cascade would. */
function grounds(css) {
  const map = new Map();
  /*
   * THE SEPARATOR IS ZERO WIDTH, AND IT HAS TO BE. Each match consumes the `}` that closes its own
   * rule, so a separator that consumes a character leaves the next rule nothing to match against,
   * and only every SECOND rule is read. Consuming [,{}] resolved .bg-cream and missed .bg-sand.
   * Adding \s fixed the newline-separated sheet and still missed minified CSS like
   * `html{...}body{...}`, where no character separates the two rules at all.
   *
   * It still means "a rule starts here", so a descendant selector such as `.split-head .chips` is
   * correctly not read as a rule for .chips.
   */
  for (const [, cls, body] of strip(css).matchAll(/(?:(?<=[,;{}])|^)\s*\.([\w-]+)\s*\{([^}]*)\}/gm)) {
    const bg = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body);
    if (bg) map.set(cls, bg[1].trim());
  }
  return map;
}

/** Top-level <section> elements in document order. Nested ones sit inside a parent's ground. */
function sections(html) {
  const out = [];
  let depth = 0;
  for (const m of html.matchAll(/<section\b[^>]*>|<\/section\s*>/gi)) {
    if (m[0][1] === '/') { depth -= 1; continue; }
    depth += 1;
    if (depth === 1) out.push((/class\s*=\s*"([^"]*)"/i.exec(m[0]) || [, ''])[1].split(/\s+/).filter(Boolean));
  }
  return out;
}

const sheet = read(SHEET);
/*
 * EVERY PAGE, NOT JUST THE ONES AT THE ROOT. The first version read the root directory, and
 * refractions/ holds two pages with real section runs that it therefore never opened. A guard
 * with a directory-shaped blind spot is the same failure as one with a class-name-shaped blind
 * spot, which is what the rest of this file is about. `-review.html` twins are gitignored
 * offline copies of a page already checked here, so they are the one deliberate exclusion.
 */
function walk(dir, prefix = '') {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir || '.'), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'assets') continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(rel, rel));
    else if (e.name.endsWith('.html') && !e.name.endsWith('-review.html')) out.push(rel);
  }
  return out;
}
const pages = walk('').sort();

const problems = [];
let checkedPages = 0;
let checkedPairs = 0;

for (const page of pages) {
  const html = read(page);
  // A page declares grounds of its own in an inline <style>; those come after the linked sheet.
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const t = { ...tokens(sheet), ...tokens(inline) };
  const g = new Map([...grounds(sheet), ...grounds(inline)]);

  /*
   * What the page itself paints, which is what an unpainted section shows.
   *
   * ONLY FROM THE CSS THIS PAGE ACTUALLY LOADS. The first version read body{} out of the shared
   * sheet for every page, and the MargaZine article template does not link it: those pages are
   * self-contained and set background:#F1E9DB on their own body. So an article page resolved to
   * the browser default, and a .related band painted #F1E9DB over a #F1E9DB body read as a
   * difference. That is the invisible band this check exists to catch, and it passed.
   */
  const linked = /href="[^"]*marga-v3\.css/.test(html);
  const bodyDecls = [...strip((linked ? sheet : '') + inline)
    .matchAll(/(?:(?<=[,;{}])|^)\s*(?:body|html)\s*\{([^}]*)\}/gm)]
    .map((m) => /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(m[1])?.[1])
    .filter(Boolean);
  const pageBg = resolve(bodyDecls.at(-1) || '#ffffff', t) || '#ffffff';

  const seq = sections(html).map((classes) => {
    for (const c of [...classes].reverse()) {
      if (g.has(c)) return { classes, color: resolve(g.get(c), t), by: c, painted: true };
    }
    // Nothing in this section's own classes paints it, so it shows the page ground.
    return { classes, color: pageBg, by: null, painted: false };
  });
  if (seq.length < 2) continue;
  checkedPages += 1;

  for (const [i, s] of seq.entries()) {
    if (s.color) continue;
    problems.push(`${page} section ${i + 1} (class="${s.classes.join(' ')}") declares a background this `
      + 'cannot resolve, so its adjacency is unchecked. Teach bin/ground-check.js to read it.');
  }
  for (let i = 1; i < seq.length; i += 1) {
    if (!seq[i].color || !seq[i - 1].color) continue;
    // Two unpainted siblings are one continuous ground, which is the article template by design.
    if (!seq[i].painted && !seq[i - 1].painted) continue;
    checkedPairs += 1;
    if (seq[i].color === seq[i - 1].color) {
      const name = (x) => (x.by ? `.${x.by}` : 'the page ground');
      problems.push(`${page} puts two ${seq[i].color} sections next to each other at section ${i + 1} `
        + `(${name(seq[i - 1])} then ${name(seq[i])}). Adjacent sections must differ. `
        + 'Alternate, or re-plan the run.');
    }
  }
}

// A guard that measured nothing must not report green. This is the property the estate keeps
// losing: the check ran, it passed, and it had no subject.
if (checkedPages < 10 || checkedPairs < 25) {
  console.error(`ground-check measured only ${checkedPairs} adjacent pairs across ${checkedPages} pages, `
    + 'which is too few to be checking this site. Something stopped it finding sections.');
  process.exit(2);
}

if (problems.length) {
  console.error(`ground-check: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`ground-check ok. ${checkedPairs} adjacent section pairs across ${checkedPages} pages, no repeats.`);
