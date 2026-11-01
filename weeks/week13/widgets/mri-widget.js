// MRI k-space widget: a Shepp-Logan phantom, its 2D Fourier transform
// (k-space), and the image reconstructed by an inverse 2D FFT from the
// k-space samples that are kept.
(function () {
  const root = document.getElementById("mri-widget");
  if (!root) return;

  const N = 128, DISP = 200;

  root.innerHTML = `
    <div class="sw-row">
      <div class="sw-panel">
        <div class="sw-label in">Image m(x₁, x₂)</div>
        <canvas class="pix" width="${N}" height="${N}" style="width:${DISP}px;height:${DISP}px"></canvas>
      </div>
      <div class="sw-panel">
        <div class="sw-label">Measured k-space M(k₁, k₂)</div>
        <canvas class="pix" width="${N}" height="${N}" style="width:${DISP}px;height:${DISP}px"></canvas>
      </div>
      <div class="sw-panel">
        <div class="sw-label out">Reconstruction</div>
        <canvas class="pix" width="${N}" height="${N}" style="width:${DISP}px;height:${DISP}px"></canvas>
      </div>
    </div>
    <div class="sw-controls">
      <select>
        <option value="full">All of k-space</option>
        <option value="low">Low frequencies only</option>
        <option value="high">High frequencies only</option>
        <option value="skip">Every second line</option>
      </select>
      <label>radius <input type="range" min="2" max="40" value="10"></label>
      <button data-a="acquire">Acquire line by line</button>
    </div>`;

  const [cImg, cK, cRec] = root.querySelectorAll("canvas");
  const sel = root.querySelector("select");
  const slider = root.querySelector('input[type="range"]');
  const acqBtn = root.querySelector('[data-a="acquire"]');

  // Modified Shepp-Logan phantom: [intensity, a, b, x0, y0, angle in degrees]
  const ellipses = [
    [1.0, 0.69, 0.92, 0, 0, 0],
    [-0.8, 0.6624, 0.874, 0, -0.0184, 0],
    [-0.2, 0.11, 0.31, 0.22, 0, -18],
    [-0.2, 0.16, 0.41, -0.22, 0, 18],
    [0.1, 0.21, 0.25, 0, 0.35, 0],
    [0.1, 0.046, 0.046, 0, 0.1, 0],
    [0.1, 0.046, 0.046, 0, -0.1, 0],
    [0.1, 0.046, 0.023, -0.08, -0.605, 0],
    [0.1, 0.023, 0.023, 0, -0.606, 0],
    [0.1, 0.023, 0.046, 0.06, -0.605, 0],
  ];
  const img = new Float64Array(N * N);
  for (let r = 0; r < N; r++) {
    const yy = 1 - (2 * r + 1) / N;
    for (let c = 0; c < N; c++) {
      const xx = (2 * c + 1) / N - 1;
      let v = 0;
      for (const [A, a, b, x0, y0, ang] of ellipses) {
        const t = (ang * Math.PI) / 180;
        const dx = xx - x0, dy = yy - y0;
        const p = dx * Math.cos(t) + dy * Math.sin(t);
        const q = -dx * Math.sin(t) + dy * Math.cos(t);
        if ((p * p) / (a * a) + (q * q) / (b * b) <= 1) v += A;
      }
      img[r * N + c] = v;
    }
  }

  // In-place radix-2 complex FFT of length n (sign -1 forward, +1 inverse)
  function fft(re, im, sign) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (sign * 2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  function fft2(re, im, sign) {
    const rr = new Float64Array(N), ri = new Float64Array(N);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) { rr[c] = re[r * N + c]; ri[c] = im[r * N + c]; }
      fft(rr, ri, sign);
      for (let c = 0; c < N; c++) { re[r * N + c] = rr[c]; im[r * N + c] = ri[c]; }
    }
    for (let c = 0; c < N; c++) {
      for (let r = 0; r < N; r++) { rr[r] = re[r * N + c]; ri[r] = im[r * N + c]; }
      fft(rr, ri, sign);
      for (let r = 0; r < N; r++) { re[r * N + c] = rr[r]; im[r * N + c] = ri[r]; }
    }
  }

  // k-space of the phantom
  const Kre = Float64Array.from(img), Kim = new Float64Array(N * N);
  fft2(Kre, Kim, -1);
  const Klog = new Float64Array(N * N);
  let Klogmax = 0;
  for (let i = 0; i < N * N; i++) {
    Klog[i] = Math.log(1 + Math.hypot(Kre[i], Kim[i]));
    Klogmax = Math.max(Klogmax, Klog[i]);
  }

  // Centered frequency index of FFT bin p
  const freq = (p) => (p < N / 2 ? p : p - N);

  let acquired = N, timer = null;

  // Is the sample at FFT bin (row p, column q) kept?
  function kept(p, q) {
    const ky = freq(p), kx = freq(q);
    // Acquisition fills displayed rows from the top (ky = -N/2) downwards
    if (ky + N / 2 >= acquired) return false;
    const rad = Math.hypot(kx, ky), R = +slider.value;
    switch (sel.value) {
      case "low":  return rad <= R;
      case "high": return rad > R;
      case "skip": return (ky & 1) === 0;
      default:     return true;
    }
  }

  function paint(canvas, valueAt) {
    const g = canvas.getContext("2d");
    const im = g.createImageData(N, N);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [R, G, B] = valueAt(r, c);
        const o = 4 * (r * N + c);
        im.data[o] = R; im.data[o + 1] = G; im.data[o + 2] = B; im.data[o + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  }

  const shade = (v) => { const s = Math.round(255 * Math.max(0, Math.min(1, v))); return [s, s, s]; };

  function update() {
    slider.disabled = !(sel.value === "low" || sel.value === "high");

    // k-space display, shifted so that zero frequency is in the centre
    paint(cK, (r, c) => {
      const p = (r + N / 2) % N, q = (c + N / 2) % N;
      const v = Klog[p * N + q] / Klogmax;
      if (kept(p, q)) return shade(v * v);
      return [Math.round(30 + 40 * v), Math.round(20 + 20 * v), Math.round(20 + 20 * v)];
    });

    // Inverse FFT of the kept samples
    const re = new Float64Array(N * N), im = new Float64Array(N * N);
    for (let p = 0; p < N; p++)
      for (let q = 0; q < N; q++)
        if (kept(p, q)) { re[p * N + q] = Kre[p * N + q]; im[p * N + q] = Kim[p * N + q]; }
    fft2(re, im, +1);
    let mx = 0;
    const mag = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) {
      mag[i] = Math.hypot(re[i], im[i]) / (N * N);
      mx = Math.max(mx, mag[i]);
    }
    const scale = sel.value === "high" || sel.value === "skip" ? mx || 1 : 1;
    paint(cRec, (r, c) => shade(mag[r * N + c] / scale));
  }

  paint(cImg, (r, c) => shade(img[r * N + c]));

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    acqBtn.textContent = "Acquire line by line";
  }

  acqBtn.addEventListener("click", () => {
    if (timer) { stop(); acquired = N; update(); return; }
    acquired = 0;
    acqBtn.textContent = "Stop";
    timer = setInterval(() => {
      acquired += 1;
      update();
      if (acquired >= N) stop();
    }, 40);
  });
  sel.addEventListener("change", () => { stop(); acquired = N; update(); });
  slider.addEventListener("input", update);
  root.addEventListener("keydown", (e) => e.stopPropagation());

  update();
})();
