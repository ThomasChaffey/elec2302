# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week02
```

That loads `phasor-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to a fixed state, composites the multi-panel ones into a
single image, and writes them here at 2x.

To change what a figure shows, edit the `week02` entry in the `WIDGETS_BY_WEEK`
table at the top of `tools/snapshot-widgets.js`. **If you change a state,
change the caption in `notes.qmd` to match** — captions that quote parameter
values will otherwise disagree with the picture.

## Building the PDF

```sh
tools/build-pdf.sh week02
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week02/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week02/notes.qmd --to pdf --metadata-file weeks/week02/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
