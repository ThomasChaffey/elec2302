# Frozen widget snapshots

These PNGs are the print versions of the interactive widgets in `notes.qmd`.
The HTML build shows the live widget; the PDF build shows the image. Both are
wired up with `content-visible` blocks, so neither format sees the other's copy.

Do not edit these by hand — they are generated.

## What each one shows

- `w-pulse-rlc.png` — the shifted pulse pτ(t − τ/2) at **τ = 1.5 s** (top) and
  the output y(t) of G(jω) = 25/((jω)² + 6jω + 25) (bottom), computed by
  numerically inverse Fourier transforming Y = GU. Peak output 1.095 at
  t = 0.78 s, against the unit guide drawn across the output panel.
- `w-bode-probe.png` — the Bode magnitude and phase of the same G, with the
  marker at **ω₀ = 5.01 rad/s**, and the input and output sinusoids at that
  frequency below. ω₀ is the natural frequency, so the marker reads gain 0.831
  (−1.6 dB) and phase −90°, and the red output sinusoid lags the blue input by
  a quarter period.
- `w-resonant-peak.png` — |G(jω)| for the standard second order form at
  **ζ = 0.20**, drawn over a faint family at ζ = 0.1, 0.2, 0.3, 0.5, 1/√2 and 1.
  Peak gain 2.55 (8.1 dB) at ωᵣ = 0.959ωₙ, with the peak and the 0 dB line
  marked.

## Regenerating

```sh
cd tools
npm install        # first time only
node snapshot-widgets.js week06
```

That loads `bode-widgets.js` in a headless DOM with a real canvas behind it,
drives each widget to a fixed state, composites the multi-panel ones into a
single image, and writes them here at 2x.

Week 6 keeps its widgets in `bode-widgets.js` rather than `phasor-widgets.js`,
so the `week06` entry in the `SRC_FILE` table at the top of
`tools/snapshot-widgets.js` names the file to load.

To change what a figure shows, edit the `week06` entry in the `WIDGETS_BY_WEEK`
table in the same file. **If you change a state, change the caption in
`notes.qmd` to match** — captions that quote parameter values will otherwise
disagree with the picture. All three week 6 captions quote parameter values
(τ = 1.5 s, ω₀ = 5.01 rad/s, ζ = 0.20), so all three are affected. Only
`w-bode-probe` is driven off its default: its state function moves the single
slider to 0.7, which is log₁₀ω₀, not ω₀ itself.

`w-bode-probe` also carries a play button that animates the sinusoids. The
snapshot never presses it, so the frozen image is the t = 0 phase.

## Building the PDF

```sh
tools/build-pdf.sh week06
```

That regenerates the snapshots if they are out of date, renders the PDF, and
moves it to `weeks/week06/notes.pdf` — beside the source, not inside `_site`,
which the next full site render would wipe. `_quarto.yml` lists
`weeks/**/*.pdf` as a resource, so a site render copies it out, and the notes
page links to it under "Other formats".

The underlying command, if you want it by hand:

```sh
quarto render weeks/week06/notes.qmd --to pdf --metadata-file weeks/week06/_pdf.yml
```

See `weeks/week01/figs/README.md` for the full notes on LaTeX/tinytex setup,
`rsvg-convert`, and the freshness checker (`cd tools && npm run check`) — all
of that applies here too and isn't repeated per week.
