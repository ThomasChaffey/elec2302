/* ELEC2302 — Lecture 10 (filter design) interactive canvas widgets
   House style: navy #00468C primary, brick #C0392B secondary, thin guides.
   Self-contained, each guarded by its container id. Vanilla JS + canvas.

   w-lp2  — the week 1 resonant low-pass widget, parameterised by the damping
            ratio zeta instead of Q:
              G(j w) = w_n^2 / (w_n^2 - w^2 + j 2 zeta w_n w)
            A 100 Hz square wave is passed through the filter; the time plot,
            the Bode magnitude and the audio are built from the same harmonic
            amplitudes and phases.

   w-lphp — second order low-pass and high-pass gains (zeta = 1/sqrt 2),
            their cascade G_l G_h and their sum G_l + G_h:
              G_l(s) = w_l^2 / (s^2 + sqrt2 w_l s + w_l^2)
              G_h(s) = s^2   / (s^2 + sqrt2 w_h s + w_h^2)
*/
(function () {
  "use strict";
  const NAVY = "#00468C", RED = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e6e6e6", AXIS = "#555", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week10-<name>  (e.g.
  //   widget-week10-lp2). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week10-lp2 is
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
    const WEEK = "week10";                      // namespaces events across weeks
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
  function line(ctx, colour, width, dash) {
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  }
  function logMap(t, lo, hi) { return lo * Math.pow(hi / lo, t); }
  function logUnmap(v, lo, hi) { return Math.log(v / lo) / Math.log(hi / lo); }

  // shared control styling, injected once
  function injectStyle() {
    if (document.getElementById("fw-style")) return;
    const st = document.createElement("style");
    st.id = "fw-style";
    st.textContent =
      ".fw-row{display:flex;flex-wrap:wrap;gap:12px 28px;align-items:flex-end;margin-top:8px;" +
      "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222}" +
      ".fw-ctrl{flex:1 1 240px}.fw-ctrl label{display:block;margin-bottom:3px}" +
      ".fw-ctrl label b{color:#00468C;font-variant-numeric:tabular-nums}" +
      ".fw-ctrl input[type=range]{width:100%;accent-color:#00468C;margin:0}" +
      ".fw-btn{font-family:inherit;font-size:14px;padding:7px 14px;border:1px solid #00468C;" +
      "border-radius:3px;background:#fff;color:#00468C;cursor:pointer;white-space:nowrap}" +
      ".fw-btn:hover{background:#eef3f9}.fw-btn.fw-on{background:#C0392B;border-color:#C0392B;color:#fff}" +
      ".fw-main{background:#00468C;color:#fff;min-width:96px}.fw-main:hover{background:#003a75}" +
      ".fw-seg{display:inline-flex;border:1px solid #00468C;border-radius:3px;overflow:hidden}" +
      ".fw-seg button{font-family:inherit;font-size:13.5px;padding:6px 12px;border:0;background:#fff;" +
      "color:#00468C;cursor:pointer}.fw-seg button+button{border-left:1px solid #00468C}" +
      ".fw-seg button.fw-sel{background:#00468C;color:#fff}" +
      ".fw-readout{flex:1 1 100%;font-size:13px;color:#444;border-top:1px solid #e2e2e6;" +
      "padding-top:7px;line-height:1.5}.fw-readout b{color:#00468C;font-variant-numeric:tabular-nums}" +
      ".fw-legend{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#444;margin:2px 0 6px}" +
      ".fw-sw{display:inline-block;width:22px;height:3px;vertical-align:middle;margin:0 5px 3px 0}" +
      ".fw-title{font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#00468C;margin:4px 0 2px}";
    document.head.appendChild(st);
  }

  // Bode-magnitude frame on a log frequency axis. Returns the coordinate maps.
  function bodeFrame(ctx, W, H, fmin, fmax, dbmin, dbmax, ticks, xlabel, ylabel) {
    const mL = 50, mR = 22, mT = 10, mB = 36;
    const pw = W - mL - mR, ph = H - mT - mB;
    const X = f => mL + pw * Math.log(f / fmin) / Math.log(fmax / fmin);
    const Y = db => mT + ph * (1 - (db - dbmin) / (dbmax - dbmin));
    ctx.clearRect(0, 0, W, H);
    line(ctx, GRID, 1);
    ctx.beginPath();
    const d0 = Math.floor(Math.log10(fmin)), d1 = Math.ceil(Math.log10(fmax));
    for (let d = d0; d <= d1; d++) {
      for (let m = 1; m <= 9; m++) {
        const f = m * Math.pow(10, d);
        if (f < fmin || f > fmax) continue;
        ctx.moveTo(X(f), mT); ctx.lineTo(X(f), mT + ph);
      }
    }
    for (let db = dbmin; db <= dbmax; db += 10) { ctx.moveTo(mL, Y(db)); ctx.lineTo(mL + pw, Y(db)); }
    ctx.stroke();
    line(ctx, "#bbb", 1, [4, 4]);
    ctx.beginPath(); ctx.moveTo(mL, Y(0)); ctx.lineTo(mL + pw, Y(0)); ctx.stroke();
    line(ctx, AXIS, 1.2, []);
    ctx.beginPath();
    ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + ph); ctx.lineTo(mL + pw, mT + ph);
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ticks.forEach(function (t) { ctx.fillText(t[1], X(t[0]), mT + ph + 5); });
    ctx.fillText(xlabel, mL + pw / 2, mT + ph + 20);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let db = dbmin; db <= dbmax; db += 20) ctx.fillText(String(db).replace("-", "−"), mL - 6, Y(db));
    ctx.save();
    ctx.translate(13, mT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillText(ylabel, 0, 0);
    ctx.restore();
    return { X: X, Y: Y, mL: mL, mT: mT, pw: pw, ph: ph };
  }

  function bodeCurve(ctx, fr, fmin, fmax, dbmin, dbmax, magdb, colour, width) {
    line(ctx, colour, width || 2.2, []);
    ctx.lineJoin = "round";
    ctx.save();
    ctx.beginPath(); ctx.rect(fr.mL, fr.mT, fr.pw, fr.ph); ctx.clip();
    ctx.beginPath();
    const NP = 500;
    for (let i = 0; i <= NP; i++) {
      const f = fmin * Math.pow(fmax / fmin, i / NP);
      const db = Math.max(dbmin - 20, Math.min(dbmax + 20, magdb(f)));
      if (i === 0) ctx.moveTo(fr.X(f), fr.Y(db)); else ctx.lineTo(fr.X(f), fr.Y(db));
    }
    ctx.stroke();
    ctx.restore();
  }

  function vmark(ctx, fr, f, colour, label) {
    line(ctx, colour, 1.1, [5, 4]);
    ctx.beginPath(); ctx.moveTo(fr.X(f), fr.mT); ctx.lineTo(fr.X(f), fr.mT + fr.ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colour;
    ctx.font = "12px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(" " + label, fr.X(f), fr.mT + fr.ph - 3);
  }

  /* ================================================================= w-lp2 */
  (function () {
    const host = document.getElementById("w-lp2"); if (!host) return;
    injectStyle();

    const F1 = 100, NHARM = 199, NSTEM = 13, L = 1e-3, NT = 700, NPERD = 2,
          FMIN = 20, FMAX = 20000, DBMIN = -60, DBMAX = 30;
    const FNMIN = 30, FNMAX = 4000, ZMIN = 0.025, ZMAX = 2.5;
    const W = 700, HT = 240, HB = 260;

    const HARM = [];
    for (let n = 1; n <= NHARM; n += 2) HARM.push(n);

    host.innerHTML =
      '<div class="fw-title">Time domain</div>' +
      '<canvas></canvas>' +
      '<p class="fw-legend"><span class="fw-sw" style="background:#8a8a8a"></span>input&nbsp;<i>u</i>(<i>t</i>) &nbsp;&nbsp;' +
      '<span class="fw-sw" style="background:#00468C"></span>output&nbsp;<i>y</i>(<i>t</i>)</p>' +
      '<div class="fw-title">Bode magnitude</div>' +
      '<canvas></canvas>' +
      '<p class="fw-legend"><span class="fw-sw" style="background:#00468C"></span>|<i>G</i>(<i>j&omega;</i>)| &nbsp;&nbsp;' +
      '<span class="fw-sw" style="background:#C0392B"></span>odd harmonics of the square wave</p>' +
      '<div class="fw-row">' +
      '  <div class="fw-ctrl"><label>Natural frequency&nbsp;&nbsp;<i>f</i><sub>n</sub> = <b class="v-fn"></b></label>' +
      '    <input type="range" class="s-fn" min="0" max="1000"></div>' +
      '  <div class="fw-ctrl"><label>Damping ratio&nbsp;&nbsp;&zeta; = <b class="v-z"></b></label>' +
      '    <input type="range" class="s-z" min="0" max="1000"></div>' +
      '  <div class="fw-readout"></div>' +
      '</div>' +
      '<div class="fw-row">' +
      '  <button type="button" class="fw-btn fw-main b-play">&#9654;&nbsp;&nbsp;Play</button>' +
      '  <button type="button" class="fw-btn b-sweep">Sweep&nbsp;<i>f</i><sub>n</sub></button>' +
      '  <div><div style="margin-bottom:3px">Listening to</div><div class="fw-seg">' +
      '    <button type="button" data-ab="out" class="fw-sel">output&nbsp;<i>y</i>(<i>t</i>)</button>' +
      '<button type="button" data-ab="in">input&nbsp;<i>u</i>(<i>t</i>)</button></div></div>' +
      '  <div class="fw-ctrl"><label>Volume&nbsp;&nbsp;<b class="v-vol">50</b><b>%</b></label>' +
      '    <input type="range" class="s-vol" min="0" max="100" value="50"></div>' +
      '</div>';

    const cvs = host.getElementsByTagName("canvas");
    const gT = dpiCanvas(cvs[0], W, HT), gB = dpiCanvas(cvs[1], W, HB);
    const q = s => host.querySelector(s);
    const elFn = q(".s-fn"), elZ = q(".s-z"), outFn = q(".v-fn"), outZ = q(".v-z"),
          readout = q(".fw-readout"), elPlay = q(".b-play"), elSweep = q(".b-sweep"),
          elAB = q(".fw-seg"), elVol = q(".s-vol"), outVol = q(".v-vol");

    // G(j w) = w_n^2 / (w_n^2 - w^2 + j 2 zeta w_n w)
    function response(f, fn, z) {
      const w = 2 * Math.PI * f, wn = 2 * Math.PI * fn,
            re = wn * wn - w * w, im = 2 * z * wn * w;
      return { mag: wn * wn / Math.sqrt(re * re + im * im), phase: -Math.atan2(im, re) };
    }
    function harmonics(fn, z) {
      const amp = [], mag = [], pha = [];
      HARM.forEach(function (n) {
        const r = response(n * F1, fn, z);
        amp.push(4 / (Math.PI * n)); mag.push(r.mag); pha.push(r.phase);
      });
      return { amp: amp, mag: mag, pha: pha };
    }

    function drawTime(fn, z) {
      const ctx = gT; ctx.clearRect(0, 0, W, HT);
      const mL = 50, mR = 22, mT = 10, mB = 34, pw = W - mL - mR, ph = HT - mT - mB;
      const T = 1 / F1, tmax = NPERD * T, h = harmonics(fn, z);
      const ys = new Float64Array(NT);
      let ymax = 0;
      for (let i = 0; i < NT; i++) {
        const t = tmax * i / (NT - 1);
        let s = 0;
        for (let j = 0; j < HARM.length; j++) s += h.amp[j] * h.mag[j] * Math.sin(2 * Math.PI * HARM[j] * F1 * t + h.pha[j]);
        ys[i] = s; if (Math.abs(s) > ymax) ymax = Math.abs(s);
      }
      const ylim = Math.max(1.35, 1.12 * ymax);
      const X = t => mL + pw * t / tmax, Y = v => mT + ph * (1 - (v + ylim) / (2 * ylim));
      line(ctx, GRID, 1); ctx.beginPath();
      for (let g = 0; g <= NPERD * 4; g++) { const xg = mL + pw * g / (NPERD * 4); ctx.moveTo(xg, mT); ctx.lineTo(xg, mT + ph); }
      ctx.stroke();
      line(ctx, "#cfcfcf", 1, [4, 4]); ctx.beginPath();
      ctx.moveTo(mL, Y(1)); ctx.lineTo(mL + pw, Y(1)); ctx.moveTo(mL, Y(-1)); ctx.lineTo(mL + pw, Y(-1));
      ctx.stroke();
      line(ctx, AXIS, 1.2, []); ctx.beginPath();
      ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + ph); ctx.lineTo(mL + pw, mT + ph);
      ctx.moveTo(mL, Y(0)); ctx.lineTo(mL + pw, Y(0)); ctx.stroke();
      line(ctx, GREY, 1.6, []); ctx.beginPath(); ctx.moveTo(X(0), Y(1));
      for (let a = 0; a < NPERD; a++) {
        const t0 = a * T;
        ctx.lineTo(X(t0 + T / 2), Y(1)); ctx.lineTo(X(t0 + T / 2), Y(-1)); ctx.lineTo(X(t0 + T), Y(-1));
        if (a < NPERD - 1) ctx.lineTo(X(t0 + T), Y(1));
      }
      ctx.stroke();
      line(ctx, NAVY, 2.2, []); ctx.lineJoin = "round"; ctx.beginPath();
      for (let b = 0; b < NT; b++) { const t = tmax * b / (NT - 1); if (b === 0) ctx.moveTo(X(t), Y(ys[b])); else ctx.lineTo(X(t), Y(ys[b])); }
      ctx.stroke();
      ctx.fillStyle = "#333"; ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (let m = 0; m <= NPERD * 2; m++) ctx.fillText((tmax * m / (NPERD * 2) * 1000).toFixed(1), mL + pw * m / (NPERD * 2), mT + ph + 5);
      ctx.fillText("t  (ms)", mL + pw / 2, mT + ph + 19);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText("0", mL - 6, Y(0)); ctx.fillText("+1", mL - 6, Y(1)); ctx.fillText("−1", mL - 6, Y(-1));
      if (ylim > 1.6) { ctx.fillStyle = NAVY; ctx.fillText("±" + ylim.toFixed(1), mL - 6, Y(ylim) + 8); }
      return ymax;
    }

    function drawBode(fn, z) {
      const ctx = gB;
      const fr = bodeFrame(ctx, W, HB, FMIN, FMAX, DBMIN, DBMAX,
        [[20, "20"], [100, "100"], [1000, "1k"], [10000, "10k"]], "frequency  (Hz)", "|G|  (dB)");
      vmark(ctx, fr, fn, RED, "fₙ");
      bodeCurve(ctx, fr, FMIN, FMAX, DBMIN, DBMAX, f => 20 * Math.log10(response(f, fn, z).mag), NAVY);
      ctx.save(); ctx.beginPath(); ctx.rect(fr.mL, fr.mT, fr.pw, fr.ph); ctx.clip();
      ctx.font = "11px Arial, Helvetica, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      for (let k = 0; k < NSTEM; k++) {
        const nh = HARM[k], fh = nh * F1, dbh = 20 * Math.log10(response(fh, fn, z).mag);
        if (dbh < DBMIN - 2) continue;
        const xh = fr.X(fh), yh = fr.Y(Math.min(DBMAX, dbh));
        line(ctx, "rgba(192,57,43,0.40)", 1.2, []);
        ctx.beginPath(); ctx.moveTo(xh, fr.mT + fr.ph); ctx.lineTo(xh, yh); ctx.stroke();
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(xh, yh, 4.6 / Math.sqrt(nh) + 1.4, 0, 2 * Math.PI); ctx.fill();
        if (nh <= 9) ctx.fillText(nh === 1 ? "f₁" : nh + "f₁", xh, yh - 7);
      }
      ctx.restore();
    }

    function fmtC(C) {
      if (C >= 1e-6) return (C * 1e6).toPrecision(3) + " µF";
      if (C >= 1e-9) return (C * 1e9).toPrecision(3) + " nF";
      return (C * 1e12).toPrecision(3) + " pF";
    }
    const curFn = () => logMap(elFn.value / 1000, FNMIN, FNMAX);
    const curZ = () => logMap(elZ.value / 1000, ZMIN, ZMAX);

    function render() {
      const fn = curFn(), z = curZ();
      outFn.textContent = fn >= 1000 ? (fn / 1000).toFixed(2) + " kHz" : fn.toFixed(0) + " Hz";
      outZ.textContent = z < 0.1 ? z.toFixed(3) : z.toFixed(2);
      const peak = drawTime(fn, z);
      drawBode(fn, z);
      const wn = 2 * Math.PI * fn, C = 1 / (wn * wn * L), R = 2 * z * wn * L;
      let peakTxt;
      if (z < Math.SQRT1_2) {
        const Mp = 1 / (2 * z * Math.sqrt(1 - z * z)), fp = fn * Math.sqrt(1 - 2 * z * z);
        peakTxt = "peak |G| = <b>" + (20 * Math.log10(Mp)).toFixed(1) + " dB</b> at <b>" + fp.toFixed(0) + " Hz</b>";
      } else {
        peakTxt = "no peak (&zeta; &ge; 1/&radic;2, monotonic roll-off)";
      }
      readout.innerHTML =
        "&omega;<sub>n</sub> = <b>" + (wn / 1000).toFixed(2) + "×10³ rad/s</b> &nbsp;&middot;&nbsp; " +
        peakTxt + " &nbsp;&middot;&nbsp; output swing = <b>±" + peak.toFixed(2) + "</b><br>" +
        "Realisation with <i>L</i> = 1 mH: &nbsp;<i>C</i> = 1/(&omega;<sub>n</sub><sup>2</sup><i>L</i>) = <b>" +
        fmtC(C) + "</b>, &nbsp;<i>R</i> = 2&zeta;&omega;<sub>n</sub><i>L</i> = <b>" + R.toPrecision(3) +
        " Ω</b> &nbsp;&middot;&nbsp; drive: 100 Hz square wave, harmonics to " + NHARM + "f₁";
      updateAudio(fn, z, false);
    }

    // ---- audio: a 100 Hz oscillator whose wavetable is the filtered square wave
    const BASEGAIN = 0.25, CEILING = 0.85;
    const audio = { ctx: null, osc: null, gain: null, on: false, listen: "out" };
    function makeWave(fn, z) {
      const N = NHARM + 1, real = new Float32Array(N), imag = new Float32Array(N);
      const h = harmonics(fn, z), bypass = audio.listen === "in";
      for (let k = 0; k < HARM.length; k++) {
        const n = HARM[k]; if (n >= N) break;
        const A = h.amp[k] * (bypass ? 1 : h.mag[k]), phi = bypass ? 0 : h.pha[k];
        real[n] = A * Math.sin(phi); imag[n] = A * Math.cos(phi);
      }
      return audio.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    function wavePeak(fn, z) {
      if (audio.listen === "in") return 1;
      const h = harmonics(fn, z); let peak = 0;
      for (let i = 0; i < 600; i++) {
        const th = 2 * Math.PI * i / 600; let s = 0;
        for (let k = 0; k < HARM.length; k++) s += h.amp[k] * h.mag[k] * Math.sin(HARM[k] * th + h.pha[k]);
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
      return Math.max(peak, 1e-6);
    }
    let lastAudio = 0;
    function updateAudio(fn, z, force) {
      if (!audio.ctx || !audio.on) return;
      const now = audio.ctx.currentTime;
      if (!force && now - lastAudio < 0.04) return;
      lastAudio = now;
      if (audio.osc) audio.osc.setPeriodicWave(makeWave(fn, z));
      if (audio.gain) {
        const g = Math.min(BASEGAIN, CEILING / wavePeak(fn, z)) * elVol.value / 100;
        audio.gain.gain.setTargetAtTime(g, now, 0.02);
      }
    }
    function startAudio() {
      if (!audio.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { elPlay.textContent = "no audio"; elPlay.disabled = true; return; }
        audio.ctx = new AC();
        audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 0;
        audio.gain.connect(audio.ctx.destination);
      }
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      audio.osc = audio.ctx.createOscillator();
      audio.osc.frequency.value = F1;
      audio.osc.connect(audio.gain);
      audio.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.gain.gain.setValueAtTime(0, audio.ctx.currentTime);
      audio.on = true; audio.osc.start();
      elPlay.innerHTML = "&#9632;&nbsp;&nbsp;Stop"; elPlay.classList.add("fw-on");
      updateAudio(curFn(), curZ(), true);
    }
    function stopAudio() {
      audio.on = false;
      elPlay.innerHTML = "&#9654;&nbsp;&nbsp;Play"; elPlay.classList.remove("fw-on");
      if (!audio.ctx || !audio.osc) return;
      const t = audio.ctx.currentTime, osc = audio.osc;
      audio.gain.gain.cancelScheduledValues(t);
      audio.gain.gain.setValueAtTime(audio.gain.gain.value, t);
      audio.gain.gain.linearRampToValueAtTime(0, t + 0.04);
      osc.stop(t + 0.06); audio.osc = null;
    }
    elPlay.addEventListener("click", function () { TRACK.hit(host.id, "play"); if (audio.on) stopAudio(); else startAudio(); });
    elAB.addEventListener("click", function (ev) {
      const b = ev.target.closest ? ev.target.closest("button") : null;
      if (!b || !b.getAttribute("data-ab")) return;
      TRACK.hit(host.id, "preset");
      audio.listen = b.getAttribute("data-ab");
      Array.prototype.forEach.call(elAB.getElementsByTagName("button"), function (x) {
        x.className = x === b ? "fw-sel" : "";
      });
      updateAudio(curFn(), curZ(), true);
    });
    elVol.addEventListener("input", function () { TRACK.hit(host.id, "slider"); outVol.textContent = elVol.value; updateAudio(curFn(), curZ(), true); });

    const sweep = { on: false, dir: -1, t0: 0, raf: 0 };
    function stepSweep(now) {
      if (!sweep.on) return;
      const dt = (now - sweep.t0) / 1000; sweep.t0 = now;
      let v = Number(elFn.value) + sweep.dir * 1000 * dt / 11;
      if (v <= 0) { v = 0; sweep.dir = 1; }
      if (v >= 1000) { v = 1000; sweep.dir = -1; }
      elFn.value = v; render();
      sweep.raf = window.requestAnimationFrame(stepSweep);
    }
    elSweep.addEventListener("click", function () {
      TRACK.hit(host.id, "play");
      sweep.on = !sweep.on;
      elSweep.classList.toggle("fw-on", sweep.on);
      if (sweep.on) { sweep.t0 = performance.now(); sweep.raf = window.requestAnimationFrame(stepSweep); }
      else if (sweep.raf) window.cancelAnimationFrame(sweep.raf);
    });
    elFn.addEventListener("input", function () { TRACK.hit(host.id, "slider"); render(); });
    elZ.addEventListener("input", function () { TRACK.hit(host.id, "slider"); render(); });

    // start at f_n = 500 Hz, zeta = 1/sqrt 2
    elFn.value = Math.round(1000 * logUnmap(500, FNMIN, FNMAX));
    elZ.value = Math.round(1000 * logUnmap(Math.SQRT1_2, ZMIN, ZMAX));
    render();
  })();

  /* ================================================================ w-lphp */
  (function () {
    const host = document.getElementById("w-lphp"); if (!host) return;
    injectStyle();

    const W = 700, H = 210, FMIN = 0.01, FMAX = 1000, DBMIN = -80, DBMAX = 10;
    const WMIN = 0.1, WMAX = 100;
    const TICKS = [[0.01, "0.01"], [0.1, "0.1"], [1, "1"], [10, "10"], [100, "100"], [1000, "1000"]];
    const S2 = Math.SQRT2;

    host.innerHTML =
      '<div class="fw-title">Low-pass and high-pass</div>' +
      '<canvas></canvas>' +
      '<p class="fw-legend"><span class="fw-sw" style="background:#00468C"></span>|<i>G</i><sub>&#8467;</sub>(<i>j&omega;</i>)| low-pass &nbsp;&nbsp;' +
      '<span class="fw-sw" style="background:#C0392B"></span>|<i>G</i><sub>h</sub>(<i>j&omega;</i>)| high-pass</p>' +
      '<div class="fw-title">Cascade</div>' +
      '<canvas></canvas>' +
      '<p class="fw-legend"><span class="fw-sw" style="background:#00468C"></span>|<i>G</i><sub>&#8467;</sub>(<i>j&omega;</i>)&thinsp;<i>G</i><sub>h</sub>(<i>j&omega;</i>)|</p>' +
      '<div class="fw-title">Sum</div>' +
      '<canvas></canvas>' +
      '<p class="fw-legend"><span class="fw-sw" style="background:#00468C"></span>|<i>G</i><sub>&#8467;</sub>(<i>j&omega;</i>) + <i>G</i><sub>h</sub>(<i>j&omega;</i>)|' +
      ' &nbsp;&nbsp; second order, &zeta; = 1/&radic;2</p>' +
      '<div class="fw-row">' +
      '  <div class="fw-ctrl"><label>Low-pass cutoff&nbsp;&nbsp;&omega;<sub>&#8467;</sub> = <b class="v-wl"></b></label>' +
      '    <input type="range" class="s-wl" min="0" max="1000"></div>' +
      '  <div class="fw-ctrl"><label>High-pass cutoff&nbsp;&nbsp;&omega;<sub>h</sub> = <b class="v-wh"></b></label>' +
      '    <input type="range" class="s-wh" min="0" max="1000"></div>' +
      '  <button type="button" class="fw-btn fw-main b-play">&#9654;&nbsp;&nbsp;Sweep&nbsp;&omega;<sub>h</sub></button>' +
      '</div>';

    const cvs = host.getElementsByTagName("canvas");
    const g = [dpiCanvas(cvs[0], W, H), dpiCanvas(cvs[1], W, H), dpiCanvas(cvs[2], W, H)];
    const q = s => host.querySelector(s);
    const elWl = q(".s-wl"), elWh = q(".s-wh"), outWl = q(".v-wl"), outWh = q(".v-wh"), elPlay = q(".b-play");

    // complex helpers, [re, im]
    const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
    const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const cabs = a => Math.hypot(a[0], a[1]);
    // G_l(jw) = wl^2 / (wl^2 - w^2 + j sqrt2 wl w),  G_h(jw) = -w^2 / (wh^2 - w^2 + j sqrt2 wh w)
    const Gl = (w, wl) => cdiv([wl * wl, 0], [wl * wl - w * w, S2 * wl * w]);
    const Gh = (w, wh) => cdiv([-w * w, 0], [wh * wh - w * w, S2 * wh * w]);
    const dB = m => 20 * Math.log10(Math.max(m, 1e-12));

    const curWl = () => logMap(elWl.value / 1000, WMIN, WMAX);
    const curWh = () => logMap(elWh.value / 1000, WMIN, WMAX);
    const fmt = w => (w < 1 ? w.toFixed(2) : w < 10 ? w.toFixed(1) : w.toFixed(0)) + " rad/s";

    function m3(ctx, fr) {
      line(ctx, GREY, 1, [2, 3]);
      ctx.beginPath(); ctx.moveTo(fr.mL, fr.Y(-3)); ctx.lineTo(fr.mL + fr.pw, fr.Y(-3)); ctx.stroke();
      ctx.setLineDash([]);
    }

    function render() {
      const wl = curWl(), wh = curWh();
      outWl.textContent = fmt(wl); outWh.textContent = fmt(wh);
      const lab = "ω  (rad/s)", ylab = "gain  (dB)";
      let fr = bodeFrame(g[0], W, H, FMIN, FMAX, DBMIN, DBMAX, TICKS, lab, ylab);
      m3(g[0], fr);
      vmark(g[0], fr, wl, NAVY, "ωℓ");
      vmark(g[0], fr, wh, RED, "ωh");
      bodeCurve(g[0], fr, FMIN, FMAX, DBMIN, DBMAX, w => dB(cabs(Gl(w, wl))), NAVY);
      bodeCurve(g[0], fr, FMIN, FMAX, DBMIN, DBMAX, w => dB(cabs(Gh(w, wh))), RED);

      fr = bodeFrame(g[1], W, H, FMIN, FMAX, DBMIN, DBMAX, TICKS, lab, ylab);
      m3(g[1], fr);
      vmark(g[1], fr, wl, NAVY, "ωℓ");
      vmark(g[1], fr, wh, RED, "ωh");
      bodeCurve(g[1], fr, FMIN, FMAX, DBMIN, DBMAX, w => dB(cabs(cmul(Gl(w, wl), Gh(w, wh)))), NAVY);

      fr = bodeFrame(g[2], W, H, FMIN, FMAX, DBMIN, DBMAX, TICKS, lab, ylab);
      m3(g[2], fr);
      vmark(g[2], fr, wl, NAVY, "ωℓ");
      vmark(g[2], fr, wh, RED, "ωh");
      bodeCurve(g[2], fr, FMIN, FMAX, DBMIN, DBMAX, w => { const a = Gl(w, wl), b = Gh(w, wh); return dB(cabs([a[0] + b[0], a[1] + b[1]])); }, NAVY);
    }

    const sweep = { on: false, dir: 1, t0: 0, raf: 0 };
    function step(now) {
      if (!sweep.on) return;
      const dt = (now - sweep.t0) / 1000; sweep.t0 = now;
      let v = Number(elWh.value) + sweep.dir * 1000 * dt / 10;
      if (v <= 0) { v = 0; sweep.dir = 1; }
      if (v >= 1000) { v = 1000; sweep.dir = -1; }
      elWh.value = v; render();
      sweep.raf = window.requestAnimationFrame(step);
    }
    elPlay.addEventListener("click", function () {
      TRACK.hit(host.id, "play");
      sweep.on = !sweep.on;
      elPlay.classList.toggle("fw-on", sweep.on);
      elPlay.innerHTML = (sweep.on ? "&#10074;&#10074;&nbsp;&nbsp;Pause" : "&#9654;&nbsp;&nbsp;Sweep&nbsp;&omega;<sub>h</sub>");
      if (sweep.on) { sweep.t0 = performance.now(); sweep.raf = window.requestAnimationFrame(step); }
      else if (sweep.raf) window.cancelAnimationFrame(sweep.raf);
    });
    elWl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); render(); });
    elWh.addEventListener("input", function () { TRACK.hit(host.id, "slider"); render(); });

    // start as a bandpass: w_h = 1 rad/s below w_l = 10 rad/s
    elWl.value = Math.round(1000 * logUnmap(10, WMIN, WMAX));
    elWh.value = Math.round(1000 * logUnmap(1, WMIN, WMAX));
    render();
  })();
})();
