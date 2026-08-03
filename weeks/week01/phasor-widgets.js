/* ELEC2302 Lecture 1 — interactive canvas widgets
   House style: navy #00468C primary, brick #C0392B secondary (output), thin guides.
   Each widget is self-contained and guarded by the presence of its container id,
   so slides may be reordered freely. Pure vanilla JS + canvas, no dependencies. */
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", ENV = "#b0b0b0", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-<name>  (e.g. widget-euler).
  //   Nothing is drawn on the page and nothing is logged to the console, so
  //   this is invisible to a reader. Repeated fiddling with the same widget
  //   sends nothing further: the question being answered is "how many people
  //   touched this widget", not "how many times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-euler is the
  //   count of distinct visitors who touched that widget. Divide it by the
  //   visits to the page itself to get the proportion who engaged.
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
    const WEEK = "week1";                      // namespaces events across weeks
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
  function arrow(ctx, x0, y0, x1, y1, color, lw) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = 9 + lw;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }
  // Text with an opaque backing, for labels that sit over a curve. Some
  // traces (the growing spiral in the e^{zt} panel) sweep the whole canvas,
  // so there is nowhere to move the label to; it has to sit on top instead.
  // Assumes a white page, which is what the Quarto theme gives us.
  function haloText(ctx, text, x, y, color) {
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x - 3, y - 12, w + 6, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function axes(ctx, cx, cy, x0, x1, y0, y1, xl, yl) {
    ctx.strokeStyle = GREY; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
    ctx.font = "13px Arial";
    // right-align the axis name to the end of the axis: fixed offsets clipped
    // multi-character names ("Re z") off the edge of the narrower canvases
    if (xl) haloText(ctx, xl, x1 - 4 - ctx.measureText(xl).width, cy - 6, GREY);
    if (yl) haloText(ctx, yl, cx + 6, y0 + 12, GREY);
  }
  function ctrlRow(host, label) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const btn = document.createElement("button");
    btn.textContent = "\u25B6 play";
    btn.style.cssText = "border:1px solid " + NAVY + ";color:" + NAVY +
      ";background:#fff;border-radius:5px;padding:3px 12px;cursor:pointer;font:14px Arial;";
    const sl = document.createElement("input");
    sl.type = "range";
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    bar.appendChild(btn);
    if (label) {
      const lb = document.createElement("span");
      lb.textContent = label;
      lb.style.cssText = "white-space:nowrap;color:" + INK + ";";
      bar.appendChild(lb);
    }
    bar.appendChild(sl);
    host.appendChild(bar);
    // usage tracking: every widget's play button and main slider come through
    // here, so instrumenting once covers all four. looper() sets sl.value
    // programmatically, which fires no "input" event, so animation is not
    // mistaken for a student moving the slider.
    sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); });
    btn.addEventListener("click", function () { TRACK.hit(host.id, "play"); });
    return { btn, sl };
  }
  function looper(btn, step) {
    let raf = null, last = 0;
    btn.addEventListener("click", function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; btn.textContent = "\u25B6 play"; return; }
      btn.textContent = "\u2759\u2759 pause"; last = performance.now();
      (function frame(now) {
        step((now - last) / 1000); last = now;
        raf = requestAnimationFrame(frame);
      })(last);
    });
    return () => { if (raf) { cancelAnimationFrame(raf); raf = null; btn.textContent = "\u25B6 play"; } };
  }
 
  // ========================================================================
  // (b) Euler rotating phasor:  e^{jθ} = cosθ + j sinθ
  // ========================================================================
  function euler() {
    const host = document.getElementById("w-euler"); if (!host) return;
    const W = 720, H = 340, cv = document.createElement("canvas");
    host.appendChild(cv); const ctx = dpiCanvas(cv, W, H);
    const cx = 150, cy = H / 2, R = 110, x0 = 300, xspan = 380, MAXT = 4 * Math.PI;
    function draw(th) {
      ctx.clearRect(0, 0, W, H);
      // unit circle
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
      axes(ctx, cx, cy, cx - R - 20, cx + R + 20, cy - R - 20, cy + R + 20, "Re", "Im");
      const tx = cx + R * Math.cos(th), ty = cy - R * Math.sin(th);
      // projections
      ctx.strokeStyle = GREY; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, cy); ctx.stroke();      // to Re axis (cos)
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, ty); ctx.stroke();      // to Im axis (sin)
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x0, ty); ctx.stroke();      // link to waveform
      ctx.setLineDash([]);
      arrow(ctx, cx, cy, tx, ty, NAVY, 3);
      // waveform: sinθ unrolling to the right (history trails right)
      axes(ctx, x0, cy, x0 - 6, x0 + xspan, cy - R - 20, cy + R + 20, "\u03B8", "");
      // the trace stops short of the axis tip so it cannot run through the \u03B8 label
      const tspan = xspan - 26;
      ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.beginPath();
      for (let u = 0; u <= tspan; u++) {
        const val = Math.sin(th - u / tspan * MAXT);
        const px = x0 + u, py = cy - R * val;
        u ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.arc(x0, cy - R * Math.sin(th), 4, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = INK; ctx.font = "14px Arial";
      ctx.fillText("e^{j\u03B8} = cos\u03B8 + j sin\u03B8", cx - 78, cy + R + 42);
    }
    const { btn, sl } = ctrlRow(host, "θ");
    sl.min = 0; sl.max = MAXT; sl.step = 0.01; sl.value = 0.9;
    sl.addEventListener("input", () => draw(parseFloat(sl.value)));
    looper(btn, dt => {
      let t = parseFloat(sl.value) + dt * 1.6; if (t > MAXT) t = 0;
      sl.value = t; draw(t);
    });
    draw(parseFloat(sl.value));
  }
 
  // ========================================================================
  // (b) Phasor sum:  3e^{jωt} + 4je^{jωt} = 5e^{j0.927}e^{jωt}
  //     Stacked layout: phasor diagram on top, x(t) = Re(...) unrolling
  //     downwards beneath it, sharing the same horizontal Re axis. The real
  //     part is therefore read off VERTICALLY: a plumb line dropped from the
  //     tip of the resultant lands exactly on the pen of the waveform.
  // ========================================================================
  function sum() {
    const host = document.getElementById("w-sum"); if (!host) return;
    const W = 460, H = 640, cv = document.createElement("canvas");
    host.appendChild(cv); const ctx = dpiCanvas(cv, W, H);
    const cx = W / 2, cy = 175, S = 26;                    // phasor origin, px per unit
    const yTop = 330, yBot = 620, tspan = yBot - yTop;     // t = 0 at yTop, increasing down
    const MAXT = 4 * Math.PI;
    const A1 = 3, A2 = 4, ph2 = Math.PI / 2, Ar = 5, phr = Math.atan2(4, 3);
    // label at the midpoint of a segment, offset perpendicular to it
    function segLabel(text, ax, ay, bx, by, color, off) {
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = color;
      ctx.fillText(text,
        (ax + bx) / 2 - dy / L * off - ctx.measureText(text).width / 2,
        (ay + by) / 2 + dx / L * off + 4);
    }
    function draw(th) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, cx, cy, cx - 6 * S, cx + 6 * S, cy - 5.6 * S, cy + 5.6 * S, "Re", "Im");
      // P1 = 3 at angle th
      const p1x = cx + S * A1 * Math.cos(th), p1y = cy - S * A1 * Math.sin(th);
      // P2 = 4 at angle th+90, drawn tip-to-tail from P1
      const p2x = p1x + S * A2 * Math.cos(th + ph2), p2y = p1y - S * A2 * Math.sin(th + ph2);
      // resultant = 5 at angle th+phr (coincides with the tip of P2)
      const rx = cx + S * Ar * Math.cos(th + phr), ry = cy - S * Ar * Math.sin(th + phr);
      arrow(ctx, cx, cy, p1x, p1y, NAVY, 2);
      arrow(ctx, p1x, p1y, p2x, p2y, OUT, 2);
      arrow(ctx, cx, cy, rx, ry, "#111", 3);
      ctx.font = "13px Arial";
      segLabel("3", cx, cy, p1x, p1y, NAVY, 14);
      segLabel("4j", p1x, p1y, p2x, p2y, OUT, 14);
      segLabel("5∠ 0.927", cx, cy, rx, ry, "#111", -18);
      // read-off: plumb line from the tip of the resultant straight down to the trace
      ctx.strokeStyle = GREY; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, yTop); ctx.stroke();
      ctx.setLineDash([]);
      // waveform of Re(resultant) = 5 cos(ωt + 0.927): value horizontal, time downwards
      arrow(ctx, cx - 6 * S, yTop, cx + 6 * S, yTop, GREY, 1);   // x axis, shares Re
      arrow(ctx, cx, yTop, cx, yBot, GREY, 1);                   // t axis, downwards
      ctx.fillStyle = GREY; ctx.font = "13px Arial";
      ctx.fillText("x", cx + 6 * S - 18, yTop - 8);
      ctx.fillText("ωt", cx + 5.6 * S, yBot - 6);   // right of the trace envelope
      ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath();
      for (let v = 0; v <= tspan; v++) {
        const val = Ar * Math.cos(th - v / tspan * MAXT + phr);
        const px = cx + S * val, py = yTop + v;
        v ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      // pen sits at v = 0, i.e. x = cx + S*Ar*cos(th + phr) = rx exactly
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(rx, yTop, 4, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = INK; ctx.font = "14px Arial";
      ctx.fillText("x(t) = Re(5e^{j0.927} e^{jωt}) = 5 cos(ωt + 0.927)", 6, H - 8);
    }
    const { btn, sl } = ctrlRow(host, "ωt");
    sl.min = 0; sl.max = MAXT; sl.step = 0.01; sl.value = 0.6;
    sl.addEventListener("input", () => draw(parseFloat(sl.value)));
    looper(btn, dt => { let t = parseFloat(sl.value) + dt * 1.4; if (t > MAXT) t = 0; sl.value = t; draw(t); });
    draw(parseFloat(sl.value));
  }
 
  // ========================================================================
  // (c) e^{zt} geography: drag z, watch the ℂ-trajectory and Re(e^{zt}) vs t
  // ========================================================================
  function ezt() {
    const host = document.getElementById("w-ezt"); if (!host) return;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;";
    host.appendChild(row);
    const Wz = 220, Wc = 220, Ww = 300, H = 260;
    const cz = document.createElement("canvas"), cc = document.createElement("canvas"), cw = document.createElement("canvas");
    [cz, cc, cw].forEach(c => { const d = document.createElement("div"); d.appendChild(c); row.appendChild(d); });
    const gz = dpiCanvas(cz, Wz, H), gc = dpiCanvas(cc, Wc, H), gw = dpiCanvas(cw, Ww, H);
    const T = 8, N = 500;
    let z = { re: 0.0, im: 1.0 }, tAnim = 0;
    // z-plane mapping: re in [-2,2], im in [-2.5,2.5]
    const zx = re => Wz / 2 + re / 2 * (Wz / 2 - 16);
    const zy = im => H / 2 - im / 2.5 * (H / 2 - 16);
    const zinv = (px, py) => ({ re: (px - Wz / 2) / (Wz / 2 - 16) * 2, im: -(py - H / 2) / (H / 2 - 16) * 2.5 });
 
    function drawZ() {
      gz.clearRect(0, 0, Wz, H);
      // shade left (Re z<0) = decay region
      gz.fillStyle = "rgba(0,70,140,0.06)"; gz.fillRect(0, 0, Wz / 2, H);
      gz.fillStyle = "#9aa"; gz.font = "12px Arial";
      gz.fillText("decay", 10, 18); gz.fillText("growth", Wz - 54, 18);
      axes(gz, Wz / 2, H / 2, 6, Wz - 6, 8, H - 8, "Re z", "Im z");
      arrow(gz, Wz / 2, H / 2, zx(z.re), zy(z.im), NAVY, 2);
      gz.fillStyle = NAVY; gz.beginPath(); gz.arc(zx(z.re), zy(z.im), 6, 0, 2 * Math.PI); gz.fill();
      gz.fillStyle = INK; gz.font = "13px Arial";
      gz.fillText("z = " + z.re.toFixed(2) + (z.im >= 0 ? " + " : " \u2212 ") + Math.abs(z.im).toFixed(2) + "j", 8, H - 8);
    }
    function drawC() {
      gc.clearRect(0, 0, Wc, H);
      axes(gc, Wc / 2, H / 2, 6, Wc - 6, 8, H - 8, "Re", "Im");
      const sc = (Wc / 2 - 16) / 3; // view ±3
      gc.strokeStyle = "rgba(0,70,140,0.35)"; gc.lineWidth = 1.5; gc.beginPath();
      let started = false;
      for (let i = 0; i <= N; i++) {
        const t = i / N * T, v = Math.exp(z.re * t);
        const px = Wc / 2 + sc * v * Math.cos(z.im * t), py = H / 2 - sc * v * Math.sin(z.im * t);
        if (Math.abs(px) > 4 * Wc || Math.abs(py) > 4 * H) { started = false; continue; }
        started ? gc.lineTo(px, py) : gc.moveTo(px, py); started = true;
      }
      gc.stroke();
      const v = Math.exp(z.re * tAnim);
      const px = Wc / 2 + sc * v * Math.cos(z.im * tAnim), py = H / 2 - sc * v * Math.sin(z.im * tAnim);
      arrow(gc, Wc / 2, H / 2, px, py, NAVY, 2);
      gc.font = "13px Arial"; haloText(gc, "e^{zt} in \u2102", 8, H - 8, INK);
    }
    function drawW() {
      gw.clearRect(0, 0, Ww, H);
      axes(gw, 30, H / 2, 24, Ww - 6, 8, H - 8, "t", "");
      // stop the trace short of the axis tip so the "t" label stays clear of it
      const xt = t => 30 + t / T * (Ww - 70);
      // ysc leaves a top band clear for the label, same fix as the RLC panel
      const A = 1.0, yc = H / 2, ysc = (H / 2 - 30);
      // envelope
      let emax = 0; for (let i = 0; i <= N; i++) emax = Math.max(emax, Math.exp(z.re * (i / N * T)));
      const norm = ysc / Math.max(1.0, emax);
      gw.strokeStyle = ENV; gw.setLineDash([5, 4]); gw.lineWidth = 1;
      for (const s of [1, -1]) {
        gw.beginPath();
        for (let i = 0; i <= N; i++) { const t = i / N * T; const y = yc - s * norm * Math.exp(z.re * t); i ? gw.lineTo(xt(t), y) : gw.moveTo(xt(t), y); }
        gw.stroke();
      }
      gw.setLineDash([]);
      // Re(e^{zt}) = e^{re t} cos(im t)
      gw.strokeStyle = NAVY; gw.lineWidth = 2; gw.beginPath();
      for (let i = 0; i <= N; i++) { const t = i / N * T; const y = yc - norm * Math.exp(z.re * t) * Math.cos(z.im * t); i ? gw.lineTo(xt(t), y) : gw.moveTo(xt(t), y); }
      gw.stroke();
      // pen
      const yp = yc - norm * Math.exp(z.re * tAnim) * Math.cos(z.im * tAnim);
      gw.fillStyle = NAVY; gw.beginPath(); gw.arc(xt(tAnim), yp, 4, 0, 2 * Math.PI); gw.fill();
      gw.fillStyle = INK; gw.font = "13px Arial"; gw.fillText("Re(e^{zt}) vs t", 34, 16);
    }
    function redraw() { drawZ(); drawC(); drawW(); }
 
    // preset chips
    const chips = document.createElement("div");
    chips.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;";
    [["z = j  (oscillate)", 0, 1], ["z = \u22121  (decay)", -1, 0],
     ["z = \u22121+j  (damped)", -1, 1], ["z = 0.15+j  (grow)", 0.15, 1]].forEach(([lab, re, im]) => {
      const b = document.createElement("button");
      b.textContent = lab;
      b.style.cssText = "border:1px solid " + NAVY + ";color:" + NAVY + ";background:#fff;border-radius:5px;padding:3px 10px;cursor:pointer;font:13px Arial;";
      b.addEventListener("click", () => { TRACK.hit(host.id, "preset"); z = { re, im }; tAnim = 0; sl.value = 0; redraw(); });
      chips.appendChild(b);
    });
    host.appendChild(chips);
    const { btn, sl } = ctrlRow(host);
    sl.min = 0; sl.max = T; sl.step = 0.01; sl.value = 0;
    sl.addEventListener("input", () => { tAnim = parseFloat(sl.value); drawC(); drawW(); });
    looper(btn, dt => { tAnim += dt * 1.2; if (tAnim > T) tAnim = 0; sl.value = tAnim; drawC(); drawW(); });
 
    // drag z
    function pick(ev) {
      const r = cz.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      const p = zinv(px, py);
      TRACK.hit(host.id, "drag");
      z = { re: Math.max(-2, Math.min(2, p.re)), im: Math.max(-2.5, Math.min(2.5, p.im)) };
      redraw();
    }
    let drag = false;
    cz.style.cursor = "pointer";
    cz.addEventListener("mousedown", e => { drag = true; pick(e); });
    window.addEventListener("mousemove", e => { if (drag) pick(e); });
    window.addEventListener("mouseup", () => { drag = false; });
    cz.addEventListener("touchstart", e => { drag = true; pick(e); e.preventDefault(); }, { passive: false });
    cz.addEventListener("touchmove", e => { if (drag) { pick(e); e.preventDefault(); } }, { passive: false });
    cz.addEventListener("touchend", () => { drag = false; });
    redraw();
  }
 
  // ========================================================================
  // (d) RLC eigenfunction: input Ve^{jωt} -> output Ie^{jωt}; same frequency
  // ========================================================================
  function rlc() {
    const host = document.getElementById("w-rlc"); if (!host) return;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;";
    host.appendChild(row);
    const Wp = 260, Ww = 400, H = 300;
    const cp = document.createElement("canvas"), cw = document.createElement("canvas");
    [cp, cw].forEach(c => { const d = document.createElement("div"); d.appendChild(c); row.appendChild(d); });
    const gp = dpiCanvas(cp, Wp, H), gw = dpiCanvas(cw, Ww, H);
    const R = 30; let X = 40, th = 0.6, normalise = true;
    function Zmag() { return Math.hypot(R, X); }
    function Zang() { return Math.atan2(X, R); }         // ∠Z
    const MAXT = 4 * Math.PI;
    // Output amplitude relative to the input, plotting i(t) in units of V/R:
    //   |i| = V/|Z|, and one unit of the vertical scale is V/R,
    //   so the drawn amplitude is R/|Z|  ->  1 when X = 0, falling as |X| grows.
    // This is the same scaling the phasor arrow uses, so the two panels agree.
    function outAmp() { return normalise ? 1 : R / Zmag(); }
    function drawP() {
      gp.clearRect(0, 0, Wp, H);
      // Labels go in a fixed legend rather than at the arrow tips. The arrows
      // rotate through every angle, and in a panel this narrow a tip label
      // either runs off the edge or lies along the arrow it is labelling;
      // colour carries the association instead. Same legend position as the
      // waveform panel alongside, so the two read as a pair.
      const TOP = 46, BOT = 26;
      const cx = Wp / 2, cy = (TOP + (H - BOT)) / 2, Rp = 100;
      axes(gp, cx, cy, cx - Rp - 18, cx + Rp + 18, cy - Rp - 18, cy + Rp + 18, "Re", "Im");
      // input V-phasor (unit), output I-phasor lags by ∠Z, length 1/|Z| scaled up for visibility
      const vx = cx + Rp * Math.cos(th), vy = cy - Rp * Math.sin(th);
      const iang = th - Zang(), iLen = Rp * (R / Zmag()); // display length ∝ |I||Z_ref|; keeps <=Rp
      const ix = cx + iLen * Math.cos(iang), iy = cy - iLen * Math.sin(iang);
      arrow(gp, cx, cy, vx, vy, NAVY, 3);
      arrow(gp, cx, cy, ix, iy, OUT, 3);
      gp.font = "13px Arial";
      gp.fillStyle = NAVY; gp.fillText("V e^{j\u03C9t}", 8, 18);
      gp.fillStyle = OUT;  gp.fillText("I e^{j\u03C9t}", 8, 36);
      gp.fillStyle = INK;
      gp.fillText("lag \u2220Z = " + Zang().toFixed(2) + " rad", 8, H - 8);
    }
    function drawW() {
      gw.clearRect(0, 0, Ww, H);
      // Reserve a band at the top for the two curve labels and a band at the
      // bottom for the readout, then fit the trace between them. Previously
      // amp ran to within 20px of the edge, so the peaks ran straight through
      // the labels and the last caption line fell off the bottom entirely.
      const TOP = 46, BOT = 46;
      const cy = (TOP + (H - BOT)) / 2, amp = (H - BOT - TOP) / 2 - 6;
      const x0 = 30, span = Ww - 40;
      axes(gw, x0, cy, x0 - 6, x0 + span + 6, cy - amp - 8, cy + amp + 8, "\u03C9t", "");
      // v(t) = cos ωt in navy; i(t) = A cos(ωt − ∠Z) in brick, where A is 1
      // when normalised and R/|Z| when showing true relative amplitude
      const tspan = span - 30;   // keeps the trace clear of the ωt axis label
      const A = outAmp();
      // faint guide at the input amplitude, so the shrinkage is readable
      if (!normalise) {
        gw.strokeStyle = ENV; gw.setLineDash([5, 4]); gw.lineWidth = 1;
        for (const s of [1, -1]) {
          gw.beginPath(); gw.moveTo(x0, cy - s * amp); gw.lineTo(x0 + tspan, cy - s * amp); gw.stroke();
        }
        gw.setLineDash([]);
      }
      for (const [ph, col, lw, a] of [[0, NAVY, 2.4, 1], [-Zang(), OUT, 2.4, A]]) {
        gw.strokeStyle = col; gw.lineWidth = lw; gw.beginPath();
        for (let u = 0; u <= tspan; u++) {
          const val = a * Math.cos(th - u / tspan * MAXT + ph);
          const px = x0 + u, py = cy - amp * val;
          u ? gw.lineTo(px, py) : gw.moveTo(px, py);
        }
        gw.stroke();
      }
      // labels live in the reserved bands, clear of the trace
      gw.font = "13px Arial";
      gw.fillStyle = NAVY; gw.fillText("v(t) / V = cos \u03C9t", x0 + 6, 18);
      gw.fillStyle = OUT; gw.fillText(normalise
        ? "i(t), rescaled = cos(\u03C9t \u2212 \u2220Z)"
        : "i(t) \u00B7 R/V = (R/|Z|) cos(\u03C9t \u2212 \u2220Z)", x0 + 6, 36);
      gw.fillStyle = INK;
      gw.fillText("|Z| = " + Zmag().toFixed(1) + "   \u2220Z = " + Zang().toFixed(3) + " rad", x0 + 6, H - 26);
      gw.fillStyle = "#666"; gw.font = "12px Arial";
      gw.fillText(normalise
        ? "(normalised; true output = " + (R / Zmag()).toFixed(2) + " \u00D7 input)"
        : "(true amplitude R/|Z| = " + (R / Zmag()).toFixed(2) + "; dashed = input)",
        x0 + 6, H - 8);
    }
    function redraw() { drawP(); drawW(); }
    // reactance slider
    const xrow = document.createElement("div");
    xrow.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const xlab = document.createElement("span");
    const xsl = document.createElement("input"); xsl.type = "range"; xsl.min = -60; xsl.max = 60; xsl.step = 1; xsl.value = X;
    xsl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    function setX() { X = parseFloat(xsl.value); xlab.textContent = "reactance  \u03C9L \u2212 1/\u03C9C = " + X + " \u03A9"; redraw(); }
    xsl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); setX(); });
    xrow.appendChild(xlab); xrow.appendChild(xsl); host.appendChild(xrow);

    // normalisation toggle: off shows the output at its true size relative to
    // the input, which is the point students usually miss when both curves are
    // drawn the same height
    const nrow = document.createElement("div");
    nrow.style.cssText = "margin-top:6px;font:14px Arial;color:" + INK + ";";
    const nlab = document.createElement("label");
    nlab.style.cssText = "display:inline-flex;align-items:center;gap:7px;cursor:pointer;";
    const ncb = document.createElement("input");
    ncb.type = "checkbox"; ncb.checked = normalise;
    ncb.style.cssText = "accent-color:" + NAVY + ";cursor:pointer;";
    nlab.appendChild(ncb);
    nlab.appendChild(document.createTextNode("normalise output amplitude"));
    nrow.appendChild(nlab); host.appendChild(nrow);
    ncb.addEventListener("change", function () {
      TRACK.hit(host.id, "slider");
      normalise = ncb.checked;
      redraw();
    });

    const { btn, sl } = ctrlRow(host);
    sl.min = 0; sl.max = MAXT; sl.step = 0.01; sl.value = th;
    sl.addEventListener("input", () => { th = parseFloat(sl.value); redraw(); });
    looper(btn, dt => { th += dt * 1.4; if (th > MAXT) th = 0; sl.value = th; redraw(); });
    setX();
  }
 
  function init() { euler(); sum(); ezt(); rlc(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
