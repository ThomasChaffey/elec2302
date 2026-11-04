/* ELEC2302 Lecture 12 — interactive canvas widgets (website copy, with usage tracking)
   The "new noise" button is tracked as kind "preset".
   House style: navy #00468C primary (input u), brick #C0392B secondary (output y),
   thin guides. Self-contained, guarded by container id. Vanilla JS + canvas only.

   (a) w-avg — measuring G(jw) at one frequency from a noisy output.
         System G(s) = 8/(s^2 + 2s + 4) (example 1), w = 2 rad/s, so G(j2) = -2j.
         Input u(t) = cos(2t). Steady-state output 2 cos(2t - pi/2) = 2 sin(2t), plus independent
         noise samples of standard deviation sigma.
         c = (1/T) int_0^T y(t) e^{-jwt} dt over T = N periods, from samples at dt = period/20
         (rectangle rule). The noisy trace joins the samples; the curves use a 10x finer grid.
         For u = cos(wt), c = G(jw)/2, so the estimate of G(jw) is 2c, and
         yhat(t) = c e^{jwt} + conj(c) e^{-jwt} = 2 Re(c e^{jwt}).
         The averaging window [0, NT] is shaded; yhat is drawn over the whole axis.
         Noise comes from a seeded generator, so the initial state is the same on every load.
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a", GRID = "#e8e8ec", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week12-<name>  (e.g.
  //   widget-week12-avg). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week12-avg is
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
    const WEEK = "week12";                      // namespaces events across weeks
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

  // Seeded generator (mulberry32), so every reader, and the PDF snapshot, starts from the
  // same noise. "new noise" draws the next stretch of the same sequence.
  let seed = 20261025;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss() {                        // Box–Muller
    let a = 0, b = 0;
    while (a === 0) a = rand();
    while (b === 0) b = rand();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }

  // ========================================================================
  // (a) averaging a noisy sinusoid
  // ========================================================================
  (function () {
    const host = document.getElementById("w-avg"); if (!host) return;

    const W = 720, H = 260;
    const WF = 2, P = Math.PI;               // frequency (rad/s) and period (s)
    const NMAX = 12, SPP = 20;               // periods on the axis, samples per period
    const NS = NMAX * SPP, DT = P / SPP;
    let N = 1, sigma = 2.0;
    let noise = new Float64Array(NS);
    function redraw() { for (let i = 0; i < NS; i++) noise[i] = gauss(); }
    redraw();

    const cv = document.createElement("canvas");
    const d0 = document.createElement("div"); d0.appendChild(cv); host.appendChild(d0);
    const g = dpiCanvas(cv, W, H);

    // controls
    const ctl = document.createElement("div");
    ctl.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:6px 0 2px 0;font:14px Arial,Helvetica,sans-serif;color:" + INK;
    ctl.innerHTML =
      '<label>periods averaged, N = <span data-k="nv">1</span> ' +
      '<input data-k="n" type="range" min="1" max="' + NMAX + '" step="1" value="1" style="vertical-align:middle;width:150px"></label>' +
      '<label>noise &sigma; = <span data-k="sv">2.0</span> ' +
      '<input data-k="s" type="range" min="0" max="3" step="0.1" value="2" style="vertical-align:middle;width:120px"></label>' +
      '<button data-k="b" type="button">new noise</button>';
    host.appendChild(ctl);
    const out = document.createElement("div");
    out.style.cssText = "font:14px Arial,Helvetica,sans-serif;color:" + INK + ";margin:2px 0 4px 0";
    host.appendChild(out);
    const q = k => ctl.querySelector('[data-k="' + k + '"]');

    const PADL = 46, PADR = 16, Y0 = H / 2 - 8, AMP = 15;     // 15 px per unit
    const tx = t => PADL + t * (W - PADL - PADR) / (NMAX * P);
    const ty = y => Y0 - AMP * y;

    function sample(i) { const t = i * DT; return 2 * Math.sin(WF * t) + sigma * noise[i]; }

    function draw() {
      // estimate over the first N periods
      const M = N * SPP;
      let re = 0, im = 0;
      for (let i = 0; i < M; i++) {
        const t = i * DT, y = sample(i);
        re += y * Math.cos(WF * t); im -= y * Math.sin(WF * t);
      }
      re /= M; im /= M;                       // c = (1/T) sum y e^{-jwt} dt

      g.clearRect(0, 0, W, H);
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
      // averaging window
      g.fillStyle = "rgba(0,70,140,0.07)";
      g.fillRect(tx(0), 8, tx(N * P) - tx(0), H - 40);
      // grid and axes
      g.strokeStyle = GRID; g.lineWidth = 1;
      for (let v = -6; v <= 6; v += 2) { g.beginPath(); g.moveTo(PADL, ty(v)); g.lineTo(W - PADR, ty(v)); g.stroke(); }
      g.strokeStyle = GREY; g.beginPath(); g.moveTo(PADL, ty(0)); g.lineTo(W - PADR, ty(0)); g.stroke();
      g.beginPath(); g.moveTo(PADL, 8); g.lineTo(PADL, H - 32); g.stroke();
      g.fillStyle = INK; g.font = "12px Arial, Helvetica, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle";
      for (let v = -6; v <= 6; v += 2) g.fillText(String(v), PADL - 6, ty(v));
      g.textAlign = "center"; g.textBaseline = "top";
      for (let k = 0; k <= NMAX; k += 2) g.fillText(k === 0 ? "0" : k + "T₀", tx(k * P), H - 28);
      g.textAlign = "left"; g.fillText("t", W - PADR - 6, ty(0) + 4);

      g.save(); g.beginPath(); g.rect(PADL, 8, W - PADL - PADR, H - 40); g.clip();
      // noisy output
      g.strokeStyle = "rgba(192,57,43,0.35)"; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < NS; i++) { const X = tx(i * DT), Y = ty(sample(i)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke();
      // filtered output yhat = 2 Re(c e^{jwt})
      g.strokeStyle = OUT; g.lineWidth = 2.2;
      g.beginPath();
      for (let i = 0; i <= 10 * NS; i++) {
        const t = i * DT / 10, X = tx(t), Y = ty(2 * (re * Math.cos(WF * t) - im * Math.sin(WF * t)));
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.stroke();
      // true steady-state output
      g.strokeStyle = "#444"; g.lineWidth = 1.2; g.setLineDash([5, 4]);
      g.beginPath();
      for (let i = 0; i <= 10 * NS; i++) { const t = i * DT / 10, X = tx(t), Y = ty(2 * Math.sin(WF * t)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke(); g.setLineDash([]);
      g.restore();
      // legend
      g.font = "12px Arial, Helvetica, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
      const lx = W - 300, ly = 18;
      g.strokeStyle = "rgba(192,57,43,0.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 18, ly); g.stroke();
      g.fillStyle = INK; g.fillText("y(t), measured", lx + 22, ly);
      g.strokeStyle = OUT; g.lineWidth = 2.2; g.beginPath(); g.moveTo(lx + 120, ly); g.lineTo(lx + 138, ly); g.stroke();
      g.fillText("ŷ(t)", lx + 142, ly);
      g.strokeStyle = "#444"; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(lx + 185, ly); g.lineTo(lx + 203, ly); g.stroke(); g.setLineDash([]);
      g.fillText("noise-free", lx + 207, ly);

      const gm = 2 * Math.hypot(re, im), ph = Math.atan2(im, re) * 180 / Math.PI;
      out.innerHTML = "estimate 2c = " + (2 * re).toFixed(3) + (im < 0 ? " − " : " + ") + Math.abs(2 * im).toFixed(3) + "j: " +
        "&nbsp;|G(j2)| ≈ " + gm.toFixed(3) + ", &nbsp;∠G(j2) ≈ " + ph.toFixed(1) + "°" +
        " &nbsp;&nbsp;<span style='color:" + GREY + "'>(true: −2j, gain 2, phase −90°; T₀ = π s)</span>";
    }

    q("n").addEventListener("input", function () { TRACK.hit(host.id, "slider"); N = +this.value; q("nv").textContent = N; draw(); });
    q("s").addEventListener("input", function () { TRACK.hit(host.id, "slider"); sigma = +this.value; q("sv").textContent = sigma.toFixed(1); draw(); });
    q("b").addEventListener("click", function () { TRACK.hit(host.id, "preset"); redraw(); draw(); });
    draw();
  })();
})();
