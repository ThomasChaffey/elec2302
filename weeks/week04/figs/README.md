# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-square.png` — the square-wave builder at **12 waves**, the partial sum
  (navy) against the target square wave (grey), red dot on the Gibbs overshoot
  peak.
- `w-rect.png` — the bridge-rectifier builder at **4 harmonics**, the partial sum
  (navy) against the rectified sine (grey), dashed line at the DC term 2/π, red
  dot on the largest error.
- `w-rlc-out.png` — the RLC output built from **7 harmonics**, input $v(t)$
  (navy) against the target square wave (grey) and output $i(t)$ (brick,
  normalised to fit). Component values are fixed in the widget: R = 1 Ω,
  L = 0.5 H, C = 0.5 F, so ω_n = 1/√(LC) = 2 rad/s.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week04
```

That loads `phasor-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to a fixed state, composites the multi-panel ones into a
single image, and writes them here at 2x.

To change what a figure shows, edit the `week04` entry in the `WIDGETS_BY_WEEK`
table at the top of `tools/snapshot-widgets.js`. **If you change a state,
change the caption in `notes.qmd` to match** — captions that quote parameter
values will otherwise disagree with the picture. All three week 4 captions quote
a harmonic count, so all three are affected.

`weeks/week04/phasor-widgets.js` also carries the four Lecture 1 widgets
(`w-euler`, `w-sum`, `w-ezt`, `w-rlc`), which the week 4 page does not use.
Each is guarded by its container id, so they never initialise here, and the
snapshot table above does not list them.

## Building the PDF

```sh
tools/build-pdf.sh week04
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week04/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week04/notes.qmd --to pdf --metadata-file weeks/week04/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
