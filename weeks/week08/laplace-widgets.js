/* ELEC2302 — Laplace transform interactive canvas widget
   House style: navy #00468C primary (signal), brick #C0392B secondary
   (reconstruction), thin guides. Self-contained, guarded by container id.
   Pure vanilla JS + canvas, no dependencies.

   w-growing — an unstable signal expanded in growing sinusoids.
     Bilateral Laplace transform along the line Re s = sigma, sigma in the ROC:
       U(sigma + j w) = int u(t) e^{-sigma t} e^{-j w t} dt
       u(t) = e^{sigma t} (1/2 pi) int U(sigma + j w) e^{j w t} dw
     The inversion integral is truncated to |w| <= N dw and discretised on
     w_k = k dw, k = -N..N, so the reconstruction is the sum of 2N+1 terms
       u_N(t) = e^{sigma t} (dw/2 pi) sum_k U(sigma + j w_k) e^{j w_k t}
     The discretisation periodises the weighted signal u(t) e^{-sigma t}
     with period 2 pi / dw, so dw is kept small.

   The signal has amplitude C = 4 and grows like e^{a t} with a = 0.5:
     u(t) = C e^{a t} H(t)                        U(s) = C/(s - a),   ROC Re s > a
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", ENV = "#b0b0b0", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week8-<name>  (e.g.
  //   widget-week8-growing). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week8-growing is
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
    const WEEK = "week8";                      // namespaces events across weeks
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

  function dpiCanvas(cv, w, h) {
    const r = window.devicePixelRatio || 1;
    cv.width = w * r; cv.height = h * r;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return ctx;
  }

  (function () {
    const host = document.getElementById("w-growing"); if (!host) return;

    const W = 720, HB = 170, HW = 200, HR = 240;
    const A = 0.5;                     // growth rate of the signal
    const C = 4;                       // amplitude, so the jump at the origin is C
    const TMIN = -3, TMAX = 4;         // time window plotted
    const DW = 0.05;                   // frequency grid spacing, rad/s
    let sigma = 1.0;                   // Re s of the inversion line
    let N = 40;                        // frequencies k = -N..N on the line

    // ---- signal and transform --------------------------------------------
    function u(t) { return t >= 0 ? C * Math.exp(A * t) : 0; }
    // U(sigma + j w), returned as [re, im]
    function U(w) {
      const pr = sigma - A, pi = w;                  // p = s - a, U = C/p
      const d = pr * pr + pi * pi;
      return [C * pr / d, -C * pi / d];
    }
    // coefficients of the 2N+1 terms, recomputed when sigma or N change
    let coef = [];
    function computeCoef() {
      coef = [];
      for (let k = 0; k <= N; k++) coef.push(U(k * DW));
    }
    // u_N(t) = e^{sigma t} (dw/2pi) [ U(sigma) + 2 sum_{k>=1} Re(U(sigma+jw_k) e^{j w_k t}) ]
    function uN(t) {
      let s = coef[0][0];
      for (let k = 1; k <= N; k++) {
        const w = k * DW;
        s += 2 * (coef[k][0] * Math.cos(w * t) - coef[k][1] * Math.sin(w * t));
      }
      return Math.exp(sigma * t) * s * DW / (2 * Math.PI);
    }
    // weighted signal and its truncation, w(t) = u(t) e^{-sigma t}
    function w(t) { return u(t) * Math.exp(-sigma * t); }
    function wN(t) { return uN(t) * Math.exp(-sigma * t); }

    // ---- canvases ----------------------------------------------------------
    const cb = document.createElement("canvas"), cw = document.createElement("canvas"),
          cr = document.createElement("canvas");
    [cb, cw, cr].forEach(function (c) {
      const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    });
    const gb = dpiCanvas(cb, W, HB), gw = dpiCanvas(cw, W, HW), gr = dpiCanvas(cr, W, HR);

    const PAD = 44;
    const tx = t => PAD + (t - TMIN) * (W - 2 * PAD) / (TMAX - TMIN);

    // basis panel: y in [-YB, YB]
    const YB = 40, bcy = HB / 2 - 4;
    const by = v => bcy - v * (HB / 2 - 14) / YB;
    // weighted panel: y in [-0.25 YW, YW], YW set from the peak of u(t)e^{-sigma t}
    let YW = 1;
    function setYW() {
      let m = 0;
      for (let i = 0; i <= 400; i++) {
        const t = TMIN + i * (TMAX - TMIN) / 400;
        m = Math.max(m, Math.abs(u(t) * Math.exp(-sigma * t)));
      }
      YW = m > 0 ? m * 1.15 : 1;
    }
    const wcy0 = HW - 42;
    const wy = v => wcy0 - (v + 0.25 * YW) * (HW - 30) / (1.25 * YW);
    // reconstruction panel: y in [YRMIN, YRMAX]
    const YRMIN = -9, YRMAX = 34, rcy0 = HR - 30;
    const ry = v => rcy0 - (v - YRMIN) * (HR - 44) / (YRMAX - YRMIN);

    function axes(g, H, cy, yLabel) {
      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(PAD - 12, cy); g.lineTo(W - PAD + 12, cy); g.stroke();
      g.beginPath(); g.moveTo(tx(0), 8); g.lineTo(tx(0), H - 8); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("t", W - PAD + 16, cy - 5);
      g.font = "12px Arial"; g.textAlign = "center";
      for (let t = TMIN; t <= TMAX; t++) {
        if (t === 0) continue;
        g.beginPath(); g.moveTo(tx(t), cy - 3); g.lineTo(tx(t), cy + 3); g.stroke();
        g.fillText(String(t), tx(t), cy + 15);
      }
      g.textAlign = "left";
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText(yLabel, PAD - 40, 16);
    }

    // polyline of f over the window, clipped to the panel
    function curve(g, f, ymap, H, color, width, dash) {
      g.save();
      g.beginPath(); g.rect(PAD - 12, 0, W - 2 * PAD + 24, H); g.clip();
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []);
      g.beginPath();
      const n = W - 2 * PAD;
      for (let px = 0; px <= n; px++) {
        const t = TMIN + px * (TMAX - TMIN) / n;
        const Y = ymap(f(t));
        if (px === 0) g.moveTo(tx(t), Y); else g.lineTo(tx(t), Y);
      }
      g.stroke();
      g.restore();
    }

    function drawBasis() {
      const g = gb;
      g.clearRect(0, 0, W, HB);
      axes(g, HB, bcy, "");
      // envelope e^{sigma t}
      curve(g, t => Math.exp(sigma * t), by, HB, ENV, 1.2, [4, 4]);
      curve(g, t => -Math.exp(sigma * t), by, HB, ENV, 1.2, [4, 4]);
      // three of the terms in the sum: k = 20, 60, 120 i.e. omega = 1, 3, 6
      const ks = [20, 60, 120], cols = [NAVY, "#3f7fc0", "#8fb3dc"];
      ks.forEach(function (k, i) {
        if (k > N) return;
        curve(g, t => Math.exp(sigma * t) * Math.cos(k * DW * t), by, HB, cols[i], 1.3);
      });
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText("e^{σt} cos(ωt),  ω = 1, 3, 6 rad/s", PAD - 2, 16);
      g.fillStyle = ENV;
      g.fillText("± e^{σt}", tx(3.2), by(Math.exp(sigma * 3.2)) - 6);
    }

    function drawWeighted() {
      const g = gw;
      g.clearRect(0, 0, W, HW);
      const step = YW > 4 ? 2 : (YW > 1.6 ? 1 : (YW > 0.6 ? 0.5 : 0.2));
      g.strokeStyle = GRID; g.lineWidth = 1;
      for (let v = step; v <= YW; v += step) {
        g.beginPath(); g.moveTo(PAD, wy(v)); g.lineTo(W - PAD, wy(v)); g.stroke();
        g.fillStyle = GREY; g.font = "11px Arial"; g.textAlign = "right";
        g.fillText(step < 1 ? v.toFixed(1) : String(v), PAD - 6, wy(v) + 4);
        g.textAlign = "left";
      }
      axes(g, HW, wy(0), "");
      curve(g, w, wy, HW, NAVY, 2.4);
      curve(g, wN, wy, HW, OUT, 1.5);
      g.fillStyle = NAVY; g.font = "13px Arial";
      g.fillText("u(t)e^{−σt}", PAD - 2, 16);
      g.fillStyle = OUT;
      g.fillText("truncated Fourier sum, |ω| ≤ NΔω", PAD + 80, 16);
    }

    function drawRecon() {
      const g = gr;
      g.clearRect(0, 0, W, HR);
      // guide at u = 0 already the axis; add faint grid at u = 10, 20
      g.strokeStyle = GRID; g.lineWidth = 1;
      [10, 20, 30].forEach(function (v) {
        g.beginPath(); g.moveTo(PAD, ry(v)); g.lineTo(W - PAD, ry(v)); g.stroke();
        g.fillStyle = GREY; g.font = "11px Arial"; g.textAlign = "right";
        g.fillText(String(v), PAD - 6, ry(v) + 4); g.textAlign = "left";
      });
      axes(g, HR, ry(0), "");
      curve(g, u, ry, HR, NAVY, 2.4);
      curve(g, uN, ry, HR, OUT, 1.5);
      g.fillStyle = NAVY; g.font = "13px Arial";
      g.fillText("u(t)", PAD - 2, 16);
      g.fillStyle = OUT;
      g.fillText("u_N(t), 2N+1 terms on Re s = σ", PAD + 40, 16);
    }

    // ---- controls -----------------------------------------------------------
    function sliderRow(min, max, step, val) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
      const lab = document.createElement("span");
      lab.style.cssText = "min-width:150px;font-variant-numeric:tabular-nums;";
      const sl = document.createElement("input");
      sl.type = "range"; sl.min = String(min); sl.max = String(max);
      sl.step = String(step); sl.value = String(val);
      sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
      row.appendChild(lab); row.appendChild(sl);
      host.appendChild(row);
      return { lab: lab, sl: sl };
    }
    const rs = sliderRow(0.6, 3, 0.05, sigma);
    const rn = sliderRow(1, 200, 1, N);

    const note = document.createElement("div");
    note.style.cssText = "margin-top:6px;font:13px Arial;color:#555;min-height:19px;";
    host.appendChild(note);

    function draw() {
      computeCoef();
      rs.lab.textContent = "σ = " + sigma.toFixed(2);
      rn.lab.textContent = "N = " + N + "  (" + (2 * N + 1) + " terms)";
      note.textContent =
        "|ω| ≤ " + (N * DW).toFixed(2) + " rad/s, spacing Δω = " + DW +
        ".  ROC: Re s > 0.5" +
        ".  Weighted signal u(t)e^{−σt} decays like e^{−" + (sigma - A).toFixed(2) + "t} for t > 0.";
      setYW(); drawBasis(); drawWeighted(); drawRecon();
    }
    rs.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); sigma = parseFloat(rs.sl.value); draw(); });
    rn.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); N = parseInt(rn.sl.value, 10); draw(); });

    draw();
  })();
})();
