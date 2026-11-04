# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## Regenerating

Week 3's widgets live in `convolution-widgets.js`, not `phasor-widgets.js`, and
`tools/snapshot-widgets.js` has no `week03` entry yet. Add one to the
`WIDGETS_BY_WEEK` table pointing at `convolution-widgets.js`, with the states
the captions quote:

| Container | State in the snapshot |
| --- | --- |
| `w-comb` | half-sine pulse input, $\Delta = 0.285$ ms (the slider default) |
| `w-conv` | $t = 0.5$ (the slider default) |

Then:

```sh
cd tools
node snapshot-widgets.js week03
```

The current PNGs were captured at the same states at 2x, so regenerating with
those settings reproduces them. **If you change a state, change the caption in
`notes.qmd` to match** — the captions quote these values.

## Building the PDF

```sh
tools/build-pdf.sh week03
```

The underlying command, if you want it by hand:

```sh
quarto render weeks/week03/notes.qmd --to pdf --metadata-file weeks/week03/_pdf.yml
```

See `weeks/week01/figs/README.md` for the LaTeX/tinytex setup, `rsvg-convert`
and the freshness checker; all of that applies here too.
