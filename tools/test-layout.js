// Geometric check on widget labels.
// Records every fillText and every stroked path from a fake 2D context, then
// asserts that (a) no label is drawn outside its canvas and (b) no label box
// intersects a drawn curve. Catches the class of bug where a caption falls off
// the bottom edge or a sinusoid peak runs through its own legend.

const fs = require("fs");
const { JSDOM } = require("jsdom");

const SRC = require("path").resolve(__dirname, "../weeks/week01/phasor-widgets.js");
const code = fs.readFileSync(SRC, "utf8");

// Arial at 13px: cap height ~9px above baseline, descender ~3px below.
const ASCENT = 11, DESCENT = 3;
function textWidth(text, font) {
  const size = parseFloat((/(\d+(?:\.\d+)?)px/.exec(font) || [0, 13])[1]);
  return text.length * size * 0.55;          // generous estimate for Arial
}

function makeRecorder(W, H) {
  const labels = [], segs = [], halos = [];
  let cur = null, font = "13px Arial", style = "#000", dash = false;
  const ctx = {
    canvas: { width: W, height: H },
    set fillStyle(v) { style = v; }, get fillStyle() { return style; },
    set strokeStyle(v) { style = v; }, get strokeStyle() { return style; },
    set font(v) { font = v; }, get font() { return font; },
    lineWidth: 1,
    // every draw() starts with clearRect, so that is the frame boundary
    setTransform() {}, save() {}, restore() {},
    // an opaque backing rect makes a label legible even over a curve
    fillRect(x, y, w2, h2) {
      if (/rgba\(255,\s*255,\s*255/.test(style)) halos.push({ x0: x, y0: y, x1: x + w2, y1: y + h2 });
    },
    clearRect() { labels.length = 0; segs.length = 0; halos.length = 0; },
    setLineDash(d) { dash = !!(d && d.length); },
    measureText: t => ({ width: textWidth(t, font) }),
    beginPath() { cur = { pts: [], style, dash }; },
    moveTo(x, y) { if (cur) cur.pts.push([x, y]); },
    lineTo(x, y) { if (cur) cur.pts.push([x, y]); },
    arc(x, y) { if (cur) cur.pts.push([x, y]); },
    closePath() {},
    stroke() { if (cur && cur.pts.length > 1) segs.push(cur); },
    fill() {},
    fillText(t, x, y) {
      if (!String(t).trim()) return;
      labels.push({ text: t, x, y, w: textWidth(t, font),
                    box: { x0: x, y0: y - ASCENT, x1: x + textWidth(t, font), y1: y + DESCENT } });
    }
  };
  return { ctx, labels, segs, halos };
}

const canvases = [];
const dom = new JSDOM(
  `<!doctype html><html><body>
     <div id="w-euler"></div><div id="w-sum"></div><div id="w-ezt"></div><div id="w-rlc"></div>
   </body></html>`,
  { url: "https://tchaffey.com/x.html", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__rec) {
    // dpiCanvas sets style.width/height in CSS px; fall back to attributes
    const rec = makeRecorder(0, 0);
    this.__rec = rec;
    canvases.push({ el: this, rec });
  }
  return this.__rec.ctx;
};

(async function () {
  if (w.document.readyState === "loading") {
    await new Promise(r => w.document.addEventListener("DOMContentLoaded", r));
  }
  w.eval(code);

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail: detail || "" });

  // resolve each canvas's logical size and owning widget from the DOM
  canvases.forEach(c => {
    c.W = parseFloat(c.el.style.width) || 0;
    c.H = parseFloat(c.el.style.height) || 0;
    const host = c.el.closest("div[id^=w-]");
    c.widget = host ? host.id : "?";
  });

  const boxesOverlap = (a, b) =>
    a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  // faults found in the current frame, as "canvas -> reason" strings
  function faultsNow() {
    const out = [];
    canvases.forEach((c, idx) => {
      const tag = `${c.widget} canvas#${idx}`;
      c.rec.labels.forEach(l => {
        if (l.box.x0 < 0 || l.box.y0 < 0 || l.box.x1 > c.W || l.box.y1 > c.H) {
          out.push(`${tag}: "${l.text}" outside the canvas`);
        }
      });
      // Axes and dashed guides are excluded: a label near an axis line reads fine.
      const curves = c.rec.segs.filter(s => !s.dash && s.pts.length > 8);
      const backed = l => c.rec.halos.some(h =>
        h.x0 <= l.box.x0 && h.y0 <= l.box.y0 && h.x1 >= l.box.x1 && h.y1 >= l.box.y1);
      c.rec.labels.forEach(l => {
        if (backed(l)) return;                 // legible on top of the curve
        for (const s of curves) {
          for (let i = 1; i < s.pts.length; i++) {
            const [x1, y1] = s.pts[i - 1], [x2, y2] = s.pts[i];
            const seg = { x0: Math.min(x1, x2), x1: Math.max(x1, x2),
                          y0: Math.min(y1, y2), y1: Math.max(y1, y2) };
            if (boxesOverlap(l.box, seg)) {
              out.push(`${tag}: "${l.text}" overlaps a curve`); return;
            }
          }
        }
      });
    });
    return out;
  }

  // --- opening frame ------------------------------------------------------
  const first = faultsNow();
  check("opening frame: no clipped or overlapping labels", first.length === 0,
    [...new Set(first)].join("; "));

  // --- sweep every slider across its full range ---------------------------
  // The phasor labels track the arrow tips, so a layout that is clean at the
  // default angle can still collide a quarter-turn later. 40 steps per slider.
  const sliders = [...w.document.querySelectorAll("input[type=range]")];
  function sweepSliders(tag) {
    const seen = new Set();
    sliders.forEach((sl, si) => {
      const lo = parseFloat(sl.min), hi = parseFloat(sl.max);
      for (let k = 0; k <= 40; k++) {
        sl.value = lo + (hi - lo) * k / 40;
        sl.dispatchEvent(new w.Event("input", { bubbles: true }));
        faultsNow().forEach(f => seen.add(f + `   [slider ${si} = ${(+sl.value).toFixed(2)}]`));
      }
      sl.value = lo; sl.dispatchEvent(new w.Event("input", { bubbles: true }));
    });
    check(`slider sweep, ${tag} (${sliders.length} sliders x 41 positions): no collisions`,
      seen.size === 0, [...seen].slice(0, 6).join("\n        -> "));
  }
  sweepSliders("default state");

  // the RLC widget can show true relative amplitude; the caption and the
  // shrunken output curve change, so sweep that state too
  const toggles = [...w.document.querySelectorAll("input[type=checkbox]")];
  toggles.forEach(cb => { cb.checked = !cb.checked; cb.dispatchEvent(new w.Event("change", { bubbles: true })); });
  check("found the normalisation toggle", toggles.length === 1, `${toggles.length} checkboxes`);
  sweepSliders("normalisation off");
  toggles.forEach(cb => { cb.checked = !cb.checked; cb.dispatchEvent(new w.Event("change", { bubbles: true })); });

  // --- sweep the draggable z in the e^{zt} widget --------------------------
  const cz = w.document.querySelector("#w-ezt canvas");
  const zSeen = new Set();
  cz.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 260 });
  cz.dispatchEvent(new w.MouseEvent("mousedown", { clientX: 110, clientY: 130, bubbles: true }));
  for (let px = 6; px <= 214; px += 8) {
    for (let py = 6; py <= 254; py += 12) {
      w.dispatchEvent(new w.MouseEvent("mousemove", { clientX: px, clientY: py, bubbles: true }));
      faultsNow().forEach(f => zSeen.add(f + `   [z at (${px},${py})]`));
    }
  }
  w.dispatchEvent(new w.MouseEvent("mouseup", { bubbles: true }));
  check("dragging z across the whole plane: no collisions", zSeen.size === 0,
    [...zSeen].slice(0, 6).join("\n        -> "));

  const failed = results.filter(r => !r.pass);
  results.forEach(r => console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "\n        -> " + r.detail : ""}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
