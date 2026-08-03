#!/usr/bin/env node
/*
  The PDF and the widget snapshots are built on demand rather than by the site
  render, which is what keeps `quarto preview` fast and immune to LaTeX
  problems. The price is that they can silently fall behind their sources.
  This flags that, so a stale PDF gets caught before it reaches students.

    npm run check        (also runs as part of `npm test`)

  Rules:
    figs/w-*.png   must be newer than phasor-widgets.js
    notes.pdf      must be newer than notes.qmd and than every figure
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WEEKS = fs.readdirSync(path.join(ROOT, "weeks"), { withFileTypes: true })
  .filter(d => d.isDirectory() && /^week\d+$/.test(d.name))
  .map(d => d.name);

const problems = [], notes = [];
const mtime = p => fs.statSync(p).mtimeMs;
const rel = p => path.relative(ROOT, p);
const ago = ms => {
  const h = ms / 36e5;
  return h < 1 ? `${Math.round(ms / 6e4)}m` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
};

for (const week of WEEKS) {
  const dir = path.join(ROOT, "weeks", week);
  const widgets = path.join(dir, "phasor-widgets.js");
  const figsDir = path.join(dir, "figs");
  const qmd = path.join(dir, "notes.qmd");
  const pdf = path.join(dir, "notes.pdf");

  const figs = fs.existsSync(figsDir)
    ? fs.readdirSync(figsDir).filter(f => /^w-.*\.png$/.test(f)).map(f => path.join(figsDir, f))
    : [];

  // 1. snapshots vs the widget source
  if (fs.existsSync(widgets)) {
    if (!figs.length) {
      notes.push(`${week}: no widget snapshots yet — run \`npm run snapshot\``);
    } else {
      const stale = figs.filter(f => mtime(f) < mtime(widgets));
      if (stale.length) {
        problems.push(
          `${week}: ${stale.length} snapshot(s) older than phasor-widgets.js by up to ` +
          `${ago(mtime(widgets) - Math.min(...stale.map(mtime)))} ` +
          `(${stale.map(f => path.basename(f)).join(", ")}) — run \`npm run snapshot\``);
      }
    }
  }

  // 2. the PDF vs its sources
  if (!fs.existsSync(pdf)) {
    if (fs.existsSync(qmd)) notes.push(`${week}: no notes.pdf yet — run \`tools/build-pdf.sh ${week}\``);
    continue;
  }
  const sources = [qmd, ...figs].filter(fs.existsSync);
  const newer = sources.filter(s => mtime(s) > mtime(pdf));
  if (newer.length) {
    problems.push(
      `${week}: notes.pdf is ${ago(Math.max(...newer.map(mtime)) - mtime(pdf))} behind ` +
      `${newer.map(rel).join(", ")} — run \`tools/build-pdf.sh ${week}\``);
  }
}

notes.forEach(n => console.log("  note: " + n));
problems.forEach(p => console.log("  STALE: " + p));

if (problems.length) {
  console.log(`\n${problems.length} thing(s) need rebuilding`);
  process.exit(1);
}
console.log(`freshness OK across ${WEEKS.length} week(s)`);
