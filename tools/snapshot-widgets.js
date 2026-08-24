#!/usr/bin/env node
/*
  Render a week's canvas widgets to static PNGs for the PDF build.

    cd tools && npm install && node snapshot-widgets.js [week]

  WEEK defaults to week01. Loads weeks/<week>/phasor-widgets.js in a headless
  DOM with a real canvas behind it, drives each widget to a chosen state,
  composites multi-panel widgets into one image, and writes them to
  weeks/<week>/figs/.

  The states below are the ones quoted in the figure captions in each week's
  notes.qmd. If you change a state here, change the caption to match, or the
  text and the picture will disagree.
*/

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { createCanvas } = require("canvas");

const ROOT = path.resolve(__dirname, "..");
const WEEK = process.argv[2] || "week01";
const SRC = path.join(ROOT, `weeks/${WEEK}/phasor-widgets.js`);
const OUTDIR = path.join(ROOT, `weeks/${WEEK}/figs`);
const SCALE = 2;                    // 2 = retina-sharp in print

// --- what to render, and in what state -----------------------------------
// Each state function receives helpers for driving the widget's controls.
// Keyed by week, since each week's phasor-widgets.js defines its own set.
const WIDGETS_BY_WEEK = {
  week01: [
    {
      id: "w-euler",
      caption: "unit vector at theta = 0.9 rad, sinusoid unrolling to the right",
      state: () => {}                                   // defaults are fine
    },
    {
      id: "w-sum",
      caption: "3 + 4j tip to tail at wt = 0.6",
      state: () => {}
    },
    {
      id: "w-ezt",
      caption: "z = j, pure oscillation",
      state: ({ preset }) => { preset(0); }             // 0:z=j 1:z=-1 2:z=-1+j 3:grow
    },
    {
      id: "w-rlc",
      caption: "R = 30, X = 40 -> |Z| = 50, angle 0.927, normalised",
      state: ({ slider, checkbox }) => {
        slider(0, 40);                                  // reactance
        checkbox(0, true);                              // normalise output
      }
    }
  ],
  week02: [
    {
      id: "w-sample",
      caption: "continuous signal with sample stems at spacing Delta = 0.9",
      state: () => {}                                   // defaults are fine
    },
    {
      id: "w-delta",
      caption: "triangle u_epsilon at epsilon = 1.6, area 1",
      state: () => {}
    }
  ],
  week04: [
    {
      id: "w-square",
      caption: "square-wave partial sum at 12 waves, Gibbs peak marked",
      state: ({ slider }) => { slider(0, 12); }         // the only slider
    },
    {
      id: "w-rect",
      caption: "rectifier partial sum at 4 harmonics, largest error marked",
      state: ({ slider }) => { slider(0, 4); }
    },
    {
      id: "w-rlc-out",
      caption: "input and RLC output at 7 harmonics, wn = 2 rad/s",
      state: ({ slider }) => { slider(0, 7); }
    }
  ]
};

const WIDGETS = WIDGETS_BY_WEEK[WEEK];
if (!WIDGETS) {
  console.error(`no WIDGETS entry for "${WEEK}" — add one to WIDGETS_BY_WEEK in this file`);
  process.exit(1);
}

// --- headless DOM with real canvases --------------------------------------
const backing = new Map();

function boot() {
  const html = "<!doctype html><html><body>" +
    WIDGETS.map(x => `<div id="${x.id}"></div>`).join("") +
    "</body></html>";
  const dom = new JSDOM(html, {
    url: `https://tchaffey.com/elec2302/weeks/${WEEK}/notes.html`,
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const w = dom.window;
  Object.defineProperty(w, "devicePixelRatio", { value: SCALE, configurable: true });
  w.HTMLCanvasElement.prototype.getContext = function () {
    if (!backing.has(this)) backing.set(this, createCanvas(this.width || 300, this.height || 150));
    return backing.get(this).getContext("2d");
  };
  return w;
}

// --- driving a widget's controls ------------------------------------------
function controls(w, id) {
  const host = w.document.getElementById(id);
  const ranges = [].slice.call(host.querySelectorAll("input[type=range]"));
  const boxes = [].slice.call(host.querySelectorAll("input[type=checkbox]"));
  const buttons = [].slice.call(host.querySelectorAll("button"));
  return {
    slider(i, value) {
      const el = ranges[i];
      if (!el) throw new Error(`${id}: no slider ${i}`);
      el.value = value;
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    checkbox(i, on) {
      const el = boxes[i];
      if (!el) throw new Error(`${id}: no checkbox ${i}`);
      el.checked = on;
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
    },
    // preset chips come before the play button in the DOM
    preset(i) {
      const chips = buttons.filter(b => !/play|pause/i.test(b.textContent));
      const el = chips[i];
      if (!el) throw new Error(`${id}: no preset ${i}`);
      el.dispatchEvent(new w.Event("click", { bubbles: true }));
    }
  };
}

// --- compositing -----------------------------------------------------------
function flexRowAncestor(el) {
  let p = el.parentElement;
  while (p) {
    if (p.style && p.style.display === "flex" && p.style.flexDirection !== "column") return p;
    p = p.parentElement;
  }
  return null;
}

// Panels sitting in a flex row are drawn side by side, using that row's own
// gap so the image matches the page. Everything else stacks.
function composite(w, id) {
  const host = w.document.getElementById(id);
  const cvs = [].slice.call(host.querySelectorAll("canvas"));
  if (!cvs.length) throw new Error(`${id}: no canvases — did the widget initialise?`);

  // Find a flex-row ancestor by reading the style property rather than string
  // matching the attribute: the DOM serialises "display:flex" back out as
  // "display: flex", so a [style*="display:flex"] selector silently misses and
  // every widget comes out stacked.
  const row = cvs.length > 1 ? flexRowAncestor(cvs[0]) : null;
  const horizontal = !!row;
  const gap = row ? (parseFloat(row.style.gap) || 14) : 0;

  const cssW = cvs.map(c => parseFloat(c.style.width) || c.width);
  const cssH = cvs.map(c => parseFloat(c.style.height) || c.height);
  const W = horizontal ? cssW.reduce((a, b) => a + b, 0) + gap * (cvs.length - 1)
                       : Math.max.apply(null, cssW);
  const H = horizontal ? Math.max.apply(null, cssH)
                       : cssH.reduce((a, b) => a + b, 0) + gap * (cvs.length - 1);

  const out = createCanvas(Math.round(W * SCALE), Math.round(H * SCALE));
  const g = out.getContext("2d");
  g.fillStyle = "#fff";                       // white, not transparent, for print
  g.fillRect(0, 0, out.width, out.height);

  let x = 0, y = 0;
  cvs.forEach((c, i) => {
    const real = backing.get(c);
    if (!real) throw new Error(`${id}: panel ${i} was never drawn`);
    g.drawImage(real, Math.round(x * SCALE), Math.round(y * SCALE),
                Math.round(cssW[i] * SCALE), Math.round(cssH[i] * SCALE));
    if (horizontal) x += cssW[i] + gap; else y += cssH[i] + gap;
  });
  return { canvas: out, panels: cvs.length, gap, horizontal };
}

// --- go --------------------------------------------------------------------
(async function main() {
  const code = fs.readFileSync(SRC, "utf8");
  const w = boot();
  if (w.document.readyState === "loading") {
    await new Promise(r => w.document.addEventListener("DOMContentLoaded", r));
  }
  w.eval(code);

  fs.mkdirSync(OUTDIR, { recursive: true });
  const rows = [];
  let failed = 0;

  for (const spec of WIDGETS) {
    try {
      spec.state(controls(w, spec.id));
      const c = composite(w, spec.id);
      const buf = c.canvas.toBuffer("image/png");
      if (buf.length < 1000) throw new Error("suspiciously small PNG — blank canvas?");
      const file = path.join(OUTDIR, spec.id + ".png");
      fs.writeFileSync(file, buf);
      rows.push({
        file: path.relative(ROOT, file),
        size: `${c.canvas.width}x${c.canvas.height}`,
        panels: c.panels,
        kB: Math.round(buf.length / 1024)
      });
    } catch (e) {
      failed++;
      console.error(`  FAILED ${spec.id}: ${e.message}`);
    }
  }

  console.table(rows);
  console.log(`${rows.length}/${WIDGETS.length} widgets written to ${path.relative(ROOT, OUTDIR)}/ at ${SCALE}x`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
