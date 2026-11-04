# ELEC2302 website — setup and maintenance

The site lives in this `website/` folder. It is a self-contained Quarto project; nothing
outside this folder is needed to build it.

```
website/
  _quarto.yml          site config: title, sidebar, HTML theme
  index.qmd            landing page
  theme.scss           house style for notes pages (was notes.scss)
  slides.scss          house style for revealjs decks
  SETUP.md             this file
  weeks/week01/
    slides.qmd         Week 1 intro deck (revealjs)
    notes.qmd          Week 1 typeset notes
    *.png *.svg        figures used by the above
    phasor-widgets.js  interactive widgets for the notes
    resonant-lowpass.html  widget iframed into the slides
```

Build locally with:

```bash
cd website
quarto render      # writes _site/
quarto preview     # live preview in the browser
```

`_site/` and `.quarto/` are gitignored — only sources are committed.

---

## One-time GitHub setup

### 1. Create the repository

On GitHub, create a new **public** repository. Public is required for GitHub Pages on a
free account, and students need to reach it anyway. Name it something like `elec2302`.
Do **not** add a README, .gitignore or licence — start it empty.

The published URL will be:

```
https://thomaschaffey.github.io/elec2302/
```

### 2. Initialise the local repo

In Terminal, from this folder:

```bash
cd "/Users/tcha4856/Library/CloudStorage/OneDrive-TheUniversityofSydney(Staff)/ELEC2302/lectures/website"

git init
git add .
git commit -m "Initial site: landing page and Week 1"
git branch -M main
git remote add origin https://github.com/ThomasChaffey/elec2302.git
git push -u origin main
```

If git asks for a password, use a **personal access token**, not your GitHub password:
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token, give it `Contents: read and write` on this repo. (Setting up an SSH
key instead is a one-off alternative that avoids tokens entirely.)

### 3. Publish

```bash
quarto publish gh-pages
```

This renders the site, creates a `gh-pages` branch containing only the built HTML, pushes
it, and adds the `.nojekyll` marker GitHub Pages needs. Say yes when it offers to publish.

### 4. Check the Pages setting

Go to the repo on GitHub → **Settings** → **Pages**. Source should read
*Deploy from a branch*, branch `gh-pages`, folder `/ (root)`. `quarto publish` usually
sets this for you; if it hasn't, set it manually and save.

Give it a minute, then load <https://thomaschaffey.github.io/elec2302/>.

---

## Publishing updates

Whenever you change anything:

```bash
git add .
git commit -m "Add Week 2 notes"
git push

quarto publish gh-pages
```

The `git push` keeps your sources backed up on `main`; `quarto publish` rebuilds and
redeploys the live site. They are separate steps — pushing sources alone does not update
the site.

---

## Adding a new week

1. Create the folder and copy in the sources:

   ```bash
   mkdir -p weeks/week02
   cp "../lecture 2/lecture02-notes.qmd" weeks/week02/notes.qmd
   # plus any .png/.svg/.js files the notes reference
   ```

2. Strip the `format:` block out of the copied `notes.qmd` front matter. The site supplies
   the theme, TOC and KaTeX; a per-file `format:` block (especially
   `embed-resources: true`) will fight with it. Keep only `title:` and `subtitle:`.
   For a slides deck, keep its `format: revealjs:` block but point the theme at
   `../../slides.scss`.

3. Add it to the sidebar in `_quarto.yml`:

   ```yaml
         - section: "Week 2 — Signals as vectors"
           contents:
             - text: "Slides"
               href: weeks/week02/slides.qmd
               target: _blank
             - text: "Notes"
               href: weeks/week02/notes.qmd
   ```

4. Add a row to the table in `index.qmd`.

5. `quarto render` to check, then commit, push and `quarto publish gh-pages`.

Figures and widget files are referenced by plain relative filename, so keeping each week's
assets in its own `weeks/weekNN/` folder means nothing else has to change.

---

## Notes on how it is wired

- **Slides open in a new tab.** The sidebar entry has `target: _blank`, so a revealjs deck
  (which has no site chrome of its own) does not strand students without a way back.
- **Search is off** in `_quarto.yml`. Turn it on with `search: true` under `website:` if
  you ever want it.
- **KaTeX, not MathJax**, matching your original notes; set once site-wide under
  `format: html:`.
- **Assets are copied automatically.** Quarto picks up files the pages reference —
  including `resonant-lowpass.html`, which is iframed rather than linked — and copies them
  into `_site/`. If you add a file that nothing references directly, list it under a
  `resources:` key in `_quarto.yml`.
- **The Week 1 sources here are copies**, not the originals in `../lecture 1/`. Edit the
  copies in `weeks/week01/` when you want to change what students see.
