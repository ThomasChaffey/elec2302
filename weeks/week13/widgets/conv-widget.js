// 2D convolution widget: a 3x3 kernel h slides over a 16x16 input u,
// building the output y = h * u one pixel at a time (zero padding).
(function () {
  const root = document.getElementById("conv-widget");
  if (!root) return;

  const N = 16, CELL = 13, SIZE = N * CELL;
  const NAVY = [0, 70, 140], RED = [192, 57, 43], GREY = [85, 85, 85];

  // Input image: a filled square, a vertical bar and a horizontal bar
  const u = [];
  for (let m = 0; m < N; m++) {
    u.push([]);
    for (let n = 0; n < N; n++) {
      let v = 0;
      if (m >= 2 && m <= 7 && n >= 2 && n <= 7) v = 1;
      if (m >= 2 && m <= 13 && n >= 11 && n <= 12) v = 1;
      if (m >= 11 && m <= 12 && n >= 2 && n <= 8) v = 1;
      u[m].push(v);
    }
  }

  // Kernels h[i][j] with i, j = -1, 0, 1 stored at [i+1][j+1]
  const kernels = {
    blur:  { name: "Blur",             scale: 1 / 9, label: "× 1/9",
             k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
    vedge: { name: "Vertical edges",   scale: 1, label: "",
             k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]] },
    hedge: { name: "Horizontal edges", scale: 1, label: "",
             k: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]] },
    sharp: { name: "Sharpen",          scale: 1, label: "",
             k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  };

  root.innerHTML = `
    <div class="sw-row">
      <div class="sw-panel">
        <div class="sw-label in">Input u[m,n]</div>
        <canvas width="${SIZE}" height="${SIZE}"></canvas>
      </div>
      <div class="sw-panel">
        <div class="sw-label">Kernel h</div>
        <div class="kgrid"></div>
        <div class="kscale"></div>
      </div>
      <div class="sw-panel">
        <div class="sw-label out">Output y = h * u</div>
        <canvas width="${SIZE}" height="${SIZE}"></canvas>
      </div>
    </div>
    <div class="sw-readout"></div>
    <div class="sw-controls">
      <select></select>
      <button data-a="play">Play</button>
      <button data-a="step">Step</button>
      <button data-a="all">Show all</button>
      <button data-a="reset">Reset</button>
    </div>`;

  const [cIn, cOut] = root.querySelectorAll("canvas");
  const gIn = cIn.getContext("2d"), gOut = cOut.getContext("2d");
  const kgrid = root.querySelector(".kgrid");
  const kscale = root.querySelector(".kscale");
  const readout = root.querySelector(".sw-readout");
  const sel = root.querySelector("select");
  const playBtn = root.querySelector('[data-a="play"]');

  for (const key in kernels) {
    const o = document.createElement("option");
    o.value = key; o.textContent = kernels[key].name;
    sel.appendChild(o);
  }

  let K, y, ymax, pos = -1, timer = null;

  function convolve() {
    y = [];
    ymax = 0;
    for (let m = 0; m < N; m++) {
      y.push([]);
      for (let n = 0; n < N; n++) {
        let s = 0;
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++) {
            const mm = m - i, nn = n - j;
            if (mm >= 0 && mm < N && nn >= 0 && nn < N)
              s += K.k[i + 1][j + 1] * K.scale * u[mm][nn];
          }
        y[m].push(s);
        ymax = Math.max(ymax, Math.abs(s));
      }
    }
  }

  function mix(c, t) {
    t = Math.max(0, Math.min(1, t));
    return `rgb(${Math.round(255 + (c[0] - 255) * t)},${Math.round(255 + (c[1] - 255) * t)},${Math.round(255 + (c[2] - 255) * t)})`;
  }

  function gridLines(g) {
    g.strokeStyle = "#e2e2e2";
    g.lineWidth = 1;
    for (let k = 0; k <= N; k++) {
      g.beginPath(); g.moveTo(k * CELL + 0.5, 0); g.lineTo(k * CELL + 0.5, SIZE); g.stroke();
      g.beginPath(); g.moveTo(0, k * CELL + 0.5); g.lineTo(SIZE, k * CELL + 0.5); g.stroke();
    }
  }

  function draw() {
    // Input
    for (let m = 0; m < N; m++)
      for (let n = 0; n < N; n++) {
        gIn.fillStyle = mix(NAVY, u[m][n]);
        gIn.fillRect(n * CELL, m * CELL, CELL, CELL);
      }
    gridLines(gIn);

    // Output, filled up to the current position
    const last = pos < 0 ? -1 : pos;
    for (let m = 0; m < N; m++)
      for (let n = 0; n < N; n++) {
        const idx = m * N + n;
        if (idx <= last) {
          const v = y[m][n] / (ymax || 1);
          gOut.fillStyle = v >= 0 ? mix(RED, v) : mix(GREY, -v);
        } else {
          gOut.fillStyle = "#fff";
        }
        gOut.fillRect(n * CELL, m * CELL, CELL, CELL);
      }
    gridLines(gOut);

    // Highlight the kernel window and the current output pixel
    if (pos >= 0 && pos < N * N) {
      const m = Math.floor(pos / N), n = pos % N;
      gIn.strokeStyle = "#C0392B";
      gIn.lineWidth = 3;
      gIn.strokeRect((n - 1) * CELL + 1.5, (m - 1) * CELL + 1.5, 3 * CELL - 3, 3 * CELL - 3);
      gOut.strokeStyle = "#00468C";
      gOut.lineWidth = 3;
      gOut.strokeRect(n * CELL + 1.5, m * CELL + 1.5, CELL - 3, CELL - 3);
      readout.textContent = `y[${m},${n}] = ${y[m][n].toFixed(2)}`;
    } else {
      readout.textContent = pos >= N * N - 1 ? "Positive output in red, negative in grey" : "";
    }
  }

  function showKernel() {
    kgrid.innerHTML = "";
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const d = document.createElement("div");
        d.textContent = K.k[i][j];
        kgrid.appendChild(d);
      }
    kscale.textContent = K.label;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.textContent = "Play";
  }

  function advance() {
    if (pos < N * N - 1) { pos++; draw(); }
    else stop();
  }

  function setKernel(key) {
    stop();
    K = kernels[key];
    convolve();
    showKernel();
    pos = -1;
    draw();
  }

  root.querySelector(".sw-controls").addEventListener("click", (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    if (a === "play") {
      if (timer) { stop(); return; }
      if (pos >= N * N - 1) pos = -1;
      timer = setInterval(advance, 60);
      playBtn.textContent = "Pause";
    } else if (a === "step") {
      stop(); advance();
    } else if (a === "all") {
      stop(); pos = N * N; draw();
    } else if (a === "reset") {
      stop(); pos = -1; draw();
    }
  });
  sel.addEventListener("change", () => setKernel(sel.value));

  // Keep reveal.js from treating widget keypresses as navigation
  root.addEventListener("keydown", (e) => e.stopPropagation());

  setKernel("blur");
})();
