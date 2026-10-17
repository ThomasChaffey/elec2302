/* ELEC2302 Lecture 11 — interactive canvas widgets
   House style: navy #00468C primary (input u), brick #C0392B secondary (output y),
   thin guides. Self-contained, guarded by container id. Vanilla JS + canvas only.

   (a) w-fm — FM with a single-tone message, k variable.
         u(t) = cos(wm t),   y(t) = cos(wc t + k * int_0^t u) = cos(wc t + beta sin(wm t)),
         beta = k / wm.
       Jacobi–Anger: y(t) = sum_n J_n(beta) cos((wc + n wm) t), so Y(jw) has impulses of
       weight pi J_n(beta) at w = +-(wc + n wm). The spectrum panel plots |J_n(beta)|
       against w = wc + n wm, positive frequencies only.
       Small k: one line at wc plus a pair at wc +- wm (the AM-like bandwidth).
       Large k: lines spread over roughly wc +- (k + wm). wc = 12, so k <= 10 keeps them above 0.
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a", GRID = "#e8e8ec", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week11-<name>  (e.g.
  //   widget-week11-lp2). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week11-lp2 is
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
    const WEEK = "week11";                      // namespaces events across weeks
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

  // J_n(x) = (1/pi) int_0^pi cos(n s - x sin s) ds, composite Simpson
  function besselJ(n, x) {
    const M = 400, h = Math.PI / M;
    let acc = 0;
    for (let i = 0; i <= M; i++) {
      const s = i * h, f = Math.cos(n * s - x * Math.sin(s));
      acc += (i === 0 || i === M) ? f : (i % 2 ? 4 * f : 2 * f);
    }
    return acc * h / 3 / Math.PI;
  }

  // ========================================================================
  // (a) FM spectrum versus k
  // ========================================================================
  (function () {
    const host = document.getElementById("w-fm"); if (!host) return;

    const W = 720, HT = 190, HF = 210;
    const WM = 1, WC = 12;             // message and carrier frequency, rad/s
    const KMAX = 10;                   // largest k, in rad/s
    const TMAX = 2 * Math.PI;          // one message period
    const FMAX = 28;                   // frequency axis, rad/s
    let k = 0.3;
    let playing = false, last = null;

    const ct = document.createElement("canvas"), cf = document.createElement("canvas");
    [ct, cf].forEach(function (c) {
      const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    });
    const gt = dpiCanvas(ct, W, HT), gf = dpiCanvas(cf, W, HF);

    // ---- time panel: u on top, y below
    const TPAD = 60, uy = 46, yy = 136, AMP = 32;
    const tx = t => TPAD + t * (W - TPAD - 30) / TMAX;

    function trace(g, f, cy, col, lw) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      const N = 1400;
      for (let i = 0; i <= N; i++) {
        const t = i * TMAX / N, X = tx(t), Y = cy - AMP * f(t);
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.stroke();
    }

    function drawTime() {
      const g = gt;
      g.clearRect(0, 0, W, HT);
      [uy, yy].forEach(function (cy) {
        g.strokeStyle = GREY; g.lineWidth = 1;
        g.beginPath(); g.moveTo(TPAD, cy); g.lineTo(W - 20, cy); g.stroke();
        g.beginPath(); g.moveTo(TPAD, cy - AMP - 6); g.lineTo(TPAD, cy + AMP + 6); g.stroke();
        g.fillStyle = GREY; g.font = "13px Arial"; g.fillText("t", W - 16, cy + 4);
      });
      trace(g, t => Math.cos(WM * t), uy, NAVY, 1.6);
      const beta = k / WM;
      trace(g, t => Math.cos(WC * t + beta * Math.sin(WM * t)), yy, OUT, 1.3);
      g.font = "13px Arial";
      g.fillStyle = NAVY; g.fillText("u(t)", 14, uy + 4);
      g.fillStyle = OUT;  g.fillText("y(t)", 14, yy + 4);
    }

    // ---- spectrum panel
    const FPAD = 60, fcy = 170, YS = 140;
    const fx = w => FPAD + w * (W - FPAD - 30) / FMAX;

    function drawFreq() {
      const g = gf;
      g.clearRect(0, 0, W, HF);
      g.strokeStyle = GRID; g.lineWidth = 1;
      g.beginPath(); g.moveTo(FPAD, fcy - YS); g.lineTo(W - 20, fcy - YS); g.stroke();

      g.strokeStyle = GREY;
      g.beginPath(); g.moveTo(FPAD - 6, fcy); g.lineTo(W - 20, fcy); g.stroke();
      g.beginPath(); g.moveTo(FPAD, fcy + 4); g.lineTo(FPAD, fcy - YS - 8); g.stroke();
      g.fillStyle = GREY; g.font = "13px Arial";
      g.fillText("ω", W - 16, fcy + 4);
      g.textAlign = "center";
      [0, 4, 8, 12, 16, 20, 24, 28].forEach(function (w) {
        g.beginPath(); g.moveTo(fx(w), fcy - 3); g.lineTo(fx(w), fcy + 3); g.stroke();
        g.fillText(w === WC ? "ωc = " + WC : String(w), fx(w), fcy + 18);
      });
      g.textAlign = "right";
      g.fillText("1", FPAD - 6, fcy - YS + 4);
      g.fillText("0", FPAD - 6, fcy + 4);
      g.textAlign = "left";

      const beta = k / WM;
      for (let n = -WC; n <= FMAX - WC; n++) {
        const w = WC + n * WM;
        if (w < 0 || w > FMAX) continue;
        const a = Math.abs(besselJ(n, beta));
        if (a < 2e-3) continue;
        const X = fx(w), Y = fcy - a * YS;
        g.strokeStyle = OUT; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(X, fcy); g.lineTo(X, Y); g.stroke();
        g.fillStyle = OUT; g.beginPath(); g.arc(X, Y, 2.3, 0, 2 * Math.PI); g.fill();
      }
      g.fillStyle = INK; g.font = "13px Arial";
      g.fillText("|Y(jω)| / π,  ω > 0", FPAD + 8, fcy - YS + 16);
    }

    // ---- controls
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const btn = document.createElement("button");
    btn.style.cssText = "border:1px solid " + NAVY + ";background:#fff;color:" + NAVY +
      ";border-radius:5px;padding:3px 10px;cursor:pointer;font:13px Arial;min-width:64px;";
    const lab = document.createElement("span");
    lab.style.cssText = "min-width:118px;font-variant-numeric:tabular-nums;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = "0"; sl.max = String(KMAX); sl.step = "0.05"; sl.value = String(k);
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    row.appendChild(btn); row.appendChild(lab); row.appendChild(sl);
    host.appendChild(row);

    const note = document.createElement("div");
    note.style.cssText = "margin-top:6px;font:13px Arial;color:#555;min-height:19px;";
    host.appendChild(note);

    function draw() {
      btn.textContent = playing ? "Pause" : "Play";
      lab.textContent = "k = " + k.toFixed(2) + " rad/s";
      note.textContent = "u(t) = cos(ωm t), ωm = " + WM + " rad/s, ωc = " + WC +
        " rad/s, so y(t) = cos(ωc t + (k/ωm) sin(ωm t)). Lines at ωc + n ωm with height |Jn(k/ωm)|.";
      drawTime(); drawFreq();
    }

    function step(ts) {
      if (!playing) { last = null; return; }
      if (last !== null) {
        k += (ts - last) / 1000 * 1.5;           // 1.5 rad/s of k per second
        if (k > KMAX) k = 0;
        sl.value = String(k);
      }
      last = ts;
      draw();
      requestAnimationFrame(step);
    }

    btn.addEventListener("click", function () {
      TRACK.hit(host.id, "play");
      playing = !playing; draw();
      if (playing) requestAnimationFrame(step);
    });
    sl.addEventListener("input", function () {
      TRACK.hit(host.id, "slider");
      k = parseFloat(sl.value);
      if (playing) { playing = false; }
      draw();
    });
    draw();
  })();
})();
