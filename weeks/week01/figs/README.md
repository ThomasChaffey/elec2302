# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## Regenerating

```sh
cd tools
npm install        # first time only
npm run snapshot
```

That loads `phasor-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to a fixed state, composites the multi-panel ones into a
single image, and writes all four here at 2x.

To change what a figure shows, edit the `WIDGETS` table at the top of
`tools/snapshot-widgets.js`. Each entry can move sliders, tick the RLC
normalisation box, or click one of the `e^{zt}` presets. **If you change a
state, change the caption in `notes.qmd` to match** — the captions quote the
parameter values, so otherwise the text and the picture disagree.

## Building the PDF

```sh
tools/build-pdf.sh            # week01 by default; pass week02 etc. for others
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week01/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week01/notes.qmd --to pdf --metadata-file weeks/week01/_pdf.yml
```

## Keeping it in step

The PDF and the snapshots are built on demand, which is what keeps
`quarto preview` fast and immune to LaTeX problems. The price is that they can
fall behind silently, so:

```sh
cd tools && npm run check
```

compares timestamps and names anything that needs rebuilding. It also runs as
part of `npm test`. Worth doing before you publish a week's notes.

`notes.qmd` deliberately declares no `format` block, so the site build and
`quarto preview` only ever produce HTML. If you move the PDF settings back into
the qmd, every preview will also build the PDF, and any PDF-only failure takes
the web page down with it.

The PDF build needs `rsvg-convert` for `circuit-rlc.svg`, since LaTeX cannot
place an SVG directly:

```sh
brew install librsvg
```

### LaTeX

If you see `tlmgr returned a non zero status code` with a complaint that
`/usr/local/texlive/.../tlpkg` is not writable: that is a system-wide BasicTeX
owned by root, so Quarto cannot install the packages a document asks for.
Give Quarto its own user-writable TeX instead:

```sh
quarto install tinytex
```

It lands in `~/Library/TinyTeX` and needs no `sudo`, then Quarto fetches
missing packages on demand. The alternative is `sudo tlmgr install <package>`
each time, which works but has to be repeated for every new dependency.

`_pdf.yml` sticks to `documentclass: article` and avoids `fig-pos`, so it
builds on a bare LaTeX without fetching anything. Once TinyTeX is in, the file
has commented lines for switching to the better-looking KOMA class.

## Fonts

The snapshots use whatever sans-serif the rendering machine resolves for
"Arial". On macOS that is Arial itself and the images match the website
closely. Images generated elsewhere (a Linux CI box, say) will differ slightly
in letter spacing — harmless, but regenerate locally if you care.

## Tests

`npm test` in `tools/` runs the widget checks: label collisions across every
slider position, and the usage-tracking logic.
