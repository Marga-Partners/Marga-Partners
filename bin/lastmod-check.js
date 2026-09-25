#!/usr/bin/env node
// Every sitemap lastmod must be at least as new as the day that page's visible text last changed.
//
// WHY. lastmod is a hand-kept table in margazine-build/build_site.py, and on 2026-09-25 an audit
// found all fifteen of its marketing entries frozen at 2026-08-02 while the files had moved as
// recently as that morning: seventeen of twenty-one URLs were wrong. Google uses lastmod only
// while it finds it consistently accurate and discounts the whole sitemap's once it does not, so
// a table nobody bumps is worse than no table at all. Nothing failed for seven weeks.
//
// THE TEST IS VISIBLE TEXT, NOT THE FILE. A cache buster, a font migration and a CSS comment all
// change the bytes and none of them change the page. Stamping those is the other way to make the
// signal untrue, and CLAUDE.md already says so: bump one when that page's content actually
// changes. So this strips script, style, comments and tags, normalises whitespace, and walks the
// page's history until that string moves.
//
// IT FAILS ONLY ON STALE, never on too-new. A date ahead of the last text change is a publish
// that has not been committed yet, which is an ordinary state mid-release.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => {
  try {
    return execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return ''; }
};

/*
 * THE SHARED FURNITURE IS EXCLUDED BY ELEMENT. The nav, header and footer belong to the site, not
 * to the page: adding one footer link on 2026-09-25 moved the text of all thirteen marketing pages
 * on the same day, and this check duly failed the build for every one of them. It was right that
 * the bytes moved and wrong about what it meant.
 *
 * By element rather than by position, because scoping to <main> does not work here: this template
 * puts the footer inside main, so the first attempt at this changed nothing.
 *
 * This definition is deliberately the same one margazine-build/sitedates.py uses, in the other
 * language. Two implementations is the price of the guard living where the artifact is; they are
 * checked against each other by this passing on a sitemap that generator wrote.
 */
const visible = (html) => html
  .replace(/<(header|footer|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** The date this page's visible text last changed, or null when git cannot say. */
function textChangedOn(rel) {
  const log = git('log', '--format=%H %ad', '--date=short', '--', rel).trim();
  if (!log) return null;
  for (const line of log.split('\n').slice(0, 40)) {
    const [h, d] = line.split(' ');
    const after = git('show', `${h}:${rel}`);
    const before = git('show', `${h}^:${rel}`);
    // No parent version means the commit that introduced the file, so its text did change.
    if (!before || visible(after) !== visible(before)) return d;
  }
  return null;
}

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const entries = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)]
  .map(([, loc, lastmod]) => ({
    lastmod,
    rel: loc.replace(/^https?:\/\/(www\.)?margapartners\.com\//, '') || 'index.html',
  }));

const stale = [];
let checked = 0;
for (const { rel, lastmod } of entries) {
  const truth = textChangedOn(rel);
  if (!truth) continue;          // shallow clone, or a file with no history yet
  checked += 1;
  if (lastmod < truth) {
    stale.push(`${rel} says ${lastmod} but its visible text last changed ${truth}. `
      + 'Bump it in MARKETING in margazine-build/build_site.py and regenerate the sitemap.');
  }
}

// A run that verified nothing must not report green. On a shallow clone git answers nothing for
// every page, every entry is skipped, and the loop above passes without comparing a single date.
if (!checked) {
  console.error('lastmod-check compared no entries at all, so it verified nothing. '
    + 'This needs full git history; a shallow clone cannot answer it.');
  process.exit(2);
}
if (checked < entries.length * 0.8) {
  console.error(`lastmod-check could only date ${checked} of ${entries.length} sitemap entries.`);
  process.exit(2);
}

if (stale.length) {
  console.error(`lastmod-check: ${stale.length} stale sitemap date(s)\n`);
  for (const s of stale) console.error(`  ${s}`);
  process.exit(1);
}
console.log(`lastmod-check ok. ${checked} of ${entries.length} sitemap dates verified against page history.`);
