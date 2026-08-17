/* ELEC2302 Lecture 3 — interactive canvas widgets
   House style: navy #00468C input side, brick #C0392B output side, thin guides.
   Self-contained and guarded by container id, so slides may be reordered freely.
   Pure vanilla JS + canvas, no dependencies. */
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", INK = "#222",
        XCURVE = "rgba(0,70,140,0.55)", YTRUE = "rgba(120,120,128,0.85)",
        SLICE_FILL = "rgba(0,70,140,0.09)", SLICE_EDGE = "rgba(0,70,140,0.30)";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week3-<name>  (e.g.
  //   widget-week3-sample). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week3-sample is
  //   the count of distinct visitors who touched that widget. Divide it by
  //   the visits to the page itself to get the proportion who engaged.
  //
  //   Requires count.js to be loaded site-wide (see _quarto.yml). If it is
  //   absent -- local preview, an ad blocker, a student with JS restrictions
  //   -- every call here silently does nothing and the widgets still work.
  //
  //   CAVEAT, and it matters for lecture-theatre numbers: GoatCounter builds
  //   its session key from site + User-Agent + IP. Students sharing the
  //   campus NAT with the same browser and OS version collapse into a single
  //   visitor, so counts taken during a lecture UNDERCOUNT, sometimes badly.
  //   Numbers from students studying at home are far more trustworthy. Read
  //   these as a lower bound and as relative popularity between widgets, not
  //   as a headcount.
  //
  //   A local per-browser tally is kept as well, for checking the plumbing
  //   works. Open the console on any page carrying a widget and run:
  //       elec2302usage()          -> table of counts on THIS browser
  //       elec2302usage.json()     -> full record, incl. which events fired
  //       elec2302usage.reset()    -> clear it
  //   That tally never leaves the machine it is on, so it shows your own
  //   usage, not a student's. Student numbers live in GoatCounter.
  //
  const TRACK = (function () {
    const KEY = "elec2302.widgetUsage", VERSION = 1, GAP = 700;
    const WEEK = "week3";                      // namespaces events across weeks
    let data = null, lastAt = {}, dirty = false, timer = null;
    const sent = {};                           // widget id -> event already sent this page load

    // -- local tally (diagnostic only) --------------------------------------
    function blank() {
      return { v: VERSION, firstSeen: new Date().toISOString(), lastUsed: null, widgets: {} };
    }
    function load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        data = raw ? JSON.parse(raw) : null;
      } catch (e) { data = null; }             // private mode, file://, blocked storage
      if (!data || data.v !== VERSION) data = blank();
    }
    function save() {
      if (!dirty || !data) return;
      try { window.localStorage.setItem(KEY, JSON.stringify(data)); dirty = false; } catch (e) {}
    }
    function queueSave() {
      if (timer) return;
      timer = setTimeout(function () { timer = null; save(); }, 500);
    }
    function rec(id) {
      if (!data.widgets[id]) {
        data.widgets[id] = { slider: 0, play: 0, drag: 0, preset: 0, sent: 0, lastUsed: null, pages: {} };
      }
      return data.widgets[id];
    }

    // -- the bit that actually answers "how many students" ------------------
    // One event per widget per page load. GoatCounter additionally dedupes by
    // session over 8 hours, so a student who reloads is still counted once.
    //
    // count.js is loaded async, so it may not be there yet when someone grabs
    // a slider in the first second. Rather than drop that interaction, hold it
    // and retry: otherwise the keenest students are exactly the ones missed.
    const pending = {};
    let retries = 0, retryTimer = null;

    function ready() {
      return !!(window.goatcounter && typeof window.goatcounter.count === "function");
    }
    function send(id) {
      const name = "widget-" + WEEK + "-" + String(id).replace(/^w-/, "");
      try {
        window.goatcounter.count({ path: name, title: "Widget interaction: " + name, event: true });
        sent[id] = true; delete pending[id];
        if (data) { rec(id).sent += 1; dirty = true; queueSave(); }
      } catch (e) {
        sent[id] = true; delete pending[id];   // blocked or erroring: stop trying
      }
    }
    function flush() {
      Object.keys(pending).forEach(function (id) { if (ready()) send(id); });
    }
    function scheduleRetry() {
      if (retryTimer || retries >= 10) return;   // ~10s, then give up quietly
      retryTimer = setTimeout(function () {
        retryTimer = null; retries += 1;
        flush();
        if (Object.keys(pending).length) scheduleRetry();
      }, 1000);
    }
    function beacon(id) {
      if (sent[id]) return;
      if (ready()) { send(id); return; }
      pending[id] = true;
      scheduleRetry();
    }
    window.addEventListener("load", flush);

    // kind: "slider" | "play" | "drag" | "preset"
    function hit(id, kind) {
      if (!id) return;
      beacon(id);
      if (!data) return;
      const now = Date.now(), k = id + "|" + kind;
      // coalesce a continuous gesture into a single interaction (clicks exempt)
      if (kind !== "play" && kind !== "preset" && now - (lastAt[k] || 0) < GAP) {
        lastAt[k] = now; return;
      }
      lastAt[k] = now;
      const r = rec(id), stamp = new Date().toISOString();
      r[kind] = (r[kind] || 0) + 1;
      r.lastUsed = data.lastUsed = stamp;
      const page = (window.location && window.location.pathname) || "(unknown)";
      r.pages[page] = (r.pages[page] || 0) + 1;
      dirty = true; queueSave();
    }

    function report() {
      const rows = {};
      Object.keys(data.widgets).forEach(function (id) {
        const r = data.widgets[id];
        rows[id] = { slider: r.slider, play: r.play, drag: r.drag, preset: r.preset,
                     eventsSent: r.sent, lastUsed: r.lastUsed };
      });
      if (Object.keys(rows).length === 0) console.log("elec2302usage: no interactions recorded on this browser yet");
      else if (console.table) console.table(rows);
      else console.log(rows);
      if (!window.goatcounter) {
        console.log("note: GoatCounter is not loaded on this page, so nothing is being reported centrally.");
      }
      return rows;
    }

    load();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", function () { if (document.hidden) save(); });

    const api = function () { save(); return report(); };
    api.json  = function () { save(); return JSON.parse(JSON.stringify(data)); };
    api.reset = function () { data = blank(); lastAt = {}; dirty = true; save(); return "local usage counters cleared"; };
    window.elec2302usage = api;

    return { hit: hit };
  })();

  // ---- tiny helpers -------------------------------------------------------
  function dpiCanvas(cv, w, h) {
    const r = window.devicePixelRatio || 1;
    cv.width = w * r; cv.height = h * r;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return ctx;
  }
  // vertical stem with a head that shrinks with the stem, so small weights
  // degrade to a bare line instead of an arrowhead blob on the axis.
  function stem(ctx, x, y0, y1, color, lw) {
    const len = Math.abs(y1 - y0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    const hd = Math.min(7, 0.45 * len);
    if (hd > 1.5) {
      const s = Math.sign(y1 - y0);
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x - hd * 0.6, y1 - s * hd);
      ctx.lineTo(x + hd * 0.6, y1 - s * hd);
      ctx.closePath(); ctx.fill();
    }
  }

  // ========================================================================
  // Impulse comb -> convolution:  x ≈ Σ x(kΔ)Δ δ(t−kΔ)  ⇒  y ≈ Σ x(kΔ)Δ h(t−kΔ)
  // ========================================================================
  function comb() {
    const host = document.getElementById("w-comb"); if (!host) return;

    // --- model -----------------------------------------------------------
    // Time in ms, so the lecture numbers carry over directly:
    //   α = 3000 s⁻¹ = 3 ms⁻¹,  ω_d = 4000 rad/s = 4 rad/ms,  ω_n² = 25 ms⁻²
    //   h(t) = (ω_n²/ω_d) e^{−αt} sin(ω_d t) = 6.25 e^{−3t} sin(4t),  ∫h dt = 1.
    const ALPHA = 3, WD = 4, WN2 = 25, T1 = 4, DUR = 1.5;
    function h(t) { return t >= 0 ? (WN2 / WD) * Math.exp(-ALPHA * t) * Math.sin(WD * t) : 0; }
    // Vertical ranges are fixed per signal — never per Δ — so that the shrinking
    // arrows and the settled output both read honestly as Δ changes.
    const SIGS = {
      halfsine: { lab: "half-sine pulse", area: 2 * DUR / Math.PI,
                  vlo: -0.20, vhi: 1.15, rlo: -0.30, rhi: 1.35,
                  f: t => (t >= 0 && t <= DUR) ? Math.sin(Math.PI * t / DUR) : 0 },
      fullsine: { lab: "full sine cycle", area: 0,
                  vlo: -1.15, vhi: 1.15, rlo: -1.20, rhi: 1.20,
                  f: t => (t >= 0 && t <= DUR) ? Math.sin(2 * Math.PI * t / DUR) : 0 }
    };
    let sigKey = "halfsine", D = 0.285;

    // true y = x * h, computed once per signal on a fine grid
    const NT = 1200, dtT = T1 / NT;
    const trueCache = {};
    function trueY(key) {
      if (trueCache[key]) return trueCache[key];
      const f = SIGS[key].f, out = new Float64Array(NT + 1);
      for (let i = 0; i <= NT; i++) {
        let s = 0; const t = i * dtT;
        for (let j = 0; j <= i; j++) s += f(j * dtT) * h(t - j * dtT) * dtT;
        out[i] = s;
      }
      trueCache[key] = out; return out;
    }

    // comb for the current Δ: x is the sample value (the slice's height),
    // w is the impulse weight (the arrow's height) = the slice's area.
    function weights() {
      const f = SIGS[sigKey].f, w = [];
      for (let k = 0; k * D <= T1 + 1e-9; k++) {
        const t = k * D, v = f(t);
        if (v !== 0) w.push({ t, x: v, w: v * D });
      }
      return w;
    }

    // --- layout ----------------------------------------------------------
    // padB carries the tick labels AND the readouts, so the readouts sit outside
    // the plot box and cannot collide with a signal that swings negative.
    const W = 352, H = 298, padL = 34, padR = 10, padT = 16, padB = 76;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const RO = padT + plotH;          // readout block starts below the plot box
    const xm = t => padL + t / T1 * plotW;
    let scL, cyL, scR, cyR;
    function setGeom() {
      const s = SIGS[sigKey];
      scL = plotH / (s.vhi - s.vlo); cyL = padT + s.vhi * scL;
      scR = plotH / (s.rhi - s.rlo); cyR = padT + s.rhi * scR;
    }
    const yL = v => cyL - v * scL, yR = v => cyR - v * scR;

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;";
    host.appendChild(row);
    const cl = document.createElement("canvas"), cr = document.createElement("canvas");
    [cl, cr].forEach(c => { const d = document.createElement("div"); d.appendChild(c); row.appendChild(d); });
    const gl = dpiCanvas(cl, W, H), gr = dpiCanvas(cr, W, H);

    function grid(ctx, cy) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (let t = 1; t <= T1; t++) {
        ctx.beginPath(); ctx.moveTo(xm(t), padT); ctx.lineTo(xm(t), padT + plotH); ctx.stroke();
      }
      ctx.strokeStyle = GREY;
      ctx.beginPath(); ctx.moveTo(padL, cy); ctx.lineTo(padL + plotW, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.stroke();
      ctx.fillStyle = GREY; ctx.font = "12px Arial";
      for (let t = 1; t <= T1; t++) ctx.fillText(String(t), xm(t) - 3, padT + plotH + 14);
      ctx.fillText("t (ms)", padL + plotW - 40, padT + plotH + 14);
    }
    function curve(ctx, ymap, f, color, lw, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const t = px / plotW * T1, y = ymap(f(t));
        px ? ctx.lineTo(padL + px, y) : ctx.moveTo(padL + px, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // --- left: the comb --------------------------------------------------
    const T_HI = 0.6;                 // slice whose arithmetic is spelled out
    function drawL(w) {
      grid(gl, cyL);
      const sig = SIGS[sigKey];
      // Slice rectangles: height x(kΔ), width Δ. Each impulse stands in for one
      // of these slabs and records its AREA. Their union is the region between x
      // and the axis, whose signed area is the invariant Σ wₖ — so the shading
      // holds still while the arrows collapse.
      const wide = D / T1 * plotW > 5;
      gl.fillStyle = SLICE_FILL; gl.strokeStyle = SLICE_EDGE; gl.lineWidth = 1;
      w.forEach(p => {
        const x0 = xm(p.t), x1 = xm(Math.min(p.t + D, T1)), yt = yL(p.x);
        gl.fillRect(x0, Math.min(yt, cyL), x1 - x0, Math.abs(cyL - yt));
        if (wide) gl.strokeRect(x0, Math.min(yt, cyL), x1 - x0, Math.abs(cyL - yt));
      });
      curve(gl, yL, sig.f, XCURVE, 1.5);             // x(t) itself
      // the slice quoted in the readout, marked only by a heavier arrow
      let hi = -1, best = Infinity;
      w.forEach((p, i) => {
        const d = Math.abs(p.t + D / 2 - T_HI); if (d < best) { best = d; hi = i; }
      });
      w.forEach((p, i) => stem(gl, xm(p.t), cyL, yL(p.w), NAVY, i === hi ? 2.8 : 1.6));
      // readouts, below the plot box
      let tot = 0; w.forEach(p => tot += p.w);
      gl.fillStyle = INK; gl.font = "13px Arial";
      gl.fillText("arrow height = x(k\u0394)\u00B7\u0394 = slice area", padL + 4, RO + 30);
      gl.font = "12px Arial"; gl.fillStyle = "#555";
      gl.fillText("\u03A3 w\u2096 = " + tot.toFixed(2) +
                  "   (\u222Bx dt = " + sig.area.toFixed(2) + ")   \u00B7   " +
                  w.length + " impulses", padL + 4, RO + 45);
      if (hi >= 0) {
        const p = w[hi];
        gl.fillText("slice: x\u00B7\u0394 = " + p.x.toFixed(2) + " \u00D7 " + D.toFixed(3) +
                    " = " + p.w.toFixed(3) + " = arrow", padL + 4, RO + 60);
      }
    }

    // --- right: the reconstructed output ---------------------------------
    function drawR(w) {
      grid(gr, cyR);
      const ty = trueY(sigKey);
      curve(gr, yR, t => ty[Math.round(t / dtT)], YTRUE, 1.5, [5, 4]);   // exact x*h
      gr.strokeStyle = OUT; gr.lineWidth = 2; gr.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const t = px / plotW * T1;
        let s = 0;
        for (let i = 0; i < w.length; i++) { if (w[i].t > t) break; s += w[i].w * h(t - w[i].t); }
        px ? gr.lineTo(padL + px, yR(s)) : gr.moveTo(padL + px, yR(s));
      }
      gr.stroke();
      gr.fillStyle = INK; gr.font = "13px Arial";
      gr.fillText("y(t) = \u03A3 w\u2096 h(t \u2212 k\u0394)", padL + 4, RO + 30);
      gr.font = "12px Arial"; gr.fillStyle = "#555";
      gr.fillText("dashed: exact x \u2217 h", padL + 4, RO + 45);
    }

    function redraw() { const w = weights(); drawL(w); drawR(w); }

    // --- controls --------------------------------------------------------
    const bar1 = document.createElement("div");
    bar1.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center;";
    host.appendChild(bar1);
    const lab1 = document.createElement("span");
    lab1.style.cssText = "font:13px Arial;color:#555;";
    lab1.textContent = "input x(t):";
    bar1.appendChild(lab1);
    const sigBtns = [];
    Object.keys(SIGS).forEach(k => {
      const b = document.createElement("button");
      b.textContent = SIGS[k].lab;
      b.dataset.key = k;
      b.style.cssText = "border:1px solid " + NAVY + ";border-radius:5px;padding:3px 10px;" +
        "cursor:pointer;font:13px Arial;";
      b.addEventListener("click", () => { sigKey = k; paint(); setGeom(); redraw(); TRACK.hit(host.id, "preset"); });
      bar1.appendChild(b); sigBtns.push(b);
    });
    function paint() {
      sigBtns.forEach(b => {
        const a = b.dataset.key === sigKey;
        b.style.background = a ? NAVY : "#fff";
        b.style.color = a ? "#fff" : NAVY;
      });
    }

    const bar2 = document.createElement("div");
    bar2.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:10px;font:14px Arial;color:" + INK;
    const dlab = document.createElement("span");
    dlab.style.cssText = "min-width:112px;";
    const dsl = document.createElement("input");
    dsl.type = "range"; dsl.min = 0; dsl.max = 1000; dsl.step = 1; dsl.value = 200;
    dsl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    const DMAX = 0.5, DMIN = 0.03;
    function setD() {
      const u = parseFloat(dsl.value) / 1000;
      D = Math.exp(Math.log(DMAX) + u * (Math.log(DMIN) - Math.log(DMAX)));
      dlab.textContent = "\u0394 = " + D.toFixed(3) + " ms";
      redraw();
    }
    dsl.addEventListener("input", function () { setD(); TRACK.hit(host.id, "slider"); });
    bar2.appendChild(dlab); bar2.appendChild(dsl); host.appendChild(bar2);

    paint(); setGeom(); setD();
  }

  // ========================================================================
  // Flip-and-slide convolution of a rectangular pulse with itself.
  //   2p_1 = width-1 pulse centred on the origin, i.e. on [-1/2, 1/2], height 2;
  //   (2p_1*2p_1)(t) = 2 * 2 * (overlap width) = 4 max(0, 1 - |t|).
  // Top panel: 2p_1(τ) fixed (navy) and the flipped, shifted copy 2p_1(t-τ) sliding
  // (brick), with their overlap hatched. The value is NOT the hatched area: it is
  // the integral of the product, so the two heights multiply. Bottom panel traces
  // the triangular result (2p_1*2p_1)(t) as t sweeps, with a dashed line linking the
  // pulse position t to the point it produces on the triangle.
  // ========================================================================
  function pulseconv() {
    const host = document.getElementById("w-conv"); if (!host) return;
    const W = 430, H = 356, cv = document.createElement("canvas");
    host.appendChild(cv); const ctx = dpiCanvas(cv, W, H);

    const padL = 40, padR = 14, plotW = W - padL - padR;
    const TMIN = -1.75, TMAX = 1.75;
    const xm = t => padL + (t - TMIN) / (TMAX - TMIN) * plotW;

    // panel baselines and the pixel height of one unit of amplitude
    const yTop = 128, hTop = 44;      // τ-axis (top);   value 1 sits hTop px above
    const yBot = 312, hBot = 19.5;    // t-axis (bottom); value 1 sits hBot px above
    const yTopV = v => yTop - v * hTop;
    const yBotV = v => yBot - v * hBot;

    const HALF = 0.5;                                   // pulse half-width
    const AMP  = 2;                                     // pulse height: these are 2p_1
    const width = t => Math.max(0, 1 - Math.abs(t));    // width of the overlap
    const conv  = t => AMP * AMP * width(t);            // = (2p_1 * 2p_1)(t)

    // diagonal hatch clipped to a rectangle, echoing the hand-drawn overlap
    function hatch(x0, x1, ytop, ybase, color) {
      const dh = ybase - ytop;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, ytop, x1 - x0, dh); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      for (let x = x0 - dh; x < x1; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, ybase); ctx.lineTo(x + dh, ytop); ctx.stroke();
      }
      ctx.restore();
    }
    function axis(y, lab) {
      ctx.strokeStyle = GREY; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL - 6, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = GREY; ctx.font = "12px Arial";
      [-1, 0, 1].forEach(t => {
        ctx.beginPath(); ctx.moveTo(xm(t), y - 3); ctx.lineTo(xm(t), y + 3); ctx.stroke();
        ctx.fillText(String(t), xm(t) - 3, y + 15);
      });
      if (lab) ctx.fillText(lab, padL + plotW - 6, y - 6);
    }
    function level(y, lab) {                 // amplitude mark on the left of a panel
      ctx.strokeStyle = GREY; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL - 9, y); ctx.lineTo(padL - 3, y); ctx.stroke();
      ctx.fillStyle = GREY; ctx.font = "12px Arial";
      ctx.fillText(lab, padL - 20, y + 4);
    }
    function box(x0, x1, stroke, fill) {
      const yt = yTopV(AMP);
      ctx.fillStyle = fill; ctx.fillRect(x0, yt, x1 - x0, yTop - yt);
      ctx.strokeStyle = stroke; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, yTop); ctx.lineTo(x0, yt); ctx.lineTo(x1, yt); ctx.lineTo(x1, yTop);
      ctx.stroke();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // legend
      ctx.font = "12px Arial";
      ctx.fillStyle = NAVY; ctx.fillRect(padL + 2, 11, 11, 11);
      ctx.fillStyle = INK;  ctx.fillText("2p\u2081(\u03C4)", padL + 18, 21);
      ctx.fillStyle = OUT;  ctx.fillRect(padL + 74, 11, 11, 11);
      ctx.fillStyle = INK;  ctx.fillText("2p\u2081(t\u2212\u03C4)", padL + 90, 21);
      ctx.fillStyle = "#555";
      ctx.fillText("hatched: the overlap, width 1\u2212|t|", padL + 176, 21);

      // top panel: fixed pulse, sliding flipped pulse, hatched overlap
      axis(yTop, "\u03C4");
      level(yTopV(AMP), "2");
      box(xm(-HALF), xm(HALF), NAVY, "rgba(0,70,140,0.07)");
      box(xm(t - HALF), xm(t + HALF), OUT, "rgba(192,57,43,0.06)");
      const oL = Math.max(-HALF, t - HALF), oR = Math.min(HALF, t + HALF);
      if (oR > oL) hatch(xm(oL), xm(oR), yTopV(AMP), yTop, "rgba(0,70,140,0.45)");

      // connector: the pulse position t maps to the point below
      ctx.strokeStyle = GREY; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xm(t), yTop + 4); ctx.lineTo(xm(t), yBotV(conv(t))); ctx.stroke();
      ctx.setLineDash([]);

      // bottom panel: full triangle guide, then the swept portion solid
      axis(yBot, "t");
      level(yBotV(conv(0)), "4");
      ctx.strokeStyle = "rgba(120,120,128,0.55)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xm(-1), yBotV(0)); ctx.lineTo(xm(0), yBotV(conv(0))); ctx.lineTo(xm(1), yBotV(0));
      ctx.stroke(); ctx.setLineDash([]);
      const ts = Math.max(-1, Math.min(1, t));
      ctx.strokeStyle = NAVY; ctx.lineWidth = 2.4; ctx.beginPath();
      ctx.moveTo(xm(-1), yBotV(0));
      for (let tt = -1; tt <= ts + 1e-9; tt += 0.02) ctx.lineTo(xm(tt), yBotV(conv(tt)));
      ctx.lineTo(xm(ts), yBotV(conv(ts)));
      ctx.stroke();
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.arc(xm(ts), yBotV(conv(ts)), 4.5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = NAVY; ctx.font = "13px Arial";
      ctx.fillText("(2p\u2081\u2217 2p\u2081)(t)", xm(0) + 8, yBotV(conv(0)) + 2);

      // readout
      ctx.fillStyle = "#555"; ctx.font = "12px Arial";
      ctx.fillText("t = " + t.toFixed(2) + "     value = 2 \u00D7 2 \u00D7 " + width(t).toFixed(2) +
                   " = " + conv(t).toFixed(2), padL + 4, yBot + 32);
    }

    // controls: play/pause (ping-pong sweep) + slider for t
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:10px;font:14px Arial;color:" + INK;
    const btn = document.createElement("button");
    btn.textContent = "\u25B6 play";
    btn.style.cssText = "border:1px solid " + NAVY + ";color:" + NAVY +
      ";background:#fff;border-radius:5px;padding:3px 12px;cursor:pointer;font:14px Arial;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = -1.2; sl.max = 1.2; sl.step = 0.005; sl.value = 0.5;
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    bar.appendChild(btn); bar.appendChild(sl); host.appendChild(bar);
    sl.addEventListener("input", () => { draw(parseFloat(sl.value)); TRACK.hit(host.id, "slider"); });

    let raf = null, last = 0, dir = 1;
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; btn.textContent = "\u25B6 play"; } }
    btn.addEventListener("click", () => {
      TRACK.hit(host.id, "play");
      if (raf) { stop(); return; }
      btn.textContent = "\u2759\u2759 pause"; last = performance.now();
      (function frame(now) {
        let t = parseFloat(sl.value) + dir * (now - last) / 1000 * 0.9; last = now;
        if (t > 1.2) { t = 1.2; dir = -1; } else if (t < -1.2) { t = -1.2; dir = 1; }
        sl.value = t; draw(t);
        raf = requestAnimationFrame(frame);
      })(last);
    });

    draw(parseFloat(sl.value));
  }

  function init() { comb(); pulseconv(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
