/* ELEC2302 Lecture 7 — interactive canvas widgets
   House style: navy #00468C primary (input / time domain), brick #C0392B secondary
   (output / marked quantity), thin guides. Self-contained, guarded by container id.
   Pure vanilla JS + canvas, no dependencies.

   (a) w-population — a one-pole population model and where its pole sits.
         ydot(t) = u(t) - k_d y(t) + k_r y(t)
       with k_r a per-capita birth rate, k_d a per-capita death rate and u(t) an
       external inflow. Collecting terms,
         (jω + (k_d - k_r)) Y(jω) = U(jω),
         G(jω) = 1 / (jω + (k_d - k_r)),
         single pole  p = k_r - k_d,
         h(t) = e^{(k_r - k_d) t} H(t).
       Left panel: h(t) on t in [0, 10]. The drawn value is clamped at 4 and the
       curve is clipped at the top of the panel, so decay, hold and growth all read
       on one fixed vertical scale.
       Right panel: the pole as a cross on the complex plane, Re in [-1.2, 1.2].
       The cross is NAVY while p < 0 and OUT once p >= 0 — the boundary case goes
       with the unstable side, since e^{0·t} = 1 never returns to zero.
       Regimes are decided with a tolerance of 0.005, so k_r = k_d is actually
       reachable from sliders that step in 0.01.

   (b) w-pendulum-undamped — the lossless, downward-pointing pendulum
         m L^2 thetaddot + m g L sin(theta) = 0,  i.e.  thetaddot = -(g/L) sin(theta),
       with g = 9.81, L = 1, m = 1 (m and L cancel out of the motion).
       Integration: velocity Verlet, a symplectic second-order method, at a fixed
       dt = 2 ms, sub-stepped against the wall clock so the displayed speed is
       real time whatever the frame rate. Symplectic stepping keeps
         E = 1/2 m L^2 thetadot^2 + m g L (1 - cos theta)
       bounded — it wobbles at O(dt^2) within a period but does not drift — so the
       amplitude is still visibly the starting amplitude after minutes of running.
       Left panel: the rod and bob, with a faint vertical reference through the
       pivot. Right panel: theta(t) on a 12 s scrolling window.
*/
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", GHOST = "#c9c9d2", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week7-<name>  (e.g.
  //   widget-week7-population). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week7-population is
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
    const WEEK = "week7";                      // namespaces events across weeks
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
  function panel(host, W, H) {
    const c = document.createElement("canvas");
    const d = document.createElement("div"); d.appendChild(c); host.appendChild(d);
    return dpiCanvas(c, W, H);
  }
  function panelRow(host) {
    const r = document.createElement("div");
    r.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;";
    host.appendChild(r); return r;
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
  // horizontal axis with arrow; label sits just past the arrowhead
  function axis(g, x0, x1, y, label) {
    g.strokeStyle = GREY; g.fillStyle = GREY; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.beginPath();
    g.moveTo(x1, y); g.lineTo(x1 - 6, y - 3.2); g.lineTo(x1 - 6, y + 3.2);
    g.closePath(); g.fill();
    g.font = "13px Arial"; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(label, x1 + 5, y - 5);
  }
  // vertical axis with arrow; y0 is the foot, y1 the head. Label centred above.
  function vaxis(g, x, y0, y1, label) {
    g.strokeStyle = GREY; g.fillStyle = GREY; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    g.beginPath();
    g.moveTo(x, y1); g.lineTo(x - 3.2, y1 + 6); g.lineTo(x + 3.2, y1 + 6);
    g.closePath(); g.fill();
    g.font = "13px Arial"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText(label, x, y1 - 7);
    g.textAlign = "left";
  }
  function clipRect(g, x, y, w, h) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  }
  // one line of normal / sub / superscript pieces, advanced by measured width so
  // nothing collides: parts are [text, "" | "sub" | "sup"].
  function rich(g, x, y, parts, size, colour) {
    const big = size + "px Arial", small = Math.round(size * 0.78) + "px Arial";
    g.fillStyle = colour; g.textAlign = "left"; g.textBaseline = "alphabetic";
    let cx = x;
    parts.forEach(function (p) {
      const s = p[1] || "";
      g.font = s ? small : big;
      const dy = s === "sub" ? size * 0.26 : s === "sup" ? -size * 0.42 : 0;
      g.fillText(p[0], cx, y + dy);
      cx += g.measureText(p[0]).width;
    });
    g.font = big;
    return cx;
  }

  // ========================================================================
  // (a) births against deaths: one real pole, three regimes
  // ========================================================================
  (function () {
    const host = document.getElementById("w-population"); if (!host) return;

    const WL = 400, HL = 250, WR = 280, HR = 250;
    const TMAX = 10, VMAX = 4;              // h(t) window and the clamp
    const RMAX = 1.2;                       // real-axis half range
    const TOL = 0.005;                      // equality band for the regime test
    let kr = 0.30, kd = 0.50;

    const row = panelRow(host);
    const gL = panel(row, WL, HL), gR = panel(row, WR, HR);

    // ---- left panel geometry: h(t) against t
    const LPADL = 48, LPADR = 26, LPADT = 34, LPADB = 34;
    const tx = t => LPADL + t * (WL - LPADL - LPADR) / TMAX;
    const ty = v => (HL - LPADB) - v * (HL - LPADT - LPADB) / VMAX;

    // ---- right panel geometry: the complex plane, isotropic
    const RPAD = 34;
    const RS = (WR - 2 * RPAD) / (2 * RMAX);     // pixels per unit, both axes
    const rcy = HR / 2;
    const rx = re => RPAD + (re + RMAX) * RS;
    const ry = im => rcy - im * RS;

    function pole() { return kr - kd; }
    function regime() {                          // -1 stable, 0 marginal, +1 unstable
      const p = pole();
      if (p < -TOL) return -1;
      if (p > TOL) return 1;
      return 0;
    }
    function poleColour() { return regime() < 0 ? NAVY : OUT; }

    function drawImpulse() {
      const g = gL;
      g.clearRect(0, 0, WL, HL);

      // horizontal guides at h = 1, 2, 3, 4
      g.strokeStyle = GRID; g.lineWidth = 1;
      for (let v = 1; v <= VMAX; v++) {
        g.beginPath(); g.moveTo(LPADL, ty(v)); g.lineTo(WL - LPADR, ty(v)); g.stroke();
      }

      axis(g, LPADL - 12, WL - LPADR + 8, ty(0), "t");
      vaxis(g, LPADL, ty(0) + 8, ty(VMAX) - 8, "h(t)");

      // ticks
      g.font = "12px Arial"; g.fillStyle = GREY; g.strokeStyle = GREY;
      g.textAlign = "center";
      for (let t = 2; t <= TMAX; t += 2) {
        g.beginPath(); g.moveTo(tx(t), ty(0) - 3); g.lineTo(tx(t), ty(0) + 3); g.stroke();
        g.fillText(String(t), tx(t), ty(0) + 17);
      }
      g.textAlign = "right";
      for (let v = 1; v <= VMAX; v++) {
        g.beginPath(); g.moveTo(LPADL - 3, ty(v)); g.lineTo(LPADL + 3, ty(v)); g.stroke();
        g.fillText(String(v), LPADL - 7, ty(v) + 4);
      }
      g.fillText("0", LPADL - 7, ty(0) + 4);
      g.textAlign = "left";

      // h(t) = e^{p t}, drawn value clamped at VMAX, curve clipped to the panel
      const p = pole();
      clipRect(g, LPADL, ty(VMAX) - 1, WL - LPADL - LPADR, ty(0) - ty(VMAX) + 2);
      g.strokeStyle = NAVY; g.lineWidth = 2;
      g.beginPath();
      const N = WL - LPADL - LPADR;
      for (let px = 0; px <= N; px++) {
        const t = px * TMAX / N;
        const v = Math.min(Math.exp(p * t), VMAX);
        if (px === 0) g.moveTo(tx(t), ty(v)); else g.lineTo(tx(t), ty(v));
      }
      g.stroke();
      g.restore();

      rich(g, LPADL + 12, ty(VMAX) + 18,
           [["h(t) = e", ""], ["p t", "sup"], [" H(t)", ""]], 13, NAVY);
    }

    function drawPlane() {
      const g = gR;
      g.clearRect(0, 0, WR, HR);

      // the imaginary axis, kept light
      g.strokeStyle = GRID; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(rx(0), 22); g.lineTo(rx(0), HR - 22); g.stroke();

      axis(g, RPAD - 12, WR - RPAD + 8, rcy, "Re");
      g.fillStyle = GREY; g.font = "13px Arial"; g.textAlign = "left";
      g.fillText("Im", rx(0) + 7, 26);

      // unit ticks on the real axis
      g.strokeStyle = GREY; g.fillStyle = GREY; g.font = "12px Arial";
      g.textAlign = "center";
      [-1, 1].forEach(function (re) {
        g.beginPath(); g.moveTo(rx(re), rcy - 3.5); g.lineTo(rx(re), rcy + 3.5); g.stroke();
        g.fillText(re < 0 ? "−1" : "1", rx(re), rcy + 18);
      });
      g.textAlign = "left";

      // the pole, as a cross
      const p = pole(), col = poleColour();
      const X = rx(Math.max(-RMAX, Math.min(RMAX, p))), Y = ry(0), a = 7.5;
      g.strokeStyle = col; g.lineWidth = 2.4; g.lineCap = "round";
      g.beginPath();
      g.moveTo(X - a, Y - a); g.lineTo(X + a, Y + a);
      g.moveTo(X - a, Y + a); g.lineTo(X + a, Y - a);
      g.stroke();
      g.lineCap = "butt";

      rich(g, RPAD - 12, HR - 16,
           [["p = k", ""], ["r", "sub"], [" − k", ""], ["d", "sub"],
            [" = " + p.toFixed(2), ""]], 13, col);
    }

    // ---- controls -----------------------------------------------------------
    const sR = slider(host, 0, 1, 0.01, kr, 78);
    const sD = slider(host, 0, 1, 0.01, kd, 78);
    const note = noteBox(host);

    function draw() {
      sR.lab.textContent = "k_r = " + kr.toFixed(2);
      sD.lab.textContent = "k_d = " + kd.toFixed(2);
      const r = regime();
      note.textContent =
        (r < 0 ? "k_d > k_r: exponentially stable"
               : r > 0 ? "k_r > k_d: unstable"
                       : "k_r = k_d: marginally stable") +
        "   —   pole at p = " + pole().toFixed(2) +
        (r < 0 ? ", in the left half plane."
               : r > 0 ? ", in the right half plane."
                       : ", exactly on the imaginary axis.");
      drawImpulse(); drawPlane();
    }
    sR.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); kr = parseFloat(sR.sl.value); draw(); });
    sD.sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); kd = parseFloat(sD.sl.value); draw(); });

    draw();
  })();

  // ========================================================================
  // (b) the undamped pendulum: a closed orbit that never settles
  // ========================================================================
  (function () {
    const host = document.getElementById("w-pendulum-undamped"); if (!host) return;

    const WL = 300, HL = 230, WR = 400, HR = 230;
    const G = 9.81, L = 1;                  // m cancels, so it is not carried
    const DT = 0.002;                       // fixed integrator step, seconds
    const WIN = 12;                         // scrolling trace window, seconds
    const THMAX = 1.5;                      // vertical half range of the trace

    let th0 = 0.8;
    let th = th0, om = 0, simT = 0;
    let running = true, acc = 0, last = null;
    let trace = [[0, th0]];

    const row = panelRow(host);
    const gL = panel(row, WL, HL), gR = panel(row, WR, HR);

    // ---- left panel geometry: the pendulum itself
    const PX = WL / 2, PY = 44, ROD = 125, BOB = 11;

    // ---- right panel geometry: theta against t
    const RPADL = 44, RPADR = 22, RTOP = 30, RBOT = 200;
    const rcy = (RTOP + RBOT) / 2, RYS = (RBOT - RTOP) / 2 / THMAX;
    const rx = (t, t0) => RPADL + (t - t0) * (WR - RPADL - RPADR) / WIN;
    const ry = a => rcy - a * RYS;

    // velocity Verlet on thetaddot = -(g/L) sin(theta)
    function accel(a) { return -(G / L) * Math.sin(a); }
    function step() {
      const a0 = accel(th);
      th = th + om * DT + 0.5 * a0 * DT * DT;
      const a1 = accel(th);
      om = om + 0.5 * (a0 + a1) * DT;
      simT += DT;
    }

    function reset() {
      th = th0; om = 0; simT = 0; acc = 0; last = null;
      trace = [[0, th0]];
    }

    function drawPendulum() {
      const g = gL;
      g.clearRect(0, 0, WL, HL);

      // faint plumb line straight down from the pivot
      g.strokeStyle = GRID; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(PX, PY); g.lineTo(PX, PY + ROD + 34); g.stroke();

      const bx = PX + ROD * Math.sin(th), by = PY + ROD * Math.cos(th);

      g.strokeStyle = NAVY; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(PX, PY); g.lineTo(bx, by); g.stroke();

      g.fillStyle = NAVY;
      g.beginPath(); g.arc(bx, by, BOB, 0, 2 * Math.PI); g.fill();

      g.fillStyle = INK;
      g.beginPath(); g.arc(PX, PY, 3.6, 0, 2 * Math.PI); g.fill();

      g.fillStyle = GREY; g.font = "13px Arial"; g.textAlign = "center";
      g.fillText("θ = " + th.toFixed(2) + " rad", PX, HL - 12);
      g.textAlign = "left";
    }

    function drawTrace() {
      const g = gR;
      g.clearRect(0, 0, WR, HR);
      const t0 = Math.max(0, simT - WIN);

      // guides at theta = +-1
      g.strokeStyle = GRID; g.lineWidth = 1;
      [-1, 1].forEach(function (a) {
        g.beginPath(); g.moveTo(RPADL, ry(a)); g.lineTo(WR - RPADR, ry(a)); g.stroke();
      });

      axis(g, RPADL - 12, WR - RPADR + 8, rcy, "t");
      vaxis(g, RPADL, ry(-THMAX) + 6, ry(THMAX) - 6, "θ");

      g.font = "12px Arial"; g.fillStyle = GREY; g.strokeStyle = GREY;
      g.textAlign = "right";
      [-1, 1].forEach(function (a) {
        g.beginPath(); g.moveTo(RPADL - 3, ry(a)); g.lineTo(RPADL + 3, ry(a)); g.stroke();
        g.fillText(a < 0 ? "−1" : "1", RPADL - 7, ry(a) + 4);
      });
      g.fillText("0", RPADL - 7, rcy + 4);

      // time ticks every 2 s, at absolute times
      g.textAlign = "center";
      const first = Math.ceil(t0 / 2) * 2;
      for (let t = first; t <= t0 + WIN + 1e-9; t += 2) {
        if (t <= t0 + 0.001) continue;
        g.beginPath(); g.moveTo(rx(t, t0), rcy - 3); g.lineTo(rx(t, t0), rcy + 3); g.stroke();
        g.fillText(String(Math.round(t)), rx(t, t0), rcy + 17);
      }
      g.textAlign = "left";

      // the trace
      clipRect(g, RPADL, RTOP - 4, WR - RPADL - RPADR, RBOT - RTOP + 8);
      g.strokeStyle = NAVY; g.lineWidth = 1.8;
      g.beginPath();
      for (let i = 0; i < trace.length; i++) {
        const X = rx(trace[i][0], t0), Y = ry(trace[i][1]);
        if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
      g.restore();
    }

    function draw() { drawPendulum(); drawTrace(); }

    // ---- controls -----------------------------------------------------------
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:10px;font:13px Arial;color:" + INK;
    const btn = document.createElement("button");
    btn.style.cssText = "border:1px solid " + NAVY + ";background:#fff;color:" + NAVY +
      ";border-radius:5px;padding:3px 14px;cursor:pointer;font:13px Arial;min-width:72px;";
    bar.appendChild(btn); host.appendChild(bar);
    function paintBtn() { btn.textContent = running ? "Pause" : "Play"; }
    btn.addEventListener("click", function () {
      TRACK.hit(host.id, "play");
      running = !running; last = null; paintBtn();
    });

    const sA = slider(host, 0.1, 1.4, 0.01, th0, 96);
    sA.sl.addEventListener("input", function () {
      TRACK.hit(host.id, "slider");
      th0 = parseFloat(sA.sl.value);
      sA.lab.textContent = "θ(0) = " + th0.toFixed(2);
      reset(); draw();
    });

    function frame(ts) {
      if (running) {
        if (last === null) last = ts;
        let dtr = (ts - last) / 1000;
        last = ts;
        if (!(dtr >= 0)) dtr = 0;
        acc = Math.min(acc + dtr, 0.1);
        while (acc >= DT) { step(); acc -= DT; }
        trace.push([simT, th]);
        const t0 = Math.max(0, simT - WIN);
        let cut = 0;
        while (cut < trace.length - 1 && trace[cut + 1][0] < t0) cut++;
        if (cut > 0) trace = trace.slice(cut);
        draw();
      }
      window.requestAnimationFrame(frame);
    }

    paintBtn();
    sA.lab.textContent = "θ(0) = " + th0.toFixed(2);
    draw();
    window.requestAnimationFrame(frame);
  })();
})();
