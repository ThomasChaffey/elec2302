# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-population.png` — the one-pole population model at its defaults,
  **k_r = 0.30** and **k_d = 0.50**. Left: the impulse response
  h(t) = e^{pt}H(t) on t ∈ [0, 10], starting at 1 and decaying towards zero,
  with faint guides at h = 1, 2, 3 and 4 so that the growing case shares the
  same vertical scale. Right: the pole of G(jω) = 1/(jω + (k_d − k_r)) as a
  cross on the complex plane, at **p = k_r − k_d = −0.20** — navy, and to the
  left of the imaginary axis, which is the stable case. Real-axis ticks at
  −1 and 1.
- `w-pendulum-undamped.png` — the lossless pendulum at its defaults,
  **θ(0) = 0.80 rad**, left running. Left: the rod and bob at the angle
  reached at the moment of capture, against a faint plumb line through the
  pivot, with the current θ printed underneath. Right: θ(t) on the 12 s
  scrolling window, filled from t = 0 to about t = 8 s — roughly four full
  swings, still reaching ±0.80 at the end of the trace, since nothing removes
  energy from the system. Guides at θ = ±1.

The pendulum runs while the snapshot is being taken, so the rod angle and the
exact end of the trace differ a little from run to run. The amplitude and the
extent of the window do not.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week07
```

That loads `stability-widgets.js` in a headless DOM with a real canvas behind
it, drives each widget to a fixed state, composites the multi-panel ones into a
single image, and writes them here at 2x.

Week 7 keeps its widgets in `stability-widgets.js` rather than
`phasor-widgets.js`, so the `week07` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what a figure shows, edit the `week07` entry in the `WIDGETS_BY_WEEK`
table in the same file. **If you change a state, change the caption in
`notes.qmd` to match** — captions that quote parameter values will otherwise
disagree with the picture. Both week 7 widgets are snapshotted at their own
defaults, so the values above (k_r = 0.30, k_d = 0.50, θ(0) = 0.80 rad) are the
defaults set in `stability-widgets.js`; changing them there changes the
figures too.

`w-pendulum-undamped` animates itself as soon as the page loads, and the
snapshot driver otherwise composites the very first frame, which is a bob at
rest and an empty trace. Its spec therefore carries `settle: 8000` — a wait in
milliseconds, added after `state()` and before compositing — so the widget's
own animation frames run for eight seconds first. That wait is what puts the
trace in the figure; shorten it and less of the window is filled, lengthen it
past 12 s and the trace starts scrolling. `settle` is optional and only this
widget uses it.

## Building the PDF

```sh
tools/build-pdf.sh week07
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week07/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week07/notes.qmd --to pdf --metadata-file weeks/week07/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
