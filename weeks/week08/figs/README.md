# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-growing.png` — the growing-sinusoid expansion on the line Re s = σ, at
  **σ = 1.00** and **N = 130**, so 261 terms spaced Δω = 0.05 rad/s apart over
  |ω| ≤ 6.50 rad/s. Three stacked panels.
  Top: three of the basis signals e^{σt}cos(ωt) at ω = 1, 3 and 6 rad/s, inside
  the dashed envelope ±e^{σt}, on t ∈ [−3, 4].
  Middle: the weighted signal u(t)e^{−σt} in navy — a jump to 4 at the origin,
  decaying like e^{−0.50t} after it — and the truncated Fourier sum in brick.
  Bottom: u(t) = 4e^{0.5t}H(t) in navy against the reconstruction u_N(t) in
  brick, with guides at 10, 20 and 30.

  N is raised from the widget's own default of 40 for this snapshot. The top
  panel's label names ω = 1, 3 and 6 rad/s, but the widget only draws a basis
  curve when its k Δω is inside |ω| ≤ N Δω, so at N = 40 (|ω| ≤ 2 rad/s) the
  ω = 3 and ω = 6 curves are absent and the panel shows one curve against a
  three-curve label. N = 130 puts all three inside the band. σ is left at its
  default.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week08
```

That loads `laplace-widgets.js` in a headless DOM with a real canvas behind it,
drives the widget to the state above, composites the three panels into a single
image, and writes it here at 2x.

Week 8 keeps its widget in `laplace-widgets.js` rather than
`phasor-widgets.js`, so the `week08` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what the figure shows, edit the `week08` entry in the
`WIDGETS_BY_WEEK` table in the same file. **If you change a state, change the
caption in `notes.qmd` to match** — the caption quotes σ, N, the term count and
the frequency band, and will otherwise disagree with the picture.

The widget does not animate itself, so no `settle` is needed.

## Building the PDF

```sh
tools/build-pdf.sh week08
```

That regenerates the snapshot if it is out of date, renders the PDF, and moves
it to `weeks/week08/notes.pdf` — beside the source, not inside `_site`, which
the next full site render would wipe. `_quarto.yml` lists `weeks/**/*.pdf` as a
resource, so a site render copies it out, and the notes page links to it under
"Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week08/notes.qmd --to pdf --metadata-file weeks/week08/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
