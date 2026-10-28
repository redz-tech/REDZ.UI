# REDZ.UI

The interface library of the REDZ products: plain CSS and small JavaScript on the browser platform — no framework, no
build step.

**Status:** in design. Nothing is released yet. The look is approved as a prototype and written by the reading rules
below: three demo screens in `reference/demo/` — a list, a resource page and a settings form — in light and dark
themes, left-to-right and right-to-left.

**Site:** [redz-tech.github.io/REDZ.UI](https://redz-tech.github.io/REDZ.UI/) — documentation and the demo screens of
the latest release at the root, of the main branch under `next/`, and of every release under its version.

**Why:** [why our own library instead of Bootstrap 5.3 or 6](docs/why.md) · [по-русски](docs/why.ru.md).

## What it is
- Tokens, a reset, cascade layers, components and utilities with Bootstrap 5's names, written as plain CSS files. The
  utilities are generated from one vocabulary file (`tools/vocabulary.json`, `php tools/build.php`) and committed, so
  nothing is built where the library is used.
- Behavior of the widgets that the platform does not give by itself — menus and tabs by keyboard, notices, a
  confirmation, busy buttons, a dialog closed by a click outside it — as small JavaScript modules that attach by
  delegation (see [Scripts](#scripts)).
- Light, dark and system themes; left-to-right and right-to-left from one stylesheet; WCAG 2.2 AA in both themes.
- Documentation with a page per component, and every component in every state on one page, `docs/all.html` — the
  fixture checked in real engines, with its Arabic twin (see [Documentation](#documentation)).
- Two agent skills in `skills/`: building screens with REDZ.UI, and moving a project from Bootstrap 5.3 with a scan
  and a map of every Bootstrap class (see [Skills](#skills)).
- Budgets held on every commit: the stylesheet at most 24 KB and the scripts 25 KB, gzipped as one file each.

## How it reads
One rule for every class:
- A component, its variant, its size and its parts are one class each: `btn btn-primary btn-sm`, `card-header`.
  Bootstrap 5's names, and Bootstrap 6's where it moved onto the platform (`dialog`, `drawer`, `menu`, `check`,
  `switch`).
- A utility is `property-value`, with Bootstrap 5's names: `d-flex`, `justify-content-between`, `text-muted`.
- A condition is a prefix: `md:cols-2`, `print:d-none`. A width prefix measures the region the element sits in — a
  column, a dialog, a card — not the window; a page without the shell marks its own with the class `region`.
- The number is the value: `p-16` is 16 px, `rounded-8` is 8 px, `w-50` is 50 %, `cols-3` is three columns.
- The parent sets the grid: `grid md:cols-2 gap-16`; a child spans with `span-full` or `lg:span-8`.
- A state is an HTML attribute: `aria-current`, `aria-pressed`, `disabled`, `[open]`. A button opens a dialog with the
  browser's own command: `commandfor="edit" command="show-modal"`.
- Tokens are `--redz-` plus the same words: `--redz-text-muted`, `--redz-space-16`.

## Icons
[Bootstrap Icons](https://icons.getbootstrap.com/) 1.13.2, one SVG file per icon in `icons/`, under their own class
names. `css/icons.css` delivers each icon as a CSS mask over its file, so an icon takes the color of the text around it
and needs no font, no JavaScript and no build:

```html
<link rel="stylesheet" href="css/index.css">
<link rel="stylesheet" href="css/icons.css">

<i class="bi bi-pencil" aria-hidden="true"></i>
```

Such an icon follows the system colors in forced-colors mode and prints, from your own server or from a CDN that sends
CORS headers.

## Scripts
One module beside the stylesheet loads them all; each attaches by delegation on `document`, so nothing is set up per
element and markup added later works the same:

```html
<script type="module" src="js/index.js"></script>
<script type="application/json" id="redz-ui-text">{"close": "Close", "confirm.ok": "OK", "confirm.cancel": "Cancel", "busy": "Loading…"}</script>
```

- **Menus** (`role="menu"` on a `popover` opened by its button): the arrow keys move through the items, Home and End go
  to the ends, a letter to the next item it starts; Tab and Escape close the menu; the down and up arrows on its
  button open it on the first or the last item (`js/menu.js`).
- **Tabs** (`role="tablist"`): the arrow keys select the next tab and show its panel — mirrored right to left — Home
  and End the first and the last; only the selected tab takes Tab. With `data-activation="manual"` — panels that load
  from the server — the keys move the focus only, and Enter or Space selects (`js/tabs.js`).
- **Notices:** `REDZ.ui.toast({title, text, tone, action, persistent})` shows a toast in the live regions of
  `.toast-container` — `role="status"`, `role="alert"` for `danger` — or in an open modal dialog's own. Success and info
  leave after 8 seconds unless the pointer or the focus rests on them; an error and a notice with an action stay until
  closed (`js/toast.js`).
- **Confirmation:** `await REDZ.ui.confirm({title, text, ok, cancel, tone})` asks in a modal alert dialog and answers
  `true` or `false`; the focus starts on cancel (`js/confirm.js`).
- **Busy:** `REDZ.ui.busy(element, promise)` marks the element `aria-busy` until the promise settles. A button is also
  `aria-disabled`, which keeps its focus and swallows its clicks — as on every button, check, radio or switch so
  marked. A region — a card, its body, a dialog's or a drawer's body, any `region` — turns `inert` under an overlay that
  shows after 400 ms and stays at least 400 ms; once it shows, one polite message says so, and a focus the region
  dropped comes back to the same element or its namesake in the new content (`js/busy.js`).
- **Dialogs:** `closedby="any"` closes a modal dialog by a click outside it; a modal dialog locks the page's scroll by
  CSS alone (`js/dialog.js` stands in for `closedby` where the browser lacks it).

The library has no words of its own: every word it shows comes from the caller or from the page's island
`#redz-ui-text`, and a missing one is named in the console.

## Documentation
`docs/` on the site: getting started, layout, utilities, tokens, icons, the move from Bootstrap 5.3, and a page per
component — examples whose code is printed from the same markup, every state as a named grid, keyboard and
accessibility, the tokens the component reads and its rows of the Bootstrap map. `php tools/docs.php` writes them from
their sources in `docs/src/` inside one shell, with `docs/all.html` — every example and state of every page on one
page — the Arabic twins of that page and of the demo screens (`docs/ar.tsv`), a Markdown twin of every page, and
`llms.txt` with `llms-full.txt`; `--check` holds them to their sources on every commit. States the pointer or the keys
make — `:hover`, `:focus-visible`, `:focus` — are shown by the docs' own script, which copies those rules under
`[data-docs-state]`; the library's stylesheets carry no classes for the docs.

## Skills
Two skills in the open [Agent Skills](https://agentskills.io/) format, released with the library:
- `skills/redz-ui` — building screens: the rules, the page, and a reference per component;
- `skills/redz-ui-from-bootstrap-5` — moving a project from Bootstrap 5.3, file by file: `scripts/scan.sh` reports every
  Bootstrap class, `data-bs-*` attribute and `bootstrap.*` call left with its REDZ.UI form, and every class REDZ.UI does
  not have; the agent rewrites each file whole and scans again until nothing is left.

Both carry `assets/map.tsv` — every class of Bootstrap 5.3.8 and its REDZ.UI form, written by `php tools/map.php` from
Bootstrap's own stylesheet and `tools/map/rules.tsv` — and `assets/classes.txt`, every class of the library. Install
them with `npx skills add redz-tech/REDZ.UI`, or copy the folders into `.agents/skills/`.

## Browsers
Bootstrap 6's floor: Chrome and Edge 130+, Firefox 132+, Safari 18+ (macOS and iOS) — the browsers of autumn 2024.
What must work rests on features of the floor. Invoker commands, anchor positioning and `closedby` are enhancements: the
library writes them, and its scripts stand in below them and where an engine gets them wrong — `js/commands.js` hands a
command to the browser's own `popovertarget` or calls the dialog, `js/menu-place.js` places a menu the engine did not
put beside its button, `js/dialog.js` closes a dialog by a click outside it. Nothing is written for older browsers.

**The floor gate.** `php tools/floor.php check` reads every stylesheet and page of the library and checks each
property, value, function, unit, selector, at-rule, media feature, element and attribute against MDN's
[browser-compat-data](https://github.com/mdn/browser-compat-data) at those versions — on every commit and in the Check
workflow here. A block is checked only for the browsers that can apply it: `@media (forced-colors: active)` and
`@supports (…)` narrow them. A vendor form beside a property covers the browsers that need it, as
`-webkit-print-color-adjust` does for Chrome 130–135. Every exception is in `tools/floor/rules.json` with its reason,
and so is every repair of an engine bug with the first versions that fixed it: when the floor passes those versions, the
gate asks for the exception or the repair to be removed. `php tools/floor.php check your.css page.html` checks your own
files the same way.

`floor.json` lists every name the gate knows — `property:print-color-adjust`, `value:display:grid`, `unit:dvh`,
`selector:has`, `media:forced-colors`, `attribute:button:commandfor` — with `"ok"` or, per browser, what the floor
lacks. Its data is a pinned version of browser-compat-data in `tools/floor/bcd.tsv`, fetched and checked against its
sha512 by `php tools/floor.php refresh`.

**Checks in real engines.** `php tools/probe.php` opens the all-components page, the demo screens and the landing in
the installed Chrome, Firefox and Safari, in the floor's Chrome 130, Firefox 132 and Safari 18 in the iOS simulator, and
in Chrome 136 and Safari 26 in the simulator, whose bugs `js/menu-place.js` repairs — at 1440, 1024, 390 and 320 px,
light left-to-right and dark right-to-left, the right-to-left cells on the pages' Arabic twins. It looks for overflow,
icons without a mask, width prefixes outside a region, cut labels, `aria-busy` on live regions and errors; opens every
menu and dialog and checks where it lands; walks every menu, modal dialog and tab list by real keys — and a dialog with
`closedby` by a click outside it — against the WAI-ARIA patterns, and sends two notices; holds the docs' copies of
`:hover` and `:focus-visible` against the real pointer and Tab; has Chrome name the fonts of the Arabic text; runs
axe-core; and checks forced colors and print where the engine has them. Every docs page runs in the current Chrome,
Firefox and Safari at 1440 and 390 px. Older engines are fetched once into `~/Library/Caches/redz-ui` and checked
against their checksums. The sheet of shots and findings is written to `.dev/probes/`; the Probes workflow runs it on
macOS 15 on every commit in five parallel parts — joined by `php tools/probe.php merge` — with a pinned Chrome for
Testing build as the current Chrome, as the image's own lags; every release publishes its sheet under `checks/` on the
site.

## License
MIT — see [LICENSE](LICENSE). Pieces taken from other MIT-licensed projects are listed with their notices in `NOTICE`.
