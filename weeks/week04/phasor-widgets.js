/* ELEC2302 — interactive canvas widgets (Lectures 1 & 4)
   House style: navy #00468C primary, brick #C0392B secondary (output), thin guides.
   Each widget is self-contained and guarded by the presence of its container id,
   so slides may be reordered freely. Pure vanilla JS + canvas, no dependencies. */
(function () {
  "use strict";
  const NAVY = "#00468C", OUT = "#C0392B", GREY = "#8a8a8a",
        GRID = "#e8e8ec", ENV = "#b0b0b0", GHOST = "#c9c9d0", INK = "#222";

  // ---- usage tracking -----------------------------------------------------
  //
  //   WHAT THIS RECORDS
  //   The first time a visitor interacts with a widget on a page load, one
  //   GoatCounter event is sent, named  widget-week4-<name>  (e.g.
  //   widget-week4-square). Nothing is drawn on the page and nothing is
  //   logged to the console, so this is invisible to a reader. Repeated
  //   fiddling with the same widget sends nothing further: the question
  //   being answered is "how many people touched this widget", not "how many
  //   times was it dragged".
  //
  //   HOW TO READ IT
  //   Dashboard: https://<yoursite>.goatcounter.com  ->  the event paths are
  //   listed alongside pages. The "visits" number for widget-week4-square is
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
    const WEEK = "week4";                      // namespaces events across weeks
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
  function axes(ctx, cx, cy, x0, x1, y0, y1, xl, yl) {
    ctx.strokeStyle = GREY; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
    ctx.fillStyle = GREY; ctx.font = "13px Arial";
    if (xl) ctx.fillText(xl, x1 - 14, cy - 6);
    if (yl) ctx.fillText(yl, cx + 6, y0 + 12);
  }
  function ctrlRow(host) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:8px;font:14px Arial;color:" + INK;
    const btn = document.createElement("button");
    btn.textContent = "\u25B6 play";
    btn.style.cssText = "border:1px solid " + NAVY + ";color:" + NAVY +
      ";background:#fff;border-radius:5px;padding:3px 12px;cursor:pointer;font:14px Arial;";
    const sl = document.createElement("input");
    sl.type = "range";
    sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    bar.appendChild(btn); bar.appendChild(sl);
    host.appendChild(bar);
    // usage tracking: every widget's play button and main slider come through
    // here, so instrumenting once covers all of them. looper() sets sl.value
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
      ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.beginPath();
      for (let u = 0; u <= xspan; u++) {
        const val = Math.sin(th - u / xspan * MAXT);
        const px = x0 + u, py = cy - R * val;
        u ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.arc(x0, cy - R * Math.sin(th), 4, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = INK; ctx.font = "14px Arial";
      ctx.fillText("e^{j\u03B8} = cos\u03B8 + j sin\u03B8", cx - 78, cy + R + 42);
    }
    const { btn, sl } = ctrlRow(host);
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
  // ========================================================================
  function sum() {
    const host = document.getElementById("w-sum"); if (!host) return;
    const W = 720, H = 340, cv = document.createElement("canvas");
    host.appendChild(cv); const ctx = dpiCanvas(cv, W, H);
    const cx = 160, cy = H / 2, S = 26, x0 = 320, xspan = 360, MAXT = 4 * Math.PI;
    const A1 = 3, A2 = 4, ph2 = Math.PI / 2, Ar = 5, phr = Math.atan2(4, 3);
    function draw(th) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, cx, cy, cx - 7 * S, cx + 7 * S, cy - 6 * S, cy + 6 * S, "Re", "Im");
      // P1 = 3 at angle th
      const p1x = cx + S * A1 * Math.cos(th), p1y = cy - S * A1 * Math.sin(th);
      // P2 = 4 at angle th+90, drawn tip-to-tail from P1
      const p2x = p1x + S * A2 * Math.cos(th + ph2), p2y = p1y - S * A2 * Math.sin(th + ph2);
      // resultant = 5 at angle th+phr
      const rx = cx + S * Ar * Math.cos(th + phr), ry = cy - S * Ar * Math.sin(th + phr);
      arrow(ctx, cx, cy, p1x, p1y, NAVY, 2);
      arrow(ctx, p1x, p1y, p2x, p2y, OUT, 2);
      arrow(ctx, cx, cy, rx, ry, "#111", 3);
      // waveform of Re(resultant) = 5 cos(ωt + 0.927)
      axes(ctx, x0, cy, x0 - 6, x0 + xspan, cy - 6 * S, cy + 6 * S, "\u03C9t", "");
      ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath();
      for (let u = 0; u <= xspan; u++) {
        const val = Ar * Math.cos(th - u / xspan * MAXT + phr);
        const px = x0 + u, py = cy - S * val;
        u ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = GREY; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(x0, cy - S * Ar * Math.sin(th + phr)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(x0, cy - S * Ar * Math.sin(th + phr), 4, 0, 2 * Math.PI); ctx.fill();
      ctx.font = "13px Arial";
      ctx.fillStyle = NAVY; ctx.fillText("3", cx + 6, cy + 16);
      ctx.fillStyle = OUT; ctx.fillText("4j", p1x + 8, (p1y + p2y) / 2);
      ctx.fillStyle = "#111"; ctx.fillText("5\u2220 0.927", (cx + rx) / 2 - 6, (cy + ry) / 2 - 6);
      ctx.fillStyle = INK; ctx.font = "14px Arial";
      ctx.fillText("x(t) = 5 cos(\u03C9t + 0.927)", x0 + 30, cy - 6 * S + 6);
    }
    const { btn, sl } = ctrlRow(host);
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
      gc.fillStyle = INK; gc.font = "13px Arial"; gc.fillText("e^{zt} in \u2102", 8, H - 8);
    }
    function drawW() {
      gw.clearRect(0, 0, Ww, H);
      axes(gw, 30, H / 2, 24, Ww - 6, 8, H - 8, "t", "");
      const xt = t => 30 + t / T * (Ww - 40);
      const A = 1.0, yc = H / 2, ysc = (H / 2 - 16);
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
    const R = 30; let X = 40, th = 0.6;
    function Zmag() { return Math.hypot(R, X); }
    function Zang() { return Math.atan2(X, R); }         // ∠Z
    const MAXT = 4 * Math.PI;
    function drawP() {
      gp.clearRect(0, 0, Wp, H);
      const cx = Wp / 2, cy = H / 2, Rp = 100;
      axes(gp, cx, cy, cx - Rp - 18, cx + Rp + 18, cy - Rp - 18, cy + Rp + 18, "Re", "Im");
      // input V-phasor (unit), output I-phasor lags by ∠Z, length 1/|Z| scaled up for visibility
      const vx = cx + Rp * Math.cos(th), vy = cy - Rp * Math.sin(th);
      const iang = th - Zang(), iLen = Rp * (R / Zmag()); // display length ∝ |I||Z_ref|; keeps <=Rp
      const ix = cx + iLen * Math.cos(iang), iy = cy - iLen * Math.sin(iang);
      arrow(gp, cx, cy, vx, vy, NAVY, 3);
      arrow(gp, cx, cy, ix, iy, OUT, 3);
      gp.fillStyle = NAVY; gp.font = "13px Arial"; gp.fillText("V e^{j\u03C9t}", vx + 6, vy);
      gp.fillStyle = OUT; gp.fillText("I e^{j\u03C9t}", ix + 6, iy + 4);
      gp.fillStyle = INK; gp.font = "13px Arial";
      gp.fillText("lag \u2220Z = " + Zang().toFixed(2) + " rad", 8, H - 8);
    }
    function drawW() {
      gw.clearRect(0, 0, Ww, H);
      const cy = H / 2, amp = H / 2 - 20, x0 = 30, span = Ww - 40;
      axes(gw, x0, cy, x0 - 6, x0 + span + 6, cy - amp - 8, cy + amp + 8, "\u03C9t", "");
      // v(t)=cos(ωt) navy ; i(t)=cos(ωt-∠Z) normalised (amplitude shown as text)
      for (const [ph, col, lw] of [[0, NAVY, 2.4], [-Zang(), OUT, 2.4]]) {
        gw.strokeStyle = col; gw.lineWidth = lw; gw.beginPath();
        for (let u = 0; u <= span; u++) {
          const val = Math.cos(th - u / span * MAXT + ph);
          const px = x0 + u, py = cy - amp * val;
          u ? gw.lineTo(px, py) : gw.moveTo(px, py);
        }
        gw.stroke();
      }
      gw.font = "13px Arial";
      gw.fillStyle = NAVY; gw.fillText("v(t) = V cos \u03C9t", x0 + 6, cy - amp + 2);
      gw.fillStyle = OUT; gw.fillText("i(t) = (V/|Z|) cos(\u03C9t \u2212 \u2220Z)", x0 + 6, cy - amp + 20);
      gw.fillStyle = INK;
      gw.fillText("|Z| = " + Zmag().toFixed(1) + "   \u2220Z = " + Zang().toFixed(3) + " rad", x0 + 6, cy + amp + 4);
      gw.fillStyle = "#666"; gw.font = "12px Arial";
      gw.fillText("(waveforms normalised; true output amplitude = V/|Z|)", x0 + 6, cy + amp + 22);
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
    const { btn, sl } = ctrlRow(host);
    sl.min = 0; sl.max = MAXT; sl.step = 0.01; sl.value = th;
    sl.addEventListener("input", () => { th = parseFloat(sl.value); redraw(); });
    looper(btn, dt => { th += dt * 1.4; if (th > MAXT) th = 0; sl.value = th; redraw(); });
    setX();
  }

  // ========================================================================
  // (L4) Square-wave builder — Gibbs phenomenon.
  //   Reused, near-verbatim, from the project's square-wave-builder.html.
  //   Odd (sine-series) square wave: (4/π) Σ_{n=1..N} sin((2n−1)x)/(2n−1).
  //   Guarded by container id "w-square".
  // ========================================================================
  function squareBuilder() {
    const host = document.getElementById("w-square"); if (!host) return;
    const cv = document.createElement("canvas");
    host.appendChild(cv);

    // slider + live count (no play button for this one)
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:12px;margin-top:10px;font:14px Arial;color:" + INK;
    const sl = document.createElement("input");
    sl.type = "range"; sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    const count = document.createElement("span");
    count.style.cssText = "min-width:82px;text-align:right;font-variant-numeric:tabular-nums;";
    bar.appendChild(sl); bar.appendChild(count); host.appendChild(bar);

    const MAXN = 60;
    sl.min = 1; sl.max = MAXN; sl.step = 1; sl.value = 3;

    const X0 = -Math.PI, X1 = 3 * Math.PI;   // two full periods
    let ctx, W, H;

    // partial sum of the +/-1 square wave:  (4/pi) * sum_{n=1..N} sin((2n-1)x)/(2n-1)
    function partial(x, N) {
      let s = 0;
      for (let n = 1; n <= N; n++) {
        const k = 2 * n - 1;
        s += Math.sin(k * x) / k;
      }
      return (4 / Math.PI) * s;
    }
    function square(x) {
      const s = Math.sin(x);
      return s > 1e-9 ? 1 : (s < -1e-9 ? -1 : 0);
    }

    function draw() {
      const N = parseInt(sl.value, 10);
      count.textContent = "waves: " + N;
      ctx.clearRect(0, 0, W, H);

      const mL = 18, mR = 14, mT = 18, mB = 14;
      const pw = W - mL - mR, ph = H - mT - mB;
      const yc = mT + ph / 2;
      const yScale = (ph / 2) / 1.32;                 // headroom for the overshoot
      const xPix = x => mL + (x - X0) / (X1 - X0) * pw;
      const yPix = v => yc - v * yScale;

      // baseline
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mL, yc); ctx.lineTo(mL + pw, yc); ctx.stroke();

      // ghost target square wave
      ctx.strokeStyle = GHOST; ctx.lineWidth = 2;
      ctx.beginPath();
      const edges = [X0, 0, Math.PI, 2 * Math.PI, X1];
      ctx.moveTo(xPix(X0), yPix(square(X0 + 1e-3)));
      for (let i = 0; i < edges.length - 1; i++) {
        const a = edges[i], b = edges[i + 1], lvl = square((a + b) / 2);
        ctx.lineTo(xPix(a), yPix(lvl));
        ctx.lineTo(xPix(b), yPix(lvl));
      }
      ctx.stroke();

      // reconstruction from N waves
      const M = 1300;
      ctx.strokeStyle = NAVY; ctx.lineWidth = 2.3; ctx.beginPath();
      let peakV = -Infinity, peakX = 0;
      for (let i = 0; i <= M; i++) {
        const x = X0 + (X1 - X0) * i / M;
        const v = partial(x, N);
        const px = xPix(x), py = yPix(v);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        if (x > 0.02 && x < Math.PI / 2 && v > peakV) { peakV = v; peakX = x; }
      }
      ctx.stroke();

      // draw the eye to the little peak that never leaves
      if (peakV > 1.0) {
        ctx.fillStyle = OUT;
        ctx.beginPath();
        ctx.arc(xPix(peakX), yPix(peakV), 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    function resize() {
      W = Math.max(300, Math.min(720, Math.floor(host.clientWidth) || 720));
      H = Math.round(W * 0.46);
      ctx = dpiCanvas(cv, W, H);
      draw();
    }

    sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); draw(); });
    let rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
    resize();
  }

  // ========================================================================
  // (L4) RLC-filtered square wave: build the OUTPUT current harmonic by harmonic.
  //   Input  v(t) = Σ_{k odd} c_k e^{jkωt},  c_k = sinc(k/2) = sin(kπ/2)/(kπ/2)
  //   System φ_k ↦ φ_k / Z(jkω),  Z(jkω) = R + j(kωL − 1/(kωC))
  //   Output i(t) = Σ_{k odd} c_k e^{jkωt} / Z(jkω)   (real part built up)
  //   Component values R,L,C chosen so ω_n = 1/√(LC) ≈ 1 rad/s ≈ fundamental.
  //   Guarded by container id "w-rlc-out".  [NEW WIDGET — verify geometry.]
  // ========================================================================
  function rlcHarmonics() {
    const host = document.getElementById("w-rlc-out"); if (!host) return;
    const cv = document.createElement("canvas");
    host.appendChild(cv);

    // Component values: ω_n = 1/sqrt(LC) = 2 rad/s (between the 1st and 3rd harmonics of the
    // T=2π square wave). This deliberately lets the first few odd harmonics through with
    // decreasing weight (3rd ≈ 46% of the fundamental), so the OUTPUT visibly builds up
    // harmonic by harmonic — not just the input. A resonance sitting exactly on the
    // fundamental would make the output a near-pure sinusoid that barely changes with N.
    const R = 1.0, L = 0.5, C = 0.5, w = 1.0;
    const wn = 1 / Math.sqrt(L * C);

    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:12px;margin-top:10px;font:14px Arial;color:" + INK;
    const sl = document.createElement("input");
    sl.type = "range"; sl.style.cssText = "flex:1;accent-color:" + NAVY + ";";
    const count = document.createElement("span");
    count.style.cssText = "min-width:96px;text-align:right;font-variant-numeric:tabular-nums;";
    bar.appendChild(sl); bar.appendChild(count); host.appendChild(bar);

    const MAXN = 40;
    sl.min = 1; sl.max = MAXN; sl.step = 1; sl.value = 3;

    const X0 = -Math.PI, X1 = 3 * Math.PI;   // two full periods (T = 2π)
    let ctx, W, H;

    function sinc(x) { return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); } // normalised
    // ideal even ±1 square wave (matches the worked example: +1 near even·π)
    function square(x) { return Math.cos(x) >= 0 ? 1 : -1; }

    // input partial sum v_N(t) = Σ 2 c_k cos(kt),  k = 2ℓ+1
    function vPartial(x, N) {
      let s = 0;
      for (let l = 0; l < N; l++) { const k = 2 * l + 1; s += 2 * sinc(k / 2) * Math.cos(k * w * x); }
      return s;
    }
    // output partial sum i_N(t) = Σ 2 c_k Re[ e^{jkωt} / Z(jkω) ]
    function iPartial(x, N) {
      let s = 0;
      for (let l = 0; l < N; l++) {
        const k = 2 * l + 1;
        const ck = sinc(k / 2);
        const X = k * w * L - 1 / (k * w * C);   // reactance of the k-th harmonic
        const den = R * R + X * X;               // |Z|²
        // Re[ e^{jkωt} (R − jX)/|Z|² ] = (R cos kωt + X sin kωt)/|Z|²
        s += 2 * ck * (R * Math.cos(k * w * x) + X * Math.sin(k * w * x)) / den;
      }
      return s;
    }

    function draw() {
      const N = parseInt(sl.value, 10);
      count.textContent = "harmonics: " + N;
      ctx.clearRect(0, 0, W, H);

      // top header band reserved for the two trace labels so the curves never overlap them
      const mL = 18, mR = 14, mT = 52, mB = 26;
      const pw = W - mL - mR, ph = H - mT - mB;
      const yc = mT + ph / 2;
      const xPix = x => mL + (x - X0) / (X1 - X0) * pw;

      // find output peak for its own scaling (true gain at resonance is large)
      const M = 1300;
      let iMax = 1e-6, vMax = 1.0;
      for (let i = 0; i <= M; i++) {
        const x = X0 + (X1 - X0) * i / M;
        iMax = Math.max(iMax, Math.abs(iPartial(x, N)));
        vMax = Math.max(vMax, Math.abs(vPartial(x, N)));
      }
      const yScaleV = (ph / 2) / 1.32;           // input on ±1 scale (Gibbs headroom)
      const yScaleI = (ph / 2) / (iMax * 1.1);   // output normalised to fit
      const yPixV = v => yc - v * yScaleV;
      const yPixI = v => yc - v * yScaleI;

      // baseline
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mL, yc); ctx.lineTo(mL + pw, yc); ctx.stroke();

      // ghost ideal square wave (input target)
      ctx.strokeStyle = GHOST; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const x = X0 + (X1 - X0) * i / M;
        const px = xPix(x), py = yPixV(square(x));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      // input partial sum v_N (navy, thin)
      ctx.strokeStyle = NAVY; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const x = X0 + (X1 - X0) * i / M;
        const px = xPix(x), py = yPixV(vPartial(x, N));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      // output partial sum i_N (brick, thick) — normalised
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const x = X0 + (X1 - X0) * i / M;
        const px = xPix(x), py = yPixI(iPartial(x, N));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      // labels — sit in the reserved header band above the plot; colours match their traces
      ctx.font = "13px Arial";
      ctx.fillStyle = NAVY; ctx.fillText("input  v(t)  (\u2192 square wave)", mL + 4, 18);
      ctx.fillStyle = OUT; ctx.fillText("output  i(t)  (RLC-filtered, normalised)", mL + 4, 37);
      ctx.fillStyle = "#666"; ctx.font = "12px Arial";
      ctx.fillText("R = " + R + " \u03A9,  L = " + L + " H,  C = " + C +
        " F   \u2192  \u03C9\u2099 = 1/\u221A(LC) = " + wn.toFixed(0) + " rad/s", mL + 4, H - 8);
    }

    function resize() {
      W = Math.max(300, Math.min(720, Math.floor(host.clientWidth) || 720));
      H = Math.round(W * 0.5) + 40;   // extra height so the header band doesn't squeeze the plot
      ctx = dpiCanvas(cv, W, H);
      draw();
    }
    sl.addEventListener("input", function () { TRACK.hit(host.id, "slider"); draw(); });
    let rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
    resize();
  }

  function init() { euler(); sum(); ezt(); rlc(); squareBuilder(); rlcHarmonics(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
