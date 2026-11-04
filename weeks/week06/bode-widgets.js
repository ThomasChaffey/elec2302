/* ELEC2302 Lecture 6 — interactive canvas widgets
   House style: navy #00468C primary (input / time domain), brick #C0392B secondary
   (output / marked quantity), thin guides. Self-contained, guarded by container id.
   Pure vanilla JS + canvas, no dependencies.

   (a) w-pulse-rlc — the shifted pulse driven through the RLC transfer function,
       inverse Fourier transformed numerically. This is the "insert script here" step.
         u(t) = p_tau(t - tau/2)   <->   U(j omega) = e^{-j omega tau/2} tau sinc(omega tau / 2 pi)
         G(j omega) = 25 / ((j omega)^2 + 6 j omega + 25)
         Y = G U,   y(t) = (1/2 pi) int Y(j omega) e^{j omega t} d omega
       y is real, so the integral is evaluated as (1/pi) int_0^inf Re{Y e^{j omega t}} d omega
       on a midpoint grid, omega up to 120 rad/s in steps of 0.04. Checked against the
       exact step-response difference s(t) - s(t - tau), s the step response of G:
       worst-case error 2e-4 over tau in [0.1, 4].

   (b) w-bode-probe — one frequency at a time on the Bode diagram of the same G.
       A sinusoid e^{j omega_0 t} in gives G(j omega_0) e^{j omega_0 t} out, so the
       magnitude plot is the output amplitude and the phase plot is the output shift.
       The marker on each plot is the number used to draw the output sinusoid below.

   (c) w-resonant-peak — the height of the resonant peak against the damping ratio.
         G(j omega) = omega_n^2 / ((j omega)^2 + 2 zeta omega_n (j omega) + omega_n^2)
       Peak at omega_r = omega_n sqrt(1 - 2 zeta^2), of height 1/(2 zeta sqrt(1 - zeta^2)),
       and it exists only while zeta < 1/sqrt(2).
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", GHOST = "#c9c9d2", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week6-<name>  (e.g.
  //   widget-week6-pulse-rlc). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week6-pulse-rlc is
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
    const WEEK = "week6";                      // namespaces events across weeks
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
  // normalised sinc, matching the Lecture 4 definition sinc(x) = sin(pi x)/(pi x)
  function sincn(x) {
    if (Math.abs(x) < 1e-12) return 1;
    const a = Math.PI * x;
    return Math.sin(a) / a;
  }
  function panel(host, W, H) {
    const c = document.createElement("canvas");
    const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    return dpiCanvas(c, W, H);
  }
  function slider(host, min, max, step, val, minWidth) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const lab = document.createElement("span");
    lab.style.cssText = "min-width:" + minWidth + "px;font-variant-numeric:tabular-nums;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = String(min); sl.max = String(max);
    sl.step = String(step); sl.value = String(val);
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    row.appendChild(lab); row.appendChild(sl); host.appendChild(row);
    return { lab: lab, sl: sl };
  }
  function noteBox(host) {
    const n = document.createElement("div");
    n.style.cssText = "margin-top:6px;font:13px Arial;color:#555;min-height:19px;";
    host.appendChild(n); return n;
  }
  function axis(g, x0, x1, y, label) {                 // horizontal axis with arrow
    g.strokeStyle = GREY; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 - 6, y - 3.2); g.lineTo(x1 - 6, y + 3.2);
    g.closePath(); g.fillStyle = GREY; g.fill();
    if (label) { g.font = "13px Arial"; g.fillText(label, x1 + 5, y - 5); }
  }
  // typographic minus, so "-14" never renders with a hyphen
  function num(x, dp) { return x.toFixed(dp).replace("-", "\u2212"); }
  // the RLC transfer function of the lecture, G(j omega) = 25/((j omega)^2 + 6 j omega + 25)
  function Grlc(w) {
    const re = 25 - w * w, im = 6 * w, d = re * re + im * im;
    return { re: 25 * re / d, im: -25 * im / d };
  }

  // ========================================================================
  // (a) pulse in, RLC out: the inverse Fourier transform done numerically
  // ========================================================================
  (function () {
    const host = document.getElementById("w-pulse-rlc"); if (!host) return;

    const W = 720, HU = 140, HY = 196;
    const TMIN = -0.6, TMAX = 8.0;        // seconds
    const WMAX = 120, DW = 0.04;          // integration grid, rad/s
    let tau = 1.5;

    const gu = panel(host, W, HU), gy = panel(host, W, HY);

    const PAD = 46;
    const tx = t => PAD + (t - TMIN) * (W - 2 * PAD) / (TMAX - TMIN);
    const ucy = 108, UH = 56;              // input panel: baseline and pulse height
    const ycy = 138, YS = 84;             // output panel: baseline and pixels per unit

    // integration grid, built once
    const NW = Math.round(WMAX / DW);
    const wg = new Float64Array(NW), Gre = new Float64Array(NW), Gim = new Float64Array(NW);
    for (let i = 0; i < NW; i++) {
      const w = (i + 0.5) * DW; wg[i] = w;
      const G = Grlc(w); Gre[i] = G.re; Gim[i] = G.im;
    }

    // y(t) for the current tau, on the pixel grid of the plot
    function outputTrace() {
      const N = W - 2 * PAD;
      const Yre = new Float64Array(NW), Yim = new Float64Array(NW);
      for (let i = 0; i < NW; i++) {
        const w = wg[i];
        const m = tau * sincn(w * tau / (2 * Math.PI));   // pulse magnitude
        const p = -w * tau / 2;                            // pulse phase (the shift)
        const cr = m * Math.cos(p), ci = m * Math.sin(p);
        Yre[i] = Gre[i] * cr - Gim[i] * ci;
        Yim[i] = Gre[i] * ci + Gim[i] * cr;
      }
      const ys = new Float64Array(N + 1);
      for (let px = 0; px <= N; px++) {
        const t = TMIN + px * (TMAX - TMIN) / N;
        let s = 0;
        for (let i = 0; i < NW; i++) {
          const a = wg[i] * t;
          s += Yre[i] * Math.cos(a) - Yim[i] * Math.sin(a);
        }
        ys[px] = s * DW / Math.PI;
      }
      return ys;
    }

    function drawInput() {
      const g = gu;
      g.clearRect(0, 0, W, HU);
      axis(g, PAD - 14, W - PAD + 14, ucy, "t");
      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(tx(0), ucy - UH - 16); g.lineTo(tx(0), ucy + 8); g.stroke();

      const xl = tx(0), xr = tx(Math.min(tau, TMAX));
      g.fillStyle = "rgba(0,70,140,0.13)";
      g.fillRect(xl, ucy - UH, xr - xl, UH);
      g.strokeStyle = NAVY; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(tx(TMIN), ucy); g.lineTo(xl, ucy); g.lineTo(xl, ucy - UH);
      g.lineTo(xr, ucy - UH); g.lineTo(xr, ucy); g.lineTo(tx(TMAX), ucy);
      g.stroke();

      // the width marker
      g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xl, ucy - UH - 9); g.lineTo(xr, ucy - UH - 9); g.stroke();
      g.font = "12px Arial"; g.textAlign = "center";
      g.fillText("τ", (xl + xr) / 2, ucy - UH - 13);
      g.textAlign = "left";

      const LX = W - PAD - 132;
      g.fillStyle = NAVY; g.font = "13px Arial";
      g.fillText("u(t) = p", LX, ucy - UH - 8);
      g.font = "10px Arial"; g.fillText("τ", LX + 47, ucy - UH - 4);
      g.font = "13px Arial"; g.fillText("(t − τ/2)", LX + 53, ucy - UH - 8);
      g.fillStyle = GREY; g.font = "12px Arial";
      g.fillText("1", tx(0) - 12, ucy - UH + 5);
    }

    function drawOutput(ys) {
      const g = gy;
      g.clearRect(0, 0, W, HY);

      // unit guide, so the overshoot above 1 is visible
      g.strokeStyle = GRID; g.lineWidth = 1;
      g.beginPath(); g.moveTo(PAD, ycy - YS); g.lineTo(W - PAD, ycy - YS); g.stroke();
      g.fillStyle = GREY; g.font = "12px Arial";
      g.fillText("1", PAD - 14, ycy - YS + 4);

      axis(g, PAD - 14, W - PAD + 14, ycy, "t");
      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(tx(0), ycy - YS - 20); g.lineTo(tx(0), ycy + 34); g.stroke();

      g.strokeStyle = OUT; g.lineWidth = 1.9;
      g.beginPath();
      for (let px = 0; px < ys.length; px++) {
        const X = PAD + px, Y = ycy - ys[px] * YS;
        if (px === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();

      g.fillStyle = OUT; g.font = "13px Arial";
      g.fillText("y(t), the inverse Fourier transform of Y(jω) = G(jω)U(jω)",
                 PAD, ycy - YS - 30);

      // second ticks
      g.strokeStyle = GREY; g.fillStyle = GREY; g.font = "12px Arial";
      g.textAlign = "center";
      for (let s = 0; s <= 8; s += 2) {
        if (s === 0) continue;
        g.beginPath(); g.moveTo(tx(s), ycy - 3); g.lineTo(tx(s), ycy + 3); g.stroke();
        g.fillText(String(s), tx(s), ycy + 17);
      }
      g.textAlign = "left";
    }

    const ctl = slider(host, 0.1, 4, 0.05, tau, 66);
    const note = noteBox(host);

    function draw() {
      ctl.lab.textContent = "τ = " + tau.toFixed(2) + " s";
      drawInput();
      const ys = outputTrace();
      drawOutput(ys);
      let peak = 0, at = 0;
      for (let px = 0; px < ys.length; px++) {
        if (ys[px] > peak) { peak = ys[px]; at = TMIN + px * (TMAX - TMIN) / (W - 2 * PAD); }
      }
      note.textContent =
        "peak output " + peak.toFixed(3) + " at t = " + at.toFixed(2) + " s.  " +
        "The circuit rings at ωₙ = 5 rad/s, one cycle every 2π/5 ≈ 1.26 s: a pulse much " +
        "shorter than that never reaches 1, a pulse much longer settles at 1 before the trailing edge.";
    }
    ctl.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); tau = parseFloat(ctl.sl.value); draw(); });
    draw();
  })();

  // ========================================================================
  // (b) reading gain and phase off the Bode diagram, one frequency at a time
  // ========================================================================
  (function () {
    const host = document.getElementById("w-bode-probe"); if (!host) return;

    const W = 720, HM = 162, HP = 162, HT = 190;
    const WLO = -2, WHI = 2;              // decades, log10 rad/s
    const DBLO = -60, DBHI = 10;
    let lw = Math.log10(1.0);             // marker frequency, log10 rad/s
    let playing = false, t0 = 0, raf = null;

    const gm = panel(host, W, HM), gp = panel(host, W, HP), gt = panel(host, W, HT);

    const PAD = 58, RPAD = 26;
    const bx = l => PAD + (l - WLO) * (W - PAD - RPAD) / (WHI - WLO);
    const TOPY = 32;                                       // strip above for the y-label
    const my = db => TOPY + (DBHI - db) * (HM - TOPY - 24) / (DBHI - DBLO);
    const py = ph => TOPY + (0 - ph) * (HP - TOPY - 24) / 200;   // 0 down to -200 degrees

    function gridLog(g, H, ylab) {
      g.strokeStyle = GRID; g.lineWidth = 1;
      for (let d = WLO; d <= WHI; d++) {
        for (let k = 1; k <= 9; k++) {
          const l = d + Math.log10(k);
          if (l < WLO || l > WHI) continue;
          g.beginPath(); g.moveTo(bx(l), TOPY); g.lineTo(bx(l), H - 24); g.stroke();
        }
      }
      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(PAD, H - 24); g.lineTo(W - RPAD, H - 24); g.stroke();
      g.beginPath(); g.moveTo(PAD, TOPY); g.lineTo(PAD, H - 24); g.stroke();
      g.fillStyle = GREY; g.font = "12px Arial"; g.textAlign = "center";
      for (let d = WLO; d <= WHI; d++) g.fillText("10" + ["⁻²","⁻¹","⁰","¹","²"][d - WLO], bx(d), H - 8);
      g.textAlign = "left";
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText(ylab, 6, 18);
    }

    function drawMag() {
      const g = gm; g.clearRect(0, 0, W, HM);
      gridLog(g, HM, "|G(jω)| (dB)");
      g.strokeStyle = NAVY; g.lineWidth = 1.9; g.beginPath();
      for (let px = 0; px <= W - PAD - RPAD; px++) {
        const l = WLO + px * (WHI - WLO) / (W - PAD - RPAD);
        const G = Grlc(Math.pow(10, l));
        const db = 20 * Math.log10(Math.hypot(G.re, G.im));
        const X = PAD + px, Y = my(Math.max(db, DBLO));
        if (px === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
      // 0 dB reference
      g.strokeStyle = "#d8d8de"; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(PAD, my(0)); g.lineTo(W - RPAD, my(0)); g.stroke();
      g.setLineDash([]);
      g.fillStyle = GREY; g.font = "12px Arial"; g.textAlign = "right";
      g.fillText("0 dB", PAD - 6, my(0) + 4);
      g.fillText("\u221240", PAD - 6, my(-40) + 4);
      g.textAlign = "left";

      const G = Grlc(Math.pow(10, lw));
      const db = 20 * Math.log10(Math.hypot(G.re, G.im));
      g.strokeStyle = OUT; g.lineWidth = 1.2; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(bx(lw), TOPY); g.lineTo(bx(lw), HM - 24); g.stroke();
      g.setLineDash([]);
      g.fillStyle = OUT;
      g.beginPath(); g.arc(bx(lw), my(Math.max(db, DBLO)), 4, 0, 2 * Math.PI); g.fill();
      g.font = "12px Arial";
      g.fillText(num(db, 1) + " dB", bx(lw) + 8, my(Math.max(db, DBLO)) - 7);
    }

    function drawPhase() {
      const g = gp; g.clearRect(0, 0, W, HP);
      gridLog(g, HP, "∠G(jω)");
      g.strokeStyle = NAVY; g.lineWidth = 1.9; g.beginPath();
      for (let px = 0; px <= W - PAD - RPAD; px++) {
        const l = WLO + px * (WHI - WLO) / (W - PAD - RPAD);
        const G = Grlc(Math.pow(10, l));
        const ph = Math.atan2(G.im, G.re) * 180 / Math.PI;
        const X = PAD + px, Y = py(ph);
        if (px === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
      g.fillStyle = GREY; g.font = "12px Arial"; g.textAlign = "right";
      [0, -90, -180].forEach(function (v) { g.fillText(num(v, 0) + "°", PAD - 6, py(v) + 4); });
      g.textAlign = "left";

      const G = Grlc(Math.pow(10, lw));
      const ph = Math.atan2(G.im, G.re) * 180 / Math.PI;
      g.strokeStyle = OUT; g.lineWidth = 1.2; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(bx(lw), TOPY); g.lineTo(bx(lw), HP - 24); g.stroke();
      g.setLineDash([]);
      g.fillStyle = OUT;
      g.beginPath(); g.arc(bx(lw), py(ph), 4, 0, 2 * Math.PI); g.fill();
      g.font = "12px Arial";
      g.fillText(num(ph, 0) + "°", bx(lw) + 8, py(ph) - 7);
    }

    // time panel: five periods of the marker frequency, input and output overlaid
    function drawTime(now) {
      const g = gt; g.clearRect(0, 0, W, HT);
      const w0 = Math.pow(10, lw);
      const G = Grlc(w0);
      const gain = Math.hypot(G.re, G.im), ph = Math.atan2(G.im, G.re);
      const T = 2 * Math.PI / w0, span = 3 * T;
      const cy = 96, AMP = 52;
      const px2t = px => px * span / (W - 2 * PAD);

      axis(g, PAD - 14, W - PAD + 14, cy, "t");
      g.strokeStyle = GRID; g.lineWidth = 1;
      [1, -1].forEach(function (s) {
        g.beginPath(); g.moveTo(PAD, cy - s * AMP); g.lineTo(W - PAD, cy - s * AMP); g.stroke();
      });

      const shift = playing ? (now - t0) / 1000 : 0;
      const N = W - 2 * PAD;
      [[NAVY, 1, 0, 1.8], [OUT, gain, ph, 1.9]].forEach(function (tr) {
        g.strokeStyle = tr[0]; g.lineWidth = tr[3]; g.beginPath();
        for (let px = 0; px <= N; px++) {
          const t = px2t(px) + shift;
          const v = tr[1] * Math.cos(w0 * t + tr[2]);
          const X = PAD + px, Y = cy - v * AMP;
          if (px === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
        }
        g.stroke();
      });

      g.font = "13px Arial";
      g.fillStyle = NAVY; g.fillText("u(t) = cos(ω₀t)", PAD, cy - AMP - 22);
      g.fillStyle = OUT;
      g.fillText("y(t) = |G(jω₀)| cos(ω₀t + ∠G(jω₀))", PAD + 150, cy - AMP - 22);
      g.fillStyle = GREY; g.font = "12px Arial";
      g.fillText("three periods of ω₀", W - PAD - 118, cy + AMP + 30);
    }

    // ---- controls -----------------------------------------------------------
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:10px;font:13px Arial;color:" + INK;
    const play = document.createElement("button");
    play.textContent = "▶ Play";
    play.style.cssText = "border:1px solid " + NAVY + ";background:#fff;color:" + NAVY +
      ";border-radius:5px;padding:3px 12px;cursor:pointer;font:13px Arial;";
    bar.appendChild(play); host.appendChild(bar);

    const ctl = slider(host, WLO, WHI, 0.01, lw, 112);
    const note = noteBox(host);

    function redrawStatic() {
      const w0 = Math.pow(10, lw), G = Grlc(w0);
      const gain = Math.hypot(G.re, G.im), ph = Math.atan2(G.im, G.re) * 180 / Math.PI;
      ctl.lab.textContent = "ω₀ = " + w0.toFixed(2) + " rad/s";
      note.textContent =
        "gain " + gain.toFixed(3) + " (" + num(20 * Math.log10(gain), 1) + " dB), " +
        "phase " + num(ph, 0) + "°, a lag of " +
        (-ph / 360 * (2 * Math.PI / w0)).toFixed(3) + " s. " +
        "The marker on each plot is the number used to draw the red sinusoid.";
      drawMag(); drawPhase();
    }
    function frame(now) {
      drawTime(now);
      if (playing) raf = requestAnimationFrame(frame);
    }
    play.addEventListener("click", function () {
      TRACK.hit(host.id, "play");
      playing = !playing;
      play.textContent = playing ? "⏸ Pause" : "▶ Play";
      if (playing) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
      else { if (raf) cancelAnimationFrame(raf); raf = null; drawTime(0); }
    });
    ctl.sl.addEventListener("input", function () {
      TRACK.hit(host.id, "slider");
      lw = parseFloat(ctl.sl.value); redrawStatic();
      if (!playing) drawTime(0);
    });

    redrawStatic(); drawTime(0);
  })();

  // ========================================================================
  // (c) the height of the resonant peak, against the damping ratio
  // ========================================================================
  (function () {
    const host = document.getElementById("w-resonant-peak"); if (!host) return;

    const W = 720, H = 330;
    const WLO = -1, WHI = 1;              // decades of omega/omega_n
    const DBLO = -40, DBHI = 20;
    const GHOSTS = [0.1, 0.2, 0.3, 0.5, 1 / Math.SQRT2, 1.0];
    let zeta = 0.2;

    const g = panel(host, W, H);
    const PAD = 62, RPAD = 26, TOP = 18, BOT = 34;
    const bx = l => PAD + (l - WLO) * (W - PAD - RPAD) / (WHI - WLO);
    const by = db => TOP + (DBHI - db) * (H - TOP - BOT) / (DBHI - DBLO);

    // |G| in dB for the standard form, at omega = omega_n * 10^l
    function magdb(l, z) {
      const r = Math.pow(10, l);             // omega / omega_n
      const re = 1 - r * r, im = 2 * z * r;
      return -20 * Math.log10(Math.hypot(re, im));
    }
    function curve(z, colour, width, dash) {
      g.strokeStyle = colour; g.lineWidth = width;
      g.setLineDash(dash || []);
      g.beginPath();
      const N = W - PAD - RPAD;
      for (let px = 0; px <= N; px++) {
        const l = WLO + px * (WHI - WLO) / N;
        const X = PAD + px, Y = by(Math.max(Math.min(magdb(l, z), DBHI), DBLO));
        if (px === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke(); g.setLineDash([]);
    }

    const ctl = slider(host, 0.05, 1.4, 0.01, zeta, 66);
    const note = noteBox(host);

    function draw() {
      g.clearRect(0, 0, W, H);

      // log grid
      g.strokeStyle = GRID; g.lineWidth = 1;
      for (let d = WLO; d <= WHI; d++) {
        for (let k = 1; k <= 9; k++) {
          const l = d + Math.log10(k);
          if (l < WLO || l > WHI) continue;
          g.beginPath(); g.moveTo(bx(l), TOP); g.lineTo(bx(l), H - BOT); g.stroke();
        }
      }
      for (let db = DBLO; db <= DBHI; db += 10) {
        g.beginPath(); g.moveTo(PAD, by(db)); g.lineTo(W - RPAD, by(db)); g.stroke();
      }

      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(PAD, H - BOT); g.lineTo(W - RPAD, H - BOT); g.stroke();
      g.beginPath(); g.moveTo(PAD, TOP); g.lineTo(PAD, H - BOT); g.stroke();

      g.fillStyle = GREY; g.font = "12px Arial"; g.textAlign = "right";
      for (let db = DBLO; db <= DBHI; db += 10) g.fillText(num(db, 0) + " dB", PAD - 6, by(db) + 4);
      g.textAlign = "center";
      [[-1, "0.1ωₙ"], [0, "ωₙ"], [1, "10ωₙ"]].forEach(function (p) {
        g.fillText(p[1], bx(p[0]), H - BOT + 18);
      });
      g.textAlign = "left";
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText("|G(jω)|", PAD + 10, TOP + 14);

      // 0 dB line: above it the system amplifies
      g.strokeStyle = "#d8d8de"; g.lineWidth = 1.1; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(PAD, by(0)); g.lineTo(W - RPAD, by(0)); g.stroke();
      g.setLineDash([]);

      // the family, faint
      GHOSTS.forEach(function (z) { curve(z, GHOST, 1.2); });
      // the live curve
      curve(zeta, NAVY, 2.0);

      // peak marker, where one exists
      const zc = 1 / Math.SQRT2;
      if (zeta < zc) {
        const lr = 0.5 * Math.log10(1 - 2 * zeta * zeta);   // omega_r / omega_n
        const pk = 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta));
        const pdb = 20 * Math.log10(pk);
        const X = bx(lr), Y = by(Math.min(pdb, DBHI));
        g.strokeStyle = OUT; g.lineWidth = 1.2; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X, by(0)); g.stroke();
        g.beginPath(); g.moveTo(PAD, Y); g.lineTo(X, Y); g.stroke();
        g.setLineDash([]);
        g.fillStyle = OUT;
        g.beginPath(); g.arc(X, Y, 4, 0, 2 * Math.PI); g.fill();
        g.font = "12px Arial";
        g.fillText("ωᵣ = " + Math.pow(10, lr).toFixed(2) + "ωₙ", X + 8, by(0) - 8);
        g.fillText(num(pdb, 1) + " dB", X + 8, Y - 8);
      }

      ctl.lab.textContent = "ζ = " + zeta.toFixed(2);
      const zc2 = 1 / Math.SQRT2;
      if (zeta < zc2) {
        const pk = 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta));
        note.textContent =
          "peak gain " + pk.toFixed(2) + " (" + (20 * Math.log10(pk)).toFixed(1) + " dB) at ωᵣ = " +
          Math.sqrt(1 - 2 * zeta * zeta).toFixed(3) + "ωₙ. " +
          "As ζ falls the peak climbs without bound and moves towards ωₙ.";
      } else {
        note.textContent =
          "ζ ≥ 1/√2 ≈ 0.707: ωₙ²(1 − 2ζ²) is not positive, " +
          "so there is no resonant frequency and the curve falls away from 0 dB everywhere.";
      }
    }
    ctl.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); zeta = parseFloat(ctl.sl.value); draw(); });
    draw();
  })();
})();
