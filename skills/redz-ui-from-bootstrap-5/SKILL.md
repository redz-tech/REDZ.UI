---
name: redz-ui-from-bootstrap-5
description: Move a project's markup, styles and scripts from Bootstrap 5.3 to REDZ.UI, file by file — find what Bootstrap left with scripts/scan.sh and the map assets/map.tsv, rewrite each file whole, scan again until nothing is left. Use when a project links Bootstrap 5 (bootstrap.css, bootstrap.bundle.js, data-bs-* attributes, row and col grids) and is to run on REDZ.UI instead.
license: MIT
metadata:
  version: "0.1.0"
  from: "bootstrap 5.3.8"
---

# From Bootstrap 5.3 to REDZ.UI

REDZ.UI keeps most of Bootstrap 5's names. What changes: spacing numbers are pixels, the grid is set by the parent,
breakpoint infixes become prefixes that measure the region, states are attributes, triggers are the browser's invoker
commands, and modal / dropdown / offcanvas are `dialog` / `menu` / `drawer`. The two stylesheets are never on one page:
the project switches at once, so migrate on a branch and switch the `<link>` with the last file.

## The loop

1. **Inventory.** `scripts/scan.sh --own PREFIX PATH > before.txt` lists every finding as
   `FILE:LINE:TOKEN:KIND:REDZ-UI`. Pass `--own` for each prefix of the project's own classes (`--own erp-`), so they
   are not reported as unknown. Count findings per file; start with three small files.
2. **Before.** Take screenshots of every screen the file renders — with its dialogs, menus, tabs and error states
   open, as screenshots miss what is closed.
3. **Rewrite the whole file in one pass**, finding by finding, by the kind (below) and `assets/map.tsv` (its `note`
   column says why). Never chain find-and-replace over files: `p-4` exists in both libraries with other sizes.
4. **Scan the file again** — `scripts/scan.sh --own PREFIX FILE` — until it prints nothing. Its exit code is 0 then.
5. **After.** Compare the screenshots; open the same dialogs, menus and tabs; press Tab through the screen.
6. **Record** the file as done, and add every correction you had to make to the gotchas of your project.

## What each kind asks

| Kind | Do |
| --- | --- |
| `rename`, `value` | Write the REDZ.UI form. `value` changed a number: Bootstrap's `mb-3` is 16 px, so `mb-16`. |
| `grid` | Move the layout to the parent: `row` → `grid` with `cols-N` or `cols-12`; `col-md-6` → `md:span-6`. See `references/grid.md`. |
| `state` | Drop the class; set the attribute of the role — `aria-current`, `aria-selected`, `aria-pressed`, `aria-invalid`, `disabled`. See `references/states-and-triggers.md`. |
| `trigger` | Replace the `data-bs-*` trigger or `bootstrap.*` call with the browser's command or method. See `references/states-and-triggers.md`. |
| `remove` | Delete it: the wrapper or helper is not needed (`modal-dialog`, `fade`, `nav-item`). |
| `missing` | REDZ.UI has no such component yet (accordion, list group, progress, input group, ratio, pagination, popover, carousel). Keep the markup in the module's own classes with its prefix, and leave a note; do not invent a REDZ.UI class. |
| `review` | Decide by context; the map's note proposes the nearest form. |
| `unknown` | Not a class of REDZ.UI: invented, a Bootstrap 6 habit, or a module class without its prefix. |

## Gotchas

- **Reused names.** `p-1`…`p-5`, `m-*`, `gap-*` and `rounded-1`…`rounded-5` exist in both with other sizes: Bootstrap's
  `p-4` is 24 px, REDZ.UI's `p-4` is 4 px. A file rewritten halfway cannot be read back — finish it in one pass.
- **Bootstrap 6 look-alikes are not REDZ.UI.** `md:col-6`, `data-bs-toggle="dialog"`, `fg-*`, `btn-solid` do not
  exist here; the scan reports them as `unknown`.
- **Prefixes measure the region**, not the window: a column, a card, a dialog. A card in the 8-of-12 column at 1440 px
  is about 740 px wide — `sm:` inside it, not `md:`. A page without the shell marks its own `region`.
- **No wrappers.** `modal-dialog` and `modal-content`, the `dropdown` wrapper, `nav-item` items go: the `<dialog>`, the
  popover menu and the links are the boxes.
- **States are attributes.** Script that selected `.active` or `.show` must select `[aria-current]` or `:popover-open`
  now — the scan reports class names in `querySelector`, `closest`, `matches` and `classList`.
- **Classes built in code** (`'btn-' . $tone`, `class="alert-<?= $x ?>"`) are invisible to any scan: write the full
  names in a lookup — `['danger' => 'btn-danger', …]` — so the next scan reads them.
- **Words come from the page.** REDZ.UI has no words of its own: the close button, the confirm's buttons and the busy
  message read the island `<script type="application/json" id="redz-ui-text">` — keys `close`, `confirm.ok`,
  `confirm.cancel`, `busy`.
- **Icons stay**: `bi bi-NAME` keep their classes; swap the Bootstrap Icons font stylesheet for `css/icons.css`.

## The page

```html
<link rel="stylesheet" href="redz-ui/css/index.css">
<link rel="stylesheet" href="redz-ui/css/icons.css">
<script type="module" src="redz-ui/js/index.js"></script>
<script type="application/json" id="redz-ui-text">{"close": "Close", "confirm.ok": "OK", "confirm.cancel": "Cancel", "busy": "Loading…"}</script>
```

Remove `bootstrap.css`, `bootstrap.bundle.js` and their initialisation code (`new bootstrap.Tooltip(…)` loops):
menus, tabs and dialogs need no start-up call.

## References

- `references/grid.md` — rows, columns, gutters and containers.
- `references/states-and-triggers.md` — state classes, `data-bs-*`, the JS API and events.
- `references/components.md` — modal, dropdown, offcanvas, forms, tables, toasts, navs, badges, alerts.
- `assets/map.tsv` — every class of Bootstrap 5.3.8 and its REDZ.UI form: `bs5`, `redz`, `kind`, `scope`, `page`,
  `note`. `page` names the docs page: `https://redz-tech.github.io/REDZ.UI/docs/PAGE.html`.
- `assets/classes.txt` — every class REDZ.UI has; a class that is not there does not exist.
