#!/usr/bin/env bash
# Build a week's notes as a PDF and put it next to the .qmd, where the site
# build will pick it up as a resource and the "Other formats" link can find it.
#
#   tools/build-pdf.sh            # defaults to week01
#   tools/build-pdf.sh week02
#
# Why not just declare pdf as a second format in the .qmd? Because then every
# `quarto preview` and every full site render also runs LaTeX: previews get
# slow, and any PDF-only failure takes the HTML page down with it.
#
# Quarto writes a single-file render into the project output directory, so the
# PDF is moved out of _site afterwards. Anything left in _site is destroyed by
# the next full render.

set -euo pipefail

WEEK="${1:-week01}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QMD="weeks/${WEEK}/notes.qmd"
META="weeks/${WEEK}/_pdf.yml"
DEST="${ROOT}/weeks/${WEEK}/notes.pdf"

cd "$ROOT"

[ -f "$QMD" ]  || { echo "no such file: $QMD" >&2; exit 1; }
[ -f "$META" ] || { echo "no such file: $META" >&2; exit 1; }

# The figures are generated; rebuild them if any is missing or out of date.
NEEDS_SNAPSHOT=0
for fig in weeks/${WEEK}/figs/w-*.png; do
  [ -e "$fig" ] || { NEEDS_SNAPSHOT=1; break; }
done
if [ "$NEEDS_SNAPSHOT" = "1" ]; then
  echo "==> widget snapshots missing, generating them first"
  ( cd tools && node snapshot-widgets.js "${WEEK}" )
elif [ -n "$(find weeks/${WEEK} -maxdepth 1 -name phasor-widgets.js -newer "$(ls weeks/${WEEK}/figs/w-*.png | head -1)" 2>/dev/null)" ]; then
  echo "==> phasor-widgets.js is newer than the snapshots, regenerating them"
  ( cd tools && node snapshot-widgets.js "${WEEK}" )
fi

echo "==> rendering $QMD to PDF"
quarto render "$QMD" --to pdf --metadata-file "$META"

# Quarto puts it in the project output dir; move it beside the source.
OUTDIR="$(python3 -c "import yaml;print(yaml.safe_load(open('_quarto.yml'))['project'].get('output-dir','_site'))" 2>/dev/null || echo _site)"
BUILT="${ROOT}/${OUTDIR}/weeks/${WEEK}/notes.pdf"

if [ -f "$BUILT" ]; then
  mv "$BUILT" "$DEST"
elif [ -f "${ROOT}/weeks/${WEEK}/notes.pdf" ]; then
  :                       # already written in place
else
  echo "rendered, but could not find notes.pdf in ${OUTDIR}/weeks/${WEEK}/" >&2
  exit 1
fi

echo "==> $(cd "$ROOT" && ls -lh "weeks/${WEEK}/notes.pdf" | awk '{print $9, $5}')"
echo "    linked from the notes page as \"Other formats\"; run a site render to publish it."
