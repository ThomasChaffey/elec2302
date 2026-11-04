# Prompt 1: typeset a handwritten lecture into Quarto notes

This is the first of two prompts. It produces the notes and figures in the lecture
folder. Prompt 2 (`publish-notes-prompt.md`) moves the result onto the website.

Before starting, connect the folder
`ELEC2302/ELEC2302-Signals-and-Systems/lectures/lecture NN`, and attach the scanned
handwriting as a PDF to the first message. If a previous version of the lecture exists,
attach or point at that too, and say whether it is being revised or written from scratch.

---

## The prompt

````markdown
LECTURE = NN
LECTURE TITLE = <the title written at the top of page 1>
LECTURE FOLDER = ELEC2302-Signals-and-Systems/lectures/lecture NN

Typeset the attached handwritten lecture into a Quarto HTML notes document,
`lectureNN-notes.qmd`, in the lecture folder. Work in Australian English. It is notes,
not slides: one flowing article, no reveal.js.

Match the house pattern rather than inventing one. `lecture01-notes.qmd` is the
canonical template — copy its front matter, changing only the title and subtitle, and
follow its maths style, callout style and widget-embedding pattern. `notes.scss` is the
theme and is used unchanged. `course_outline.md` gives context on where the lecture sits
in the course; do not import content from it.

### Transcription

- Copy the wording and the working exactly as written. Preserve every intermediate
  algebra step. Do not condense, tidy, or reorder derivations. If I wrote three lines to
  get from A to B, give three lines.
- Do not add commentary, motivation, or connective prose that is not in the source.
  Reproduce my own `Note:` lines verbatim. Leave the narrative to me.
- Where I have revised an earlier version, follow the revision: content I cut stays cut,
  and reordering in the handwriting is reordering in the notes. Tell me in your reply
  what the revision dropped, so I can confirm I meant to drop it.
- Notation: `H(t)` for the Heaviside step, `p_\tau(t)` for the width-`\tau` pulse,
  `u(t)` for an input, `y(t)` for an output, `j` for the imaginary unit,
  `\operatorname{Re}`, `\mathrm{d}` for differentials, `\boxed{...}` for boxed results.
- KaTeX: `$...$` inline, `$$...$$` display, `\begin{aligned}...\end{aligned}` for
  multi-line derivations.
- Number equations sequentially through the whole document, `(1)`, `(2)`, ... Do not
  reuse a number, even where the handwriting does, and update every back-reference.
- **Flag, do not guess.** Where handwriting is ambiguous or the maths looks wrong,
  typeset the mathematically correct reading and put an HTML comment at that spot:
  `<!-- CHECK: ... -->`, saying what the source shows and what you used. Never silently
  invent and never silently correct.

### Figures

- Circuits: circuitikz, one standalone `.tex` per circuit, compiled with `pdflatex`,
  converted with `pdftocairo -svg`. Preamble and conventions as in `circuit-rlc.tex`:
  `american` style, `voltage=american`, house navy `RGB 0,70,140`, `+` on the
  current-entering side. Check the rendered polarity, do not assume circuitikz got it
  right.
- Block diagrams and signal-flow diagrams: TikZ, same navy and line weight, one
  standalone `.tex` each, rendered to SVG the same way. See `fig-block-*.tex`.
- Plots and one-off sketches: inline SVG in a ```{=html}``` block, house navy, in the
  style of the inline figures in `lecture02-notes.qmd`.
- Widgets only where the figure is genuinely dynamic: time evolution, a trajectory, or
  dependence on a parameter the reader should be able to vary. A static labelled diagram
  stays static. Reuse an existing widget where one fits; the libraries are
  `phasor-widgets.js` and `convolution-widgets.js`.
- If a new widget is needed, add it to the week's own widget `.js` following the
  existing conventions — self-contained IIFE guarded on its container id, canvas and
  vanilla JS only, navy `#00468C` primary and `#C0392B` for a second trace, play/pause
  plus slider, axis labels matching their arguments. Flag it at the top of your reply as
  NEW WIDGET, for me to verify.
- Where the handwriting puts two things side by side, use a Quarto `.columns` block
  rather than stacking them.

### Verify before you report back

- Run every display and inline expression through KaTeX. Report the counts and any
  failures.
- Render the document with Quarto, screenshot it, and look at it.
- Rasterise every SVG you produced and look at each one.
- Load any widget in a headless browser and confirm it initialises with no console
  errors and stays inside its canvas.
- Confirm every `![](...)` target exists.

### Report

- Every `CHECK` flag, quoted, with what the source shows and what you used.
- Every new widget.
- What the revision dropped relative to the previous version, if there was one.
- Anything you could not verify in this environment.

### Working rules

- Never overwrite a file on my disk without first re-reading it and passing the
  modification check. Do not use `force`. If a write is rejected, stop and tell me.
- Change my wording only where I ask. When a change moves my text, move it verbatim.
- Tell me plainly when something cannot be done, rather than working around it.
````

---

## Notes for the person running it

- Deliverables land in the lecture folder: `lectureNN-notes.qmd`, a `.tex` and `.svg`
  pair per circuit and per block diagram, and any updated widget `.js`.
- This copy of the notes keeps its own `format:` block and uses `notes.scss`. The
  website copy does not — see prompt 2.
- Read the CHECK flags before publishing. They are the places the handwriting was
  unclear, and they are usually where a real error is.
