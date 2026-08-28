/* ELEC2302 Lecture 5 — interactive canvas widgets
   House style: navy #00468C primary (input/time domain), brick #C0392B secondary
   (spectrum), thin guides. Self-contained, guarded by container id.
   Pure vanilla JS + canvas, no dependencies.

   (a) w-sample — T c_k as samples of the fixed envelope E(omega).
       Rectangular pulse train, pulse centred at the origin, tau fixed, T variable.
         c_k = A d sinc(k d),  d = tau/T,  sinc(x) = sin(pi x)/(pi x)
         T c_k = E(k w0),      E(omega) = A tau sinc(omega tau / 2 pi)
       E carries no T. T sets only the grid spacing w0 = 2 pi / T.

   (b) w-tau — the width-tau pulse and its transform, tau variable.
         u(t) = A p_tau(t)   <->   U(j omega) = A tau sinc(omega tau / 2 pi)
       First null at omega = 2 pi / tau; peak height A tau; area 2 pi A.
       Shrinking tau lowers and widens the transform; growing tau raises and
       narrows it, towards an impulse.
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", ENV = "#b0b0b0", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week5-<name>  (e.g.
  //   widget-week5-sample). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week5-sample is
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
    const WEEK = "week5";                      // namespaces events across weeks
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
  // openEnd: suppress the right-hand arrowhead, for a dimension that runs off-panel
  function dimArrow(ctx, x0, x1, y, label, color, openEnd) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    const heads = openEnd ? [[x0, 1]] : [[x0, 1], [x1, -1]];
    heads.forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p[0], y);
      ctx.lineTo(p[0] + 6 * p[1], y - 3.2);
      ctx.lineTo(p[0] + 6 * p[1], y + 3.2);
      ctx.closePath(); ctx.fill();
    });
    ctx.font = "12px Arial"; ctx.textAlign = "center";
    ctx.fillText(label, (x0 + x1) / 2, y - 5);
    ctx.textAlign = "left";
  }

  // ========================================================================
  // (a) T c_k as samples of the fixed envelope E
  // ========================================================================
  (function () {
    const host = document.getElementById("w-sample"); if (!host) return;

    const W = 720, HT = 132, HF = 268;
    const A = 1, TAU = 1;              // amplitude and pulse width, both fixed
    const UMAX = 3.6;                  // frequency axis half-range, in units of 2 pi / tau
    const TMAX = 15;                   // time axis half-range, in units of tau
    let R = 4;                         // R = T / tau, the only thing the slider moves
    let scaled = true;                 // true: plot T c_k   false: plot raw c_k

    const ct = document.createElement("canvas"), cf = document.createElement("canvas");
    [ct, cf].forEach(function (c) {
      const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    });
    const gt = dpiCanvas(ct, W, HT), gf = dpiCanvas(cf, W, HF);

    // ---- time panel geometry
    const TPAD = 40, tcy = 92;
    const tx = u => TPAD + (u + TMAX) * (W - 2 * TPAD) / (2 * TMAX);
    const PH = 52;                     // pulse height in pixels

    // ---- frequency panel geometry
    const FPAD = 40, fcy = 186, YS = 148;   // YS pixels per unit of A*tau
    const fx = u => FPAD + (u + UMAX) * (W - 2 * FPAD) / (2 * UMAX);
    const fy = v => fcy - v * YS;

    function drawTime() {
      const g = gt;
      g.clearRect(0, 0, W, HT);

      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(TPAD - 12, tcy); g.lineTo(W - TPAD + 12, tcy); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("t", W - TPAD + 16, tcy - 5);

      // pulses at multiples of T = R tau, each of width tau, centred on the origin
      const mMax = Math.ceil((TMAX + 0.5) / R);
      g.lineWidth = 1.6;
      for (let m = -mMax; m <= mMax; m++) {
        const c = m * R, l = c - 0.5, r = c + 0.5;
        if (r < -TMAX || l > TMAX) continue;
        const xl = tx(Math.max(l, -TMAX)), xr = tx(Math.min(r, TMAX));
        g.fillStyle = "rgba(0,70,140,0.13)";
        g.fillRect(xl, tcy - PH, xr - xl, PH);
        g.strokeStyle = NAVY;
        g.beginPath();
        g.moveTo(xl, tcy); g.lineTo(xl, tcy - PH);
        g.lineTo(xr, tcy - PH); g.lineTo(xr, tcy);
        g.stroke();
      }

      // tau across the central pulse, T from pulse 0 to pulse 1.
      // Once T runs past the right edge the arrow is clamped and left open-ended,
      // so the label survives at exactly the T values that matter most.
      dimArrow(g, tx(-0.5), tx(0.5), tcy - PH - 9, "τ", INK);
      const xT = tx(R), clamped = xT > W - TPAD;
      dimArrow(g, tx(0), clamped ? W - TPAD : xT, tcy + 20,
               clamped ? "T →" : "T", OUT, clamped);

      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText("x(t)", TPAD - 32, tcy - PH + 12);
    }

    function drawFreq() {
      const g = gf;
      g.clearRect(0, 0, W, HF);
      const d = 1 / R;                       // duty cycle tau/T
      const amp = scaled ? A * TAU : A * d;  // envelope height actually plotted

      // horizontal guide at the envelope peak
      g.strokeStyle = GRID; g.lineWidth = 1;
      g.beginPath(); g.moveTo(FPAD, fy(A * TAU)); g.lineTo(W - FPAD, fy(A * TAU)); g.stroke();

      // axes
      g.strokeStyle = GREY;
      g.beginPath(); g.moveTo(FPAD - 12, fcy); g.lineTo(W - FPAD + 12, fcy); g.stroke();
      g.beginPath(); g.moveTo(fx(0), fy(A * TAU) - 16); g.lineTo(fx(0), fcy + 46); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("ω", W - FPAD + 16, fcy - 5);

      // ticks at the envelope zeros, omega = 2 pi n / tau
      g.font = "12px Arial"; g.textAlign = "center";
      for (let n = -3; n <= 3; n++) {
        if (n === 0) continue;
        const X = fx(n);
        g.strokeStyle = GREY;
        g.beginPath(); g.moveTo(X, fcy - 3); g.lineTo(X, fcy + 3); g.stroke();
        g.fillStyle = GREY;
        // the nth zero sits at omega = 2 pi n / tau, so label it 2n pi / tau
        g.fillText((n < 0 ? "−" : "") + (2 * Math.abs(n)) + "π/τ", X, fcy + 18);
      }
      g.textAlign = "left";

      // faint reference copy of the full E when we are plotting raw c_k,
      // so the amplitude collapse is visible against a fixed benchmark
      if (!scaled) {
        g.strokeStyle = "#dcdce2"; g.lineWidth = 1.4; g.setLineDash([4, 4]);
        g.beginPath();
        for (let px = 0; px <= W - 2 * FPAD; px++) {
          const u = -UMAX + px * (2 * UMAX) / (W - 2 * FPAD);
          const v = A * TAU * sincn(u);
          if (px === 0) g.moveTo(fx(u), fy(v)); else g.lineTo(fx(u), fy(v));
        }
        g.stroke(); g.setLineDash([]);
      }

      // the envelope
      g.strokeStyle = ENV; g.lineWidth = 1.8;
      g.beginPath();
      for (let px = 0; px <= W - 2 * FPAD; px++) {
        const u = -UMAX + px * (2 * UMAX) / (W - 2 * FPAD);
        const v = amp * sincn(u);
        if (px === 0) g.moveTo(fx(u), fy(v)); else g.lineTo(fx(u), fy(v));
      }
      g.stroke();

      // the spectral lines, at omega = k w0  i.e.  u = k d
      const kMax = Math.floor(UMAX * R);
      for (let k = -kMax; k <= kMax; k++) {
        const u = k * d, v = amp * sincn(u), X = fx(u), Y = fy(v);
        const vanishes = Math.abs(v) < 1e-9;
        g.strokeStyle = OUT; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(X, fcy); g.lineTo(X, Y); g.stroke();
        if (vanishes) {                      // open circle for a harmonic that dies
          g.strokeStyle = OUT; g.lineWidth = 1.2;
          g.beginPath(); g.arc(X, fcy, 2.6, 0, 2 * Math.PI); g.stroke();
        } else {
          g.fillStyle = OUT;
          g.beginPath(); g.arc(X, Y, 2.3, 0, 2 * Math.PI); g.fill();
        }
      }

      // labels
      g.fillStyle = ENV; g.font = "13px Arial";
      g.fillText(scaled ? "E(ω) = Aτ sinc(ωτ/2π)"
                        : "d·E(ω)", fx(1.15), fy(A * TAU) - 4);
      g.fillStyle = OUT;
      g.fillText(scaled ? "T cₖ" : "cₖ", FPAD - 30, fy(A * TAU) + 4);
    }

    // ---- controls -----------------------------------------------------------
    const chips = document.createElement("div");
    chips.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:10px;font:13px Arial;color:" + INK;
    function chip(text) {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.cssText = "border:1px solid " + NAVY + ";background:#fff;border-radius:5px;" +
        "padding:3px 10px;cursor:pointer;font:13px Arial;";
      chips.appendChild(b); return b;
    }
    const bScaled = chip("T cₖ  (samples of E)");
    const bRaw = chip("cₖ  (raw coefficients)");
    function paintChips() {
      bScaled.style.background = scaled ? NAVY : "#fff";
      bScaled.style.color = scaled ? "#fff" : NAVY;
      bRaw.style.background = scaled ? "#fff" : NAVY;
      bRaw.style.color = scaled ? NAVY : "#fff";
    }
    bScaled.addEventListener("click", function () { TRACK.hit(host.id, "preset"); scaled = true; paintChips(); draw(); });
    bRaw.addEventListener("click", function () { TRACK.hit(host.id, "preset"); scaled = false; paintChips(); draw(); });
    host.appendChild(chips);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const lab = document.createElement("span");
    lab.style.cssText = "min-width:104px;font-variant-numeric:tabular-nums;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = "1.25"; sl.max = "24"; sl.step = "0.25"; sl.value = String(R);
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    row.appendChild(lab); row.appendChild(sl);
    host.appendChild(row);

    const note = document.createElement("div");
    note.style.cssText = "margin-top:6px;font:13px Arial;color:#555;min-height:19px;";
    host.appendChild(note);

    function draw() {
      lab.textContent = "T = " + R.toFixed(2) + "τ";
      const near = Math.round(R);
      note.textContent =
        "ω₀ = 2π/T, so the line spacing is τ/T = " + (1 / R).toFixed(3) +
        " of a lobe width — about " + R.toFixed(2) + " lines per lobe." +
        (near >= 2 && Math.abs(R - near) < 1e-9
          ? "  T/τ = " + near + " exactly, so every " + near +
            "th harmonic lands on a zero and vanishes" +
            (near === 2 ? " — the Lecture 4 square wave." : ".")
          : "");
      drawTime(); drawFreq();
    }
    sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); R = parseFloat(sl.value); draw(); });

    paintChips(); draw();
  })();

  // ========================================================================
  // (b) the width-tau pulse and its transform: reciprocal spreading
  // ========================================================================
  (function () {
    const host = document.getElementById("w-tau"); if (!host) return;

    const W = 720, HT = 128, HF = 258;
    const A = 1;                       // pulse amplitude, fixed
    const TMAX = 3.0;                  // time axis half-range, seconds
    const WMAX = 20;                   // frequency axis half-range, rad/s
    const TAUMAX = 4;                  // largest tau, sets the vertical scale
    let tau = 1.0;

    const ct = document.createElement("canvas"), cf = document.createElement("canvas");
    [ct, cf].forEach(function (c) {
      const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    });
    const gt = dpiCanvas(ct, W, HT), gf = dpiCanvas(cf, W, HF);

    const TPAD = 40, tcy = 92, PH = 52;
    const tx = t => TPAD + (t + TMAX) * (W - 2 * TPAD) / (2 * TMAX);

    const FPAD = 40, fcy = 196, YS = 150 / (A * TAUMAX);   // pixels per unit of A*tau
    const fx = w => FPAD + (w + WMAX) * (W - 2 * FPAD) / (2 * WMAX);
    const fy = v => fcy - v * YS;

    function drawTime() {
      const g = gt;
      g.clearRect(0, 0, W, HT);
      g.strokeStyle = GREY; g.lineWidth = 1;
      g.beginPath(); g.moveTo(TPAD - 12, tcy); g.lineTo(W - TPAD + 12, tcy); g.stroke();
      g.beginPath(); g.moveTo(tx(0), tcy - PH - 18); g.lineTo(tx(0), tcy + 8); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("t", W - TPAD + 16, tcy - 5);

      const l = Math.max(-tau / 2, -TMAX), r = Math.min(tau / 2, TMAX);
      const xl = tx(l), xr = tx(r);
      g.fillStyle = "rgba(0,70,140,0.13)";
      g.fillRect(xl, tcy - PH, xr - xl, PH);
      g.strokeStyle = NAVY; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(tx(-TMAX), tcy); g.lineTo(xl, tcy); g.lineTo(xl, tcy - PH);
      g.lineTo(xr, tcy - PH); g.lineTo(xr, tcy); g.lineTo(tx(TMAX), tcy);
      g.stroke();

      dimArrow(g, xl, xr, tcy - PH - 9, "τ", INK);
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText("u(t) = A p", TPAD - 34, tcy - PH + 12);
      g.font = "10px Arial"; g.fillText("τ", TPAD + 30, tcy - PH + 16);
      g.font = "13px Arial"; g.fillText("(t)", TPAD + 36, tcy - PH + 12);
    }

    function drawFreq() {
      const g = gf;
      g.clearRect(0, 0, W, HF);
      const peak = A * tau;

      g.strokeStyle = GRID; g.lineWidth = 1;
      g.beginPath(); g.moveTo(FPAD, fy(peak)); g.lineTo(W - FPAD, fy(peak)); g.stroke();

      g.strokeStyle = GREY;
      g.beginPath(); g.moveTo(FPAD - 12, fcy); g.lineTo(W - FPAD + 12, fcy); g.stroke();
      g.beginPath(); g.moveTo(fx(0), fy(A * TAUMAX) - 10); g.lineTo(fx(0), fcy + 42); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("ω", W - FPAD + 16, fcy - 5);

      // the transform, with the main lobe shaded (its area is what stays put)
      const N = W - 2 * FPAD;
      const pts = [];
      for (let px = 0; px <= N; px++) {
        const w = -WMAX + px * (2 * WMAX) / N;
        pts.push([fx(w), fy(peak * sincn(w * tau / (2 * Math.PI)))]);
      }
      const w1 = 2 * Math.PI / tau;                    // first null
      if (w1 < WMAX) {
        g.fillStyle = "rgba(0,70,140,0.10)";
        g.beginPath(); g.moveTo(fx(-w1), fcy);
        for (let px = 0; px <= N; px++) {
          const w = -WMAX + px * (2 * WMAX) / N;
          if (w < -w1 || w > w1) continue;
          g.lineTo(pts[px][0], pts[px][1]);
        }
        g.lineTo(fx(w1), fcy); g.closePath(); g.fill();
      }
      g.strokeStyle = NAVY; g.lineWidth = 1.8;
      g.beginPath();
      pts.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
      g.stroke();

      // first null, marked and labelled
      if (w1 < WMAX) {
        g.strokeStyle = OUT; g.lineWidth = 1;
        [w1, -w1].forEach(function (w) {
          g.beginPath(); g.moveTo(fx(w), fcy - 4); g.lineTo(fx(w), fcy + 4); g.stroke();
        });
        dimArrow(g, fx(0), fx(w1), fcy + 30, "2π/τ", OUT);
      }

      g.fillStyle = NAVY; g.font = "13px Arial";
      g.fillText("U(jω) = Aτ sinc(ωτ/2π)", fx(0) + 12, fy(A * TAUMAX) + 4);
    }

    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const lab = document.createElement("span");
    lab.style.cssText = "min-width:74px;font-variant-numeric:tabular-nums;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = "0.5"; sl.max = String(TAUMAX); sl.step = "0.05"; sl.value = String(tau);
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    row.appendChild(lab); row.appendChild(sl);
    host.appendChild(row);

    const note = document.createElement("div");
    note.style.cssText = "margin-top:6px;font:13px Arial;color:#555;min-height:19px;";
    host.appendChild(note);

    function draw() {
      lab.textContent = "τ = " + tau.toFixed(2);
      note.textContent =
        "peak Aτ = " + (A * tau).toFixed(2) +
        ",  first null 2π/τ = " + (2 * Math.PI / tau).toFixed(2) +
        " rad/s.  Area under U is 2πA = " + (2 * Math.PI * A).toFixed(2) + ", whatever τ is.";
      drawTime(); drawFreq();
    }
    sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); tau = parseFloat(sl.value); draw(); });
    draw();
  })();
})();
