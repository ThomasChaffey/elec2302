# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-lp2.png` — the week 1 resonant low-pass widget with a damping-ratio
  slider, at its defaults: **f_n = 500 Hz** (slider value 575, 499.99 Hz) and
  **ζ = 0.71** (slider value 726, ζ = 0.7078). Two stacked panels.
  Top: two periods of the 100 Hz square wave u(t) in grey and the filter
  output y(t) in navy, t from 0 to 20 ms.
  Bottom: |G(jω)| in dB from 20 Hz to 20 kHz, with f_n marked by a dashed red
  line and the first 13 odd harmonics of the square wave as red stems.
  The widget's panel titles, legends, sliders and readout are HTML, not
  canvas, so they are not in the image; the caption in `notes.qmd` names them.

- `w-lphp.png` — second order low-pass and high-pass gains with ζ = 1/√2, at
  the widget's defaults: **ω_h = 1.00 rad/s** (slider value 333, 0.998 rad/s)
  and **ω_ℓ = 10 rad/s** (slider value 667, 10.02 rad/s). Three stacked panels,
  each from 0.01 to 1000 rad/s and −80 to 10 dB with a dotted line at −3 dB:
  the two filters (low-pass navy, high-pass red), their cascade, and their sum.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week10
```

That loads `filter-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to the state above, composites the panels into a single
image, and writes them here at 2x.

Week 10 keeps its widgets in `filter-widgets.js` rather than
`phasor-widgets.js`, so the `week10` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what a figure shows, edit the `week10` entry in the
`WIDGETS_BY_WEEK` table in the same file. **If you change a state, change the
caption in `notes.qmd` to match** — the captions quote f_n, ζ, ω_h and ω_ℓ.

Neither widget animates itself unless its sweep button is pressed, so no
`settle` is needed.

## Building the PDF

```sh
tools/build-pdf.sh week10
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week10/notes.pdf`.

The underlying command, if you want it by hand:

```sh
quarto render weeks/week10/notes.qmd --to pdf --metadata-file weeks/week10/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`).
