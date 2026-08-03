// Harness for the ELEC2302 widget usage tracker.
// Loads phasor-widgets.js in jsdom with a stubbed canvas + stubbed GoatCounter,
// simulates realistic interaction, and checks the counting rules hold.

const fs = require("fs");
const { JSDOM } = require("jsdom");

const SRC = "/sessions/compassionate-modest-darwin/mnt/week01/phasor-widgets.js";
const code = fs.readFileSync(SRC, "utf8");

const CTX_METHODS = ["setTransform", "clearRect", "beginPath", "moveTo", "lineTo", "stroke",
  "arc", "fill", "fillRect", "closePath", "setLineDash", "fillText", "save", "restore"];

async function makeDom({ withGoatCounter = true, ids = ["w-euler", "w-sum", "w-ezt", "w-rlc"] } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${ids.map(i => `<div id="${i}"></div>`).join("")}</body></html>`,
    { url: "https://tchaffey.com/elec2302/weeks/week01/notes.html", runScripts: "outside-only", pretendToBeVisual: true }
  );
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () {
    const ctx = {};
    CTX_METHODS.forEach(m => { ctx[m] = () => {}; });
    ctx.measureText = () => ({ width: 10 });
    return ctx;
  };
  const events = [];
  if (withGoatCounter) w.goatcounter = { count: o => events.push(o) };
  // the script defers init() to DOMContentLoaded, which jsdom fires async
  if (w.document.readyState === "loading") {
    await new Promise(res => w.document.addEventListener("DOMContentLoaded", res));
  }
  w.eval(code);
  return { w, events, dom };
}

// fire n "input" events on a range input, spaced dt ms apart in wall-clock terms
function burst(w, el, n) {
  for (let i = 0; i < n; i++) el.dispatchEvent(new w.Event("input", { bubbles: true }));
}
function sliderOf(w, id, which = 0) {
  return w.document.querySelectorAll(`#${id} input[type=range]`)[which];
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? "" : String(detail) });
}

(async function run() {
  // ---------- 1. one event per widget per page load ----------------------
  {
    const { w, events } = await makeDom();
    const eu = sliderOf(w, "w-euler");
    burst(w, eu, 200);                       // a long continuous drag
    burst(w, eu, 200);                       // and another, same page load
    check("euler: 200+200 input events -> exactly 1 GoatCounter event",
      events.length === 1, `got ${events.length}`);
    check("euler: event name is namespaced by week",
      events[0] && events[0].path === "widget-week1-euler", events[0] && events[0].path);
    check("euler: flagged as an event, not a pageview",
      events[0] && events[0].event === true, events[0] && events[0].event);

    // other widgets each contribute exactly one
    burst(w, sliderOf(w, "w-sum"), 50);
    burst(w, sliderOf(w, "w-ezt"), 50);
    burst(w, sliderOf(w, "w-rlc", 0), 50);   // reactance slider is index 0 in rlc
    burst(w, sliderOf(w, "w-rlc", 1), 50);   // main theta slider
    const paths = events.map(e => e.path).sort();
    check("four widgets -> four distinct events",
      paths.length === 4 && new Set(paths).size === 4, paths.join(", "));
    check("rlc's two sliders share one event",
      paths.filter(p => p.endsWith("rlc")).length === 1, paths.join(", "));
  }

  // ---------- 2. play button and animation ------------------------------
  {
    const { w, events } = await makeDom({ ids: ["w-euler"] });
    const btn = w.document.querySelector("#w-euler button");
    btn.dispatchEvent(new w.Event("click", { bubbles: true }));
    check("play button alone counts as an interaction", events.length === 1, `got ${events.length}`);

    // animation sets slider.value programmatically; that must not fire input
    const before = events.length;
    const sl = sliderOf(w, "w-euler");
    sl.value = 2.5;                          // simulates looper()
    sl.value = 3.0;
    check("programmatic slider movement sends nothing extra",
      events.length === before, `got ${events.length - before} extra`);
    btn.dispatchEvent(new w.Event("click", { bubbles: true }));   // pause
  }

  // ---------- 3. local tally: gesture coalescing -------------------------
  {
    const { w } = await makeDom({ ids: ["w-euler"] });
    const eu = sliderOf(w, "w-euler");
    burst(w, eu, 300);                       // one gesture
    let tally = w.elec2302usage.json().widgets["w-euler"];
    check("local tally: 300 rapid events = 1 gesture", tally.slider === 1, `slider=${tally.slider}`);

    await sleep(800);                        // longer than GAP
    burst(w, eu, 300);                       // a second, separate gesture
    tally = w.elec2302usage.json().widgets["w-euler"];
    check("local tally: a later gesture counts separately", tally.slider === 2, `slider=${tally.slider}`);

    check("local tally: records the page the interaction happened on",
      tally.pages["/elec2302/weeks/week01/notes.html"] === 2, JSON.stringify(tally.pages));
    check("local tally: records that one event was sent",
      tally.sent === 1, `sent=${tally.sent}`);
    check("elec2302usage() returns a row per widget",
      Object.keys(w.elec2302usage()).length === 1);
    check("elec2302usage.reset() empties the record",
      Object.keys(w.elec2302usage.reset() && w.elec2302usage.json().widgets).length === 0);
  }

  // ---------- 4. degrades safely without GoatCounter ---------------------
  {
    let threw = null;
    try {
      const { w, events } = await makeDom({ withGoatCounter: false, ids: ["w-euler", "w-ezt"] });
      burst(w, sliderOf(w, "w-euler"), 100);
      const cz = w.document.querySelector("#w-ezt canvas");
      cz.dispatchEvent(new w.MouseEvent("mousedown", { clientX: 40, clientY: 40, bubbles: true }));
      check("no GoatCounter: nothing is sent", events.length === 0);
      check("no GoatCounter: widgets still tally locally",
        w.elec2302usage.json().widgets["w-euler"].slider === 1);
      check("no GoatCounter: ezt drag is recorded",
        w.elec2302usage.json().widgets["w-ezt"].drag === 1);
    } catch (e) { threw = e; }
    check("no GoatCounter: no exception thrown", threw === null, threw && threw.message);
  }

  // ---------- 5. a throwing GoatCounter must not break widgets -----------
  {
    let threw = null;
    try {
      const { w } = await makeDom({ ids: ["w-euler"] });
      w.goatcounter = { count: () => { throw new Error("blocked by extension"); } };
      burst(w, sliderOf(w, "w-euler"), 10);
    } catch (e) { threw = e; }
    check("a throwing GoatCounter is swallowed", threw === null, threw && threw.message);
  }

  // ---------- 6. ezt presets --------------------------------------------
  {
    const { w, events } = await makeDom({ ids: ["w-ezt"] });
    const chips = w.document.querySelectorAll("#w-ezt button");
    // chips[0..3] are presets; the play button is created after them
    chips[0].dispatchEvent(new w.Event("click", { bubbles: true }));
    chips[1].dispatchEvent(new w.Event("click", { bubbles: true }));
    check("preset chips count as interaction", events.length === 1, `got ${events.length}`);
    check("preset clicks are not coalesced in the local tally",
      w.elec2302usage.json().widgets["w-ezt"].preset === 2,
      w.elec2302usage.json().widgets["w-ezt"].preset);
  }

  // ---------- 7. count.js arriving late ---------------------------------
  // The realistic failure: async count.js has not landed when a keen student
  // grabs the slider immediately. The interaction must be held, not dropped.
  {
    const { w } = await makeDom({ withGoatCounter: false, ids: ["w-euler"] });
    burst(w, sliderOf(w, "w-euler"), 20);            // nothing to send to yet
    const late = [];
    w.goatcounter = { count: o => late.push(o) };    // count.js finally loads
    await sleep(1300);                               // one retry tick
    check("interaction before count.js loads is retried, not lost",
      late.length === 1, `got ${late.length}`);
    check("retried event carries the right name",
      late[0] && late[0].path === "widget-week1-euler", late[0] && late[0].path);

    burst(w, sliderOf(w, "w-euler"), 20);            // further use adds nothing
    await sleep(50);
    check("no duplicate after a successful retry", late.length === 1, `got ${late.length}`);
  }

  const failed = results.filter(r => !r.pass);
  results.forEach(r => console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "   [" + r.detail + "]" : ""}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
