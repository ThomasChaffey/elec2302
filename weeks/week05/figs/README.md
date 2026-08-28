# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-sample.png` — the pulse train at **T = 4τ**, in the **T cₖ** view: the
  spectral lines (brick) sampling the fixed envelope
  E(ω) = Aτ sinc(ωτ/2π) (grey) at spacing ω₀ = 2π/T. T/τ = 4 exactly, so every
  fourth harmonic lands on a zero of the envelope and is drawn as an open
  circle on the axis.
- `w-tau.png` — the width-τ pulse at **τ = 1**, with its transform below: the
  main lobe shaded and the first null at 2π/τ marked. Peak height Aτ = 1, first
  null 2π ≈ 6.28 rad/s.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week05
```

That loads `fourier-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to a fixed state, composites the two panels into a single
image, and writes them here at 2x.

Week 5 keeps its widgets in `fourier-widgets.js` rather than
`phasor-widgets.js`, so `tools/snapshot-widgets.js` carries a `SRC_FILE` table
naming the file to load; the `week05` entry there points at it.

To change what a figure shows, edit the `week05` entry in the `WIDGETS_BY_WEEK`
table at the top of `tools/snapshot-widgets.js`. **If you change a state,
change the caption in `notes.qmd` to match** — captions that quote parameter
values will otherwise disagree with the picture. Both week 5 captions quote a
parameter value (T = 4τ and τ = 1), so both are affected.

## Building the PDF

```sh
tools/build-pdf.sh week05
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week05/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week05/notes.qmd --to pdf --metadata-file weeks/week05/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
