# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-fm.png` — FM with the single-tone message u(t) = cos(ω_m t), ω_m = 1 rad/s,
  ω_c = 12 rad/s, at **k = 4 rad/s** (slider value 4, the widget default is
  0.3). Two stacked panels.
  Top: u(t) in navy and y(t) = cos(ω_c t + (k/ω_m) sin(ω_m t)) in red, over one
  period of u, t from 0 to 2π.
  Bottom: |Y(jω)|/π for 0 ≤ ω ≤ 28 rad/s, lines of height |J_n(k/ω_m)| at
  ω_c + n ω_m.
  The Play button, slider and readout are HTML, not canvas, so they are not in
  the image; the caption in `notes.qmd` names the state.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week11
```

That loads `modulation-widgets.js` in a headless DOM with a real canvas behind
it, drives the widget to the state above, composites the panels into a single
image, and writes it here at 2x.

Week 11 keeps its widget in `modulation-widgets.js` rather than
`phasor-widgets.js`, so the `week11` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what the figure shows, edit the `week11` entry in the
`WIDGETS_BY_WEEK` table in the same file. **If you change the state, change the
caption in `notes.qmd` to match** — the caption quotes k, ω_m and ω_c.

The widget does not animate unless Play is pressed, so no `settle` is needed.

## Building the PDF

```sh
tools/build-pdf.sh week11
```

That regenerates the snapshot if it is out of date, renders the PDF, and moves
it to `weeks/week11/notes.pdf`.

The underlying command, if you want it by hand:

```sh
quarto render weeks/week11/notes.qmd --to pdf --metadata-file weeks/week11/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`).
