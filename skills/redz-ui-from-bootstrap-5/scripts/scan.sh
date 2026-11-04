#!/usr/bin/env bash
# scan.sh - what is left of Bootstrap 5.3 in a project, read only. Prints one line per finding,
# FILE:LINE:TOKEN:KIND:REDZ-UI (the REDZ.UI form, or the map's note where there is none), and exits 1 while any is left:
#   a Bootstrap class, data-bs-* attribute, bootstrap.* call or --bs-* custom property, from assets/map.tsv;
#   a class REDZ.UI does not have (assets/classes.txt) - invented, a Bootstrap 6 habit, an icon icons/ lacks, or a
#   module's own class without its prefix (name the prefixes with --own); a class built in code - write it out whole.
# Stylesheets are read for --bs-* only. Minified files (*.min.js, *.min.css) are left out: they are built from sources.
# A class value written over several lines is read whole and told at the line it starts on.
# Usage: scan.sh [--own PREFIX]... [PATH]...   (default PATH: the current folder)
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
own=""
paths=""
while [ $# -gt 0 ]; do
	case "$1" in
		--own) own="$own $2"; shift 2 ;;
		-h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) paths="$paths$1
"; shift ;;
	esac
done
[ -n "$paths" ] || paths=".
"
status=0
printf '%s' "$paths" | while IFS= read -r path; do
	find "$path" -type d \( -name .git -o -name node_modules -o -name vendor \) -prune -o -type f \( -name '*.php' -o -name '*.phtml' -o -name '*.html' -o -name '*.htm' -o -name '*.twig' -o -name '*.tpl' -o -name '*.js' -o -name '*.mjs' -o -name '*.vue' -o -name '*.css' -o -name '*.scss' -o -name '*.less' \) ! -name '*.min.js' ! -name '*.min.css' -print0
done | xargs -0 awk -v own="$own" -f "$here/scripts/scan.awk" "$here/assets/map.tsv" "$here/assets/classes.txt" || status=$?
exit "$status"
