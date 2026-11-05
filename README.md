# REDZ.UI

The interface library of the REDZ products: plain CSS and small JavaScript on the browser platform - no framework, no
build step.

**Status:** 0.14.1 (2026-11-05) - see [Releases](#releases). Three demo screens in `reference/demo/` -
a list, a resource page and a settings form - show it in light and dark themes, left-to-right and right-to-left.

**Site:** [redz-tech.github.io/REDZ.UI](https://redz-tech.github.io/REDZ.UI/) - documentation and the demo screens of
the latest release at the root, of the main branch under `next/`, and of every release under its version.

**Why:** [why our own library instead of Bootstrap 5.3 or 6](docs/why.md) · [по-русски](docs/why.ru.md).

## What it is
- Tokens, a reset, cascade layers, components and utilities with Bootstrap 5's names, written as plain CSS files. The
  utilities are generated from one vocabulary file (`tools/vocabulary.json`, `php tools/build.php`) and committed, so
  nothing is built where the library is used.
- Behavior of the widgets that the platform does not give by itself - menus and tabs by keyboard, notices, a
  confirmation, busy buttons, a dialog closed by a click outside it - as small JavaScript modules that attach by
  delegation (see [Scripts](#scripts)).
- Two files a project serves, made by our own PHP tool (`tools/min.php`) and committed: `dist/redz-ui.min.css`, the
  stylesheets in one, squeezed, and `dist/redz-ui.min.js`, the modules as one ES module with short local names; each
  package's files beside them, `dist/redz-ui-charts.min.css` and the rest. Each pass proves its result, the probes run
  what `dist/` holds in every engine, and `css/`, `js/` and the packages' folders stay to read.
- Light, dark and system themes; left-to-right and right-to-left from one stylesheet; WCAG 2.2 AA in both themes.
- Documentation with a page per component, and every component in every state on one page, `docs/all.html` - the
  fixture checked in real engines, with its Arabic twin (see [Documentation](#documentation)).
- Two agent skills in `skills/`: building screens with REDZ.UI, and moving a project from Bootstrap 5.3 with a scan
  and a map of every Bootstrap class (see [Skills](#skills)).
- Budgets held on every commit: the stylesheet at most 32 KB and the script 30 KB, gzipped - the two files a project
  serves.

## How it reads
One rule for every class:
- A component, its variant, its size and its parts are one class each: `btn btn-primary btn-sm`, `card-header`.
  Bootstrap 5's names, and Bootstrap 6's where it moved onto the platform (`dialog`, `drawer`, `menu`, `check`,
  `switch`).
- A utility is `property-value`, with Bootstrap 5's names: `d-flex`, `justify-content-between`, `text-muted`.
- A condition is a prefix: `md:cols-2`, `print:d-none`. A width prefix measures the region the element sits in - a
  column, a dialog, a card - not the window; a page without the shell marks its own with the class `region`.
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
<link rel="stylesheet" href="dist/redz-ui.min.css">
<link rel="stylesheet" href="css/icons.css">

<i class="bi bi-pencil" aria-hidden="true"></i>
```

Such an icon follows the system colors in forced-colors mode and prints, from your own server or from a CDN that sends
CORS headers.

## Scripts
One file beside the stylesheet carries them all - `dist/redz-ui.min.js`, the modules of `js/index.js` as one; each
attaches by delegation on `document`, so nothing is set up per element and markup added later works the same:

```html
<script type="module" src="dist/redz-ui.min.js"></script>
<script type="application/json" id="redz-ui-text">{"close": "Close", "confirm.ok": "OK", "confirm.cancel": "Cancel", "confirm.phrase": "Type “{phrase}” to confirm", "busy": "Loading…", "remove": "Remove {label}", "found.one": "{count} result", "found.other": "{count} results", "create": "Create “{label}”", "strength.short": "Too short", "strength.fair": "Fair", "strength.good": "Good", "strength.strong": "Strong", "moved": "Moved to {position} of {count}", "more": "More", "slide": "{position} of {count}", "file.type": "{name} is not a kind of file this takes", "file.size": "{name} is larger than {size}"}</script>
```

- **Menus** (`role="menu"` on a `popover` opened by its button): the arrow keys move through the items, Home and End go
  to the ends, a letter to the next item it starts; Tab and Escape close the menu; the down and up arrows on its
  button open it on the first or the last item (`js/menu.js`).
- **Tabs** (`role="tablist"`): the arrow keys select the next tab and show its panel - mirrored right to left - Home
  and End the first and the last; only the selected tab takes Tab. With `data-activation="manual"` - panels that load
  from the server - the keys move the focus only, and Enter or Space selects. Before a person's choice selects a tab,
  the tablist fires the cancelable `redz:select` (`tab`, `from`), which a page answers to ask first (`js/tabs.js`).
- **Nav overflow** (`nav-overflow` around a nav): the links that do not fit the wrapper's own box hide from the end
  into a "More" menu after the nav, the current link and `nav-overflow-keep` ones staying in the row; a plain click on
  an item clicks the hidden link itself; a link that opens a menu folds as a group of its items. It watches the
  wrapper's size and the nav's links, and takes up a wrapper added later (`js/nav-overflow.js`).
- **Scrolling navs:** a nav or a tab list wider than its box scrolls, the edge it goes on past fades (`data-more`:
  start, end), and its current item is scrolled into its view when it loads (`js/nav-scroll.js`).
- **Navbars** (`navbar` with a `navbar-toggler` and a `<nav class="drawer" popover>`): below its `navbar-expand` width
  the toggler opens the links as a panel, which closes when a link in it is followed, when the focus leaves it for the
  page and when the header grows wide enough for its row (`js/navbar.js`).
- **Regions:** a button with `command="--toggle"` opens and closes the element its `aria-controls` names, closed as
  `hidden="until-found"`, so the browser's find in page still reaches its words and opens it; every button for the
  region says the state in `aria-expanded` (`js/toggle.js`); a table's row closes as plain `hidden`. It takes no
  `commandfor`, which WebKit would expose as collapsed whatever `aria-expanded` says. An accordion needs no script: it
  is `<details name>`.
- **Carousels:** the slides of a `carousel-inner` scroll and snap by the browser; buttons with `command="--prev"` or
  `"--next"` and `aria-controls` move a slide round the ends, an empty `carousel-indicators` fills with a button per
  slide, and `command="--play"` plays them while pressed - never for less motion, paused on hover and focus; a slide a
  person moves to is told politely (`js/carousel.js`).
- **The folded rail:** a header button with `command="--fold"` and `aria-controls` naming `app-sidebar` folds it into
  a rail of icons on a wide window and back (`aria-pressed`, `data-folded`); `redz:fold` tells the page, which keeps the
  choice (`js/fold.js`).
- **Notices:** `REDZ.ui.toast({title, text, tone, action, persistent})` shows a toast in the live regions of
  `.toast-container` - `role="status"`, `role="alert"` for `danger` - or in an open modal dialog's own. Success and info
  leave after 8 seconds unless the pointer or the focus rests on them; an error and a notice with an action stay until
  closed (`js/toast.js`).
- **Confirmation:** `await REDZ.ui.confirm({title, text, note, sections, ok, cancel, tone, phrase})` asks in a modal
  alert dialog and answers `true` or `false`; the focus starts on cancel. A `note` in a tone and `sections` - a title
  over a list, such as what goes and what stays - say what a deletion takes with it, all of it text. With a `phrase`
  the person types it first: the confirming button waits for it and the focus starts in its field (`js/confirm.js`).
- **Busy:** `REDZ.ui.busy(element, promise)` marks the element `aria-busy` until the promise settles. A button is also
  `aria-disabled`, which keeps its focus and swallows its clicks - as on every button, check, radio or switch so
  marked; its leading icon turns into a spinner, and `data-busy` gives the words it shows and says while it waits. A
  region - a card, its body, a dialog's or a drawer's body, any `region` - turns `inert` under an overlay that
  shows after 400 ms and stays at least 400 ms; once it shows, one polite message says so, and a focus the region
  dropped comes back to the same element or its namesake in the new content (`js/busy.js`).
- **Dialogs:** `closedby="any"` closes a modal dialog by a click outside it; a modal dialog locks the page's scroll by
  CSS alone (`js/dialog.js` stands in for `closedby` where the browser lacks it).
- **Comboboxes** (a search field `role="combobox"` controlling a `listbox`): typing filters the list - case and accents
  aside, every word found, the best first - the arrow keys move the active option while the focus stays in the field,
  Enter takes it, and once the typing pauses that option is said politely, or the count when nothing is found. In a form, a `combobox-toggle` button shows the value and opens
  the panel, and the value lives in hidden fields named by the list's `data-name`; a page that searches its server
  cancels `redz:search` and puts the options in. A list with `data-create` offers “Create …” for words no option has:
  the new label goes into the hidden field `data-create` names, or the page makes it through `redz:create`. The
  command palette is the same search in a `<dialog>`, its options links and buttons (`js/combobox.js`).
- **Inline edit:** a button with `command="--edit"` opens a form of class `inline-edit-form` in place of the value it
  names, or as a popover beside the button; Enter saves, Escape puts the field back. Its submit fires `redz:save`,
  which a page that saves answers with a promise: the Save button is busy, a refusal's words show as the field's error
  (`js/inline-edit.js`).
- **Passwords:** a button with `command="--reveal"` shows a password field's text and hides it again, `aria-pressed`
  saying which; elements with `data-strength` naming the field show its level as it is typed - by its length and its
  kinds of characters - a meter at once, the words after a pause (`js/password.js`).
- **Trees:** a list of class `tree` opens its groups by `--toggle` buttons; a group with `data-lazy` asks the page for
  its items by `redz:expand` on its first opening, and `--expand-all` / `--collapse-all` open and close a whole tree
  (`js/tree.js`).
- **Reordering:** a list, a table's `tbody`, a grid or a tree with `data-reorder` moves its items by a `drag-handle` -
  a button opening the list's menu of moves (up, down, first, last; in and out in a tree) - or by the pointer dragging
  it, down a column or, in a grid or a row, before or after the item under the pointer; the move is said, then
  `redz:move` lets the page save it or refuse it, which undoes it, and hidden fields hold the order (`js/reorder.js`).
- **PIN pads:** a `pin` around one numeric password field draws its dots and a keypad whose keys never take the focus;
  when the PIN is whole it asks the page in `redz:pin` and is busy while the page checks, a wrong one cleared and
  marked; left alone it submits its form (`js/pin.js`).
- **Cooldowns:** a button with `data-cooldown="N"` waits N seconds, `aria-disabled`, the seconds left after its words,
  then wakes; setting the attribute again starts it again (`js/cooldown.js`).
- **Views:** buttons with `command="--view"`, `aria-controls` and a `value` put the value in the list's `data-view` -
  tiles or rows - press the one that shows and tell the page in `redz:view`, which keeps the choice (`js/view.js`).
- **Highlights:** elements that share a `data-highlight` key light together on hover and focus - a chart's lane and its
  row in a table (`js/highlight.js`).
- **Uploads:** an `upload` takes files chosen, dropped on its `upload-zone` or pasted, checks each against `accept` and
  `data-max-size`, gives each a row from the page's `<template>` and sends each by `redz:files`, with its own progress
  and its own error; an input without `multiple` holds one file, a new one taking the place of the last;
  `upload-thumbs` shows images as thumbnails, `data-max-files` caps the count, and a page may answer with a prepared
  file that the form then sends (`js/upload.js`).
- **The page's answers:** a moment only the page can carry out is a cancelable `redz:*` event on the widget; the page
  that takes it calls `event.preventDefault()` and `event.detail.respondWith(promise)`, and the widget waits for the
  promise (`js/answer.js`).
- **Shortcuts:** a button or link whose `aria-keyshortcuts` names a combination with Control, Meta or Alt is pressed by
  it - `Meta+K Control+K` answers ⌘K on Apple's systems and Ctrl K elsewhere (`js/shortcuts.js`).
- **Scrollspy:** in a nav or list group with `data-scrollspy`, the link to the section in view says so in
  `aria-current="location"` (`js/scrollspy.js`).
- **Tooltips from titles:** inside an element with `data-tooltips` (`<html>` for the whole page) an element's own
  `title` shows as the library's tooltip after a short hover and on a keyboard's focus; Escape hides it, and the
  browser's own is held back meanwhile (`js/tooltips.js`).

The library has no words of its own: every word it shows comes from the caller or from the page's island
`#redz-ui-text`, and a missing one is named in the console.

## The editor

A package of the release, linked apart: `dist/redz-ui-editor.min.css` and the module `dist/redz-ui-editor.min.js`,
built from `editor/` as the main two are from `css/` and `js/`. The module sets
`REDZ.ui.editor(host, {value, placeholder, lang, dir, styles, scripts, blocks, images, embed, grid, onChange})` and
answers `getHTML()`, `setHTML(html)`, `focus()`, `destroy()`. It edits REDZ.UI markup only: prose in place, the
library's components as blocks kept as they came, a block that moves drawn open and previewed alive. The text lives
in a frame whose own Content-Security-Policy runs no script, and every value is parsed inert and cleaned, so nothing
in a stored body or on the clipboard runs. Its words are the island's `editor.*` texts, which the passport's
`editor.texts` lists apart from the library's; its budgets are 30 KB of script and 5 KB of styles, gzipped.

## Charts, calendars and the media library

Three more packages, linked on the screens that show them, listed in the passport's `packages` - each built into
`dist/` from its folder, `charts/`, `calendar/` and `media/`, which stay to read:
- `dist/redz-ui-charts.min.css` and the module `dist/redz-ui-charts.min.js` - a chart is the table of its numbers
  drawn by CSS: columns stacked by day (`chart`), a row's sparkline of runs (`spark`), a board of lanes over a time
  window (`lanes`). The numbers are `data-v`, `data-at`, `data-from`, `data-to`, `data-median` and `data-now`, shares
  from 0 to 1, which the module hands to the stylesheet through the CSSOM - a strict CSP that refuses `style`
  attributes allows it - and a chart table keeps its table roles for screen readers.
- `dist/redz-ui-calendar.min.css` - a month of days (`calendar`) and days across things (`schedule`); no script.
- `dist/redz-ui-media.min.css` - a folder of images as tiles or rows (`media-grid`, `media-tile`); its view switch is
  `--view` and its reordering `data-reorder`, both in the main script.

Their budgets, gzipped: charts 3 KB of styles and 2 KB of script, the calendar and the media library 2 KB each.

## Documentation
`docs/` on the site: getting started, layout, utilities, tokens, icons, the move from Bootstrap 5.3, and a page per
component - examples whose code is printed from the same markup, every state as a named grid, keyboard and
accessibility, the tokens the component reads and its rows of the Bootstrap map. `php tools/docs.php` writes them from
their sources in `docs/src/` inside one shell, with `docs/all.html` - every example and state of every page on one
page - the Arabic twins of that page and of the demo screens (`docs/ar.tsv`), a Markdown twin of every page, and
`llms.txt` with `llms-full.txt`; `--check` holds them to their sources on every commit. States the pointer or the keys
make - `:hover`, `:focus-visible`, `:focus` - are shown by the docs' own script, which copies those rules under
`[data-docs-state]`; the library's stylesheets carry no classes for the docs.

## Skills
Two skills in the open [Agent Skills](https://agentskills.io/) format, released with the library:
- `skills/redz-ui` - building screens: the rules, the page, and a reference per component;
- `skills/redz-ui-from-bootstrap-5` - moving a project from Bootstrap 5.3, file by file: `scripts/scan.sh` reports every
  Bootstrap class, `data-bs-*` attribute and `bootstrap.*` call left with its REDZ.UI form, and every class REDZ.UI does
  not have; the agent rewrites each file whole and scans again until nothing is left.

Both carry `assets/map.tsv` - every class of Bootstrap 5.3.8 and its REDZ.UI form, written by `php tools/map.php` from
Bootstrap's own stylesheet and `tools/map/rules.tsv` - and `assets/classes.txt`, every class of the library. Install
them with `npx skills add redz-tech/REDZ.UI`, or copy the folders into `.agents/skills/`.

## Browsers
Bootstrap 6's floor: Chrome and Edge 130+, Firefox 132+, Safari 18+ (macOS and iOS) - the browsers of autumn 2024.
What must work rests on features of the floor. Invoker commands, anchor positioning and `closedby` are enhancements: the
library writes them, and its scripts stand in below them and where an engine gets them wrong - `js/commands.js` hands a
command to the browser's own `popovertarget` or calls the dialog, `js/menu-place.js` places a menu the engine did not
put beside its button, `js/dialog.js` closes a dialog by a click outside it. Nothing is written for older browsers.

**The floor gate.** `php tools/floor.php check` reads every stylesheet and page of the library and checks each
property, value, function, unit, selector, at-rule, media feature, element and attribute against MDN's
[browser-compat-data](https://github.com/mdn/browser-compat-data) at those versions - on every commit and in the Check
workflow here. A block is checked only for the browsers that can apply it: `@media (forced-colors: active)` and
`@supports (…)` narrow them. A vendor form beside a property covers the browsers that need it, as
`-webkit-print-color-adjust` does for Chrome 130-135. Every exception is in `tools/floor/rules.json` with its reason,
and so is every repair of an engine bug with the first versions that fixed it: when the floor passes those versions, the
gate asks for the exception or the repair to be removed. `php tools/floor.php check your.css page.html` checks your own
files the same way.

`floor.json` lists every name the gate knows - `property:print-color-adjust`, `value:display:grid`, `unit:dvh`,
`selector:has`, `media:forced-colors`, `attribute:button:commandfor` - with `"ok"` or, per browser, what the floor
lacks. Its data is a pinned version of browser-compat-data in `tools/floor/bcd.tsv`, fetched and checked against its
sha512 by `php tools/floor.php refresh`.

**Checks in real engines.** `php tools/probe.php` opens the all-components page, the demo screens and the landing in
the installed Chrome, Firefox and Safari, in the floor's Chrome 130, Firefox 132 and Safari 18 in the iOS simulator, and
in Chrome 136 and Safari 26 in the simulator, whose bugs `js/menu-place.js` repairs - at 1440, 1024, 390 and 320 px,
light left-to-right and dark right-to-left, the right-to-left cells on the pages' Arabic twins. It looks for overflow,
icons without a mask, width prefixes outside a region, cut labels, `aria-busy` on live regions and errors; opens every
menu and dialog and checks where it lands; walks every menu, combobox, modal dialog and tab list by real keys - and a
dialog with `closedby` by a click outside it - against the WAI-ARIA patterns, and sends two notices; holds the docs' copies of
`:hover` and `:focus-visible` against the real pointer and Tab; has Chrome name the fonts of the Arabic text; runs
axe-core; checks forced colors and print where the engine has them; and runs the minifier's scripts of `tools/min/` as
written and minified, and the release's stylesheet as written and squeezed, which must agree. Every docs page runs in the current Chrome,
Firefox and Safari at 1440 and 390 px. Older engines are fetched once into `~/Library/Caches/redz-ui` and checked
against their checksums. The screen readers go through the speech steps of every widget that speaks, against the words
each step must hold: `voiceover` hears VoiceOver in Safari; `nvda-chrome` and `nvda-firefox` hear NVDA 2026.3 in Chrome
and Firefox on Windows - a portable copy made from its official installer, its speech and keys through NVDA's own
Remote Access, so it meets a page in browse mode as a user does - and NVDA also reads each of those pages whole by its
quick navigation (headings, landmarks, form fields) against what the page holds. The sheet of shots and findings is
written to `.dev/probes/`; the Probes workflow runs it on every commit in nine parts - joined by `php tools/probe.php
merge` - on macOS 15, VoiceOver also on macOS 26, NVDA on Windows Server 2025, with a pinned Chrome for Testing build as
the current Chrome, as the images' own lag; every release publishes its sheet under `checks/` on the site. On a Mac the
engines run at once, a process each (the engines `safaridriver` drives, Safari, VoiceOver and the simulators, one after
another; `--serial` runs them all so), and `--pages=docs/menu.html,…` checks only those pages, as the workflow's `pages` input does for a lab
run. CI checks only what changed since the nearest commit that passed (`php tools/probe.php affected BASE` says what and
why: nothing for texts and tools, the changed pages alone, or everything), a commit that passed runs nothing again, and a run whose job GitHub
never placed on a runner runs its failed jobs once more by itself.

## Releases
Every release is an [immutable GitHub release](https://github.com/redz-tech/REDZ.UI/releases): once it is out, neither
its tag nor its files can change, and GitHub signs an attestation of both. A tag `v*` becomes a release only when the
probes are clean in every engine; the release carries two files:
- `redz-ui-<version>.zip` - `dist/`, `css/`, `js/`, `icons/`, `floor.json`, the license files, this README, the
  changelog and the passport `redz-ui.json`: the version, the floor, the two files a project serves, the stylesheets a
  bundle joins in their order, the modules of `js/index.js`, every class, custom property, command and text key of the
  library, and the sha256 of every file in the SRI form. `php tools/build.php` writes the two files and the passport,
  and `--check` holds them current on every commit;
- `checks.zip` - the sheet of the probes the release passed, also on the site under `<version>/checks/`.

```sh
gh release download v0.14.1 --repo redz-tech/REDZ.UI --pattern 'redz-ui-*.zip'
gh release verify-asset v0.14.1 redz-ui-0.14.1.zip --repo redz-tech/REDZ.UI
```

jsDelivr serves a release by its tag: `https://cdn.jsdelivr.net/gh/redz-tech/REDZ.UI@v0.14.1/dist/redz-ui.min.css`. Versions
follow Semantic Versioning: a class, token, attribute or JavaScript call removed or renamed is a major release, one
added is a minor release, a fix is a patch; while the version is 0.x, a removal or a rename is a minor release.

## License
MIT - see [LICENSE](LICENSE). Pieces taken from other MIT-licensed projects are listed with their notices in `NOTICE`.
