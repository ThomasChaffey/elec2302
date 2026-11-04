# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-avg.png` — the measured output of G(s) = 8/(s² + 2s + 4) for u(t) = cos(2t),
  plus noise of standard deviation **σ = 2**, over twelve periods T₀ = π s, with
  c(y) computed from the first **N = 1** period (both are the widget defaults).
  The first period is shaded. Faint red: the noisy samples (20 per period).
  Solid red: ŷ(t) = 2 Re(c e^{j2t}). Dashed: the noise-free output 2 sin(2t).
  The noise comes from a fixed seed in `sysid-widgets.js`, so the image is the
  same on every run, and the estimate quoted in the caption, 2c = 0.036 − 1.069j,
  matches it.
  The sliders, the "new noise" button and the readout are HTML, not canvas, so
  they are not in the image; the caption in `notes.qmd` names the state.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week12
```

That loads `sysid-widgets.js` in a headless DOM with a real canvas behind it,
leaves the widget in its default state, and writes the image here at 2x.

Week 12 keeps its widget in `sysid-widgets.js` rather than `phasor-widgets.js`,
so the `week12` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what the figure shows, edit the `week12` entry in the
`WIDGETS_BY_WEEK` table in the same file. **If you change the state, or the seed
in `sysid-widgets.js`, change the caption in `notes.qmd` to match** — the caption
quotes σ, N and the estimate 2c.

The widget does not animate, so no `settle` is needed.

## Building the PDF

```sh
tools/build-pdf.sh week12
```

That regenerates the snapshot if it is out of date, renders the PDF, and moves
it to `weeks/week12/notes.pdf`.

The underlying command, if you want it by hand:

```sh
quarto render weeks/week12/notes.qmd --to pdf --metadata-file weeks/week12/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`).
