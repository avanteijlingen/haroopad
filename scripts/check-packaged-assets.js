#!/usr/bin/env node
/**
 * Every file the HTML pages load must survive packaging.
 *
 * electron-builder's `files` list is a set of globs, and a glob written to drop
 * a library's test folder once dropped a library whose whole contents sat under
 * src/. The app still started, so the build looked fine; the missing script only
 * showed up as diagrams that never drew. This walks the <script src>/<link href>
 * of each page and fails if any of them is not inside the asar.
 *
 * Usage: node scripts/check-packaged-assets.js [path/to/app.asar]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

const SEP = String.fromCharCode(92);   /* a backslash */
const root = path.join(__dirname, '..');
const archive = process.argv[2] || path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');

if (!fs.existsSync(archive)) {
  console.error('no asar at ' + archive + ' -- build first');
  process.exit(2);
}

/* asar stores paths with the host separator and a leading one */
const packed = new Set(
  asar.listPackage(archive).map(function (p) {
    return p.replace(new RegExp("\\\\", 'g'), '/').replace(/^\//, '');
  })
);

const pages = fs.readdirSync(path.join(root, 'src'))
  .filter(function (f) { return f.endsWith('.html'); })
  .map(function (f) { return path.join('src', f); });

const ATTR = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
let missing = 0;
let stale = 0;
let checked = 0;

pages.forEach(function (page) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  let m;

  while ((m = ATTR.exec(html)) !== null) {
    const ref = m[1].trim();

    /* remote, inline, in-page and templated references are not ours to check */
    if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.charAt(0) === '#') continue;
    if (ref.indexOf('{{') > -1) continue;

    const resolved = path.posix.normalize(
      path.posix.join(path.dirname(page).split(SEP).join('/'), ref.split('?')[0].split('#')[0])
    );

    checked++;

    if (packed.has(resolved)) continue;

    /* On disk but not in the package is a packaging bug and fails the build.
     * Absent from both is a stale reference in the page: worth saying, but it
     * is equally broken before packaging, so it does not fail anything here. */
    if (fs.existsSync(path.join(root, resolved))) {
      console.error('DROPPED  ' + resolved + '   (referenced by ' + page + ')');
      missing++;
    } else {
      console.warn('stale    ' + resolved + '   (referenced by ' + page + ', not on disk either)');
      stale++;
    }
  }
});

console.log(checked + ' referenced files checked, ' + missing + ' dropped by packaging, ' + stale + ' stale');
process.exit(missing ? 1 : 0);
