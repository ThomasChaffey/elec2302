# Prompt 2: move a week's notes onto the website and publish them

This is the second of two prompts. Prompt 1 (`transcribe-lecture-prompt.md`) produces
`lectureNN-notes.qmd` and its figures in the lecture folder; this one converts that into
the site's format, publishes it, and wires up tracking.

Before starting, connect both folders:

- `ELEC2302/ELEC2302-Signals-and-Systems/lectures/lecture NN`
- `ELEC2302/website`

Do this only once the CHECK flags from prompt 1 have been dealt with.

---

## The prompt

````markdown
WEEK = NN
TOPIC = <the subtitle used in the notes, for the sidebar and the home page>
SOURCE = ELEC2302-Signals-and-Systems/lectures/lecture NN/lectureNN-notes.qmd
WEBSITE FOLDER = ELEC2302/website

Convert the lecture notes at SOURCE into the website's format, put them in
`weeks/weekNN/`, and publish them. Follow the patterns already in the repo rather than
inventing new ones: `weeks/week01/notes.qmd` and `weeks/week02/notes.qmd` are the
canonical examples, and `weeks/week02/phasor-widgets.js` is the canonical widget library.

Do not rewrite my prose. This is a format conversion: the words stay as they are, apart
from the specific substitutions listed below.

### 1. The notes file

Write `weeks/weekNN/notes.qmd`:

- Front matter is only `title: "Week NN — Lecture notes"` and `subtitle: "TOPIC"`. No
  `format:` block, no `toc:`, no theme — `_quarto.yml` supplies all of it.
- Straight after the front matter, the two blocks copied from week 1: the
  `.format-links` block linking `notes.pdf`, and the `content-visible when-format="pdf"`
  line pointing readers at the live widgets.
- Replace `<span class="navy">**X**</span>` with `**X**`. The site does not define that
  class. Callouts stay as `::: {.note}`.
- A section the source marks as starred or optional goes in an extension box, the same
  as `weeks/week04/notes.qmd`: open `:::: {.extension}`, put
  `[Extension material]{.extension-label}` on the line after it, and close with `::::`.
  Use four colons, since these sections usually contain a `::: {.note}` or a centred
  figure div of their own. Drop the source's own delimiters — a `Starred section:`
  prefix on the heading, a `— end starred section —` line at the foot — because the box
  now marks the boundary. Anything the source keeps outside the box, such as a `.note`
  telling the lecturer to skip it, stays where it is.
- Every widget appears twice: the live `<div id="w-...">` inside
  `::: {.content-visible when-format="html"}`, and a PNG snapshot in `figs/` inside
  `::: {.content-visible when-format="pdf"}`, captioned with the exact state shown in
  the snapshot.
- Everything else — text, maths, figures, `.columns` blocks, CHECK comments — carries
  over unchanged.

### 2. Supporting files in `weeks/weekNN/`

- Copy `_pdf.yml` from the previous week, changing the week number in the paths.
- Generate the widget snapshots into `figs/`, at 2x, driving each widget to a fixed
  state.
- Write `figs/README.md` following `weeks/week02/figs/README.md`, recording the state
  each snapshot is in and how to regenerate it.
- Copy every SVG the notes reference, plus the week's widget `.js`, from the lecture
  folder. Use `device_bash` `cp` between the mounted folders: files may be OneDrive
  placeholders that `device_stage_files` cannot read, and a `cp` hydrates them.

### 3. Usage tracking

- Copy the `// ---- usage tracking ----` block from `weeks/week02/phasor-widgets.js`
  into the week's widget `.js` verbatim, changing `WEEK` to `"weekNN"`.
- Call `TRACK.hit(host.id, kind)` from every control, with `kind` one of `slider`,
  `play`, `drag`, `preset`. Do not instrument changes an animation loop makes to a
  slider.
- Events come out as `widget-weekNN-<name>`, one per widget per page load.
- Give the PDF link in `notes.qmd` `data-goatcounter-click="pdf-weekNN"`, and add
  `?ref=notes-pdf-weekNN` to the site address printed inside the PDF. A PDF cannot
  report on itself; these are proxies for opening it and for returning from it.
- Add the new event names to the comment block in `_goatcounter.html`, and keep
  `analytics.qmd` accurate about what is collected.

### 4. Publish

- Add a row to the table in `index.qmd`: week number, topic, `[Notes](weeks/weekNN/notes.qmd)`,
  plus tutorial and slides links if those files exist.
- Add a sidebar section to `_quarto.yml`, in the same shape as the week before it,
  placed before the formula-sheet entry.
- Build the PDF:
  `quarto render weeks/weekNN/notes.qmd --to pdf --metadata-file weeks/weekNN/_pdf.yml`

### 5. Verify before you report back

- Render the page with Quarto, screenshot it, and look at it. Check the columns, the
  figures, and that nothing renders in the right margin.
- Confirm every `![](...)` target exists inside `weeks/weekNN/`.
- Re-run the maths through KaTeX and confirm the counts match the source notes: the
  conversion should not have changed any expression.
- Load the page in a headless browser with `window.goatcounter` stubbed. Confirm no
  console errors, that each widget initialises, that no event fires before interaction,
  and that exactly one event per widget fires after.
- Diff the converted notes against SOURCE paragraph by paragraph and list every
  paragraph that differs. The only differences should be the front matter, the two
  header blocks, the widget blocks, the extension-box fences and the `navy` spans.
- Render the extension box and look at it. The box must close before the material that
  follows the starred section, and no bare `::::` may appear in the page text.
- Check the YAML in `_quarto.yml` still parses and the sidebar lists the new week.

### Working rules

- Never overwrite a file on my disk without first re-reading it and passing the
  modification check. Do not use `force`. If a write is rejected, stop and tell me.
- Change my wording only where this prompt says to. When a change moves my text, move it
  verbatim.
- Tell me plainly when something cannot be done, rather than working around it.
````

---

## Notes for the person running it

- The first render on a machine that has not built the site before may fail on
  `resources:` copying with `PermissionDenied ... os error 1`. That is OneDrive: the
  PDFs under `weeks/` are cloud-only. Right-click `weeks` in Finder → "Always Keep on
  This Device", and give the terminal that runs `quarto` Full Disk Access, since
  `~/Library/CloudStorage` is a protected location.
- `tools/snapshot-widgets.js` has a `WIDGETS_BY_WEEK` table. A new week needs an entry
  there before `tools/build-pdf.sh weekNN` can regenerate the snapshots; until then the
  PNGs are whatever was captured by hand. If the week's widgets live in something other
  than `phasor-widgets.js`, the file also needs an entry in the `SRC_FILE` table above
  that, naming the file to load (week 5 uses `fourier-widgets.js`).
- The lecture-folder copy and the website copy of the notes diverge on purpose: the
  lecture copy carries its own `format:` block and `notes.scss`, the website copy
  inherits from `_quarto.yml`. Later edits to the wording need applying to both, or one
  picked as the source of truth.
