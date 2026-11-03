# REDZ.UI — Changelog

All notable changes of the library. Newest first. Versions follow Semantic Versioning: a class, token, attribute
or JavaScript call removed or renamed is a major release, one added is a minor release, a fix is a patch. While the
version is 0.x, a removal or a rename is a minor release, as Semantic Versioning allows, and its section says so.

## Unreleased

### Structures: trees, reordering, uploads
- Trees (`css/components/tree.css`, `js/tree.js`): `tree` › `tree-item` › a `tree-row` with a `tree-toggle` — a
  `--toggle` button for the item's `tree-group`, its chevron turned when open and mirrored right to left — and the
  item's link. A group with `data-lazy` and no items fires `redz:expand` when it first opens: answered with a promise,
  its toggle is busy until the page has put the items in, and a refusal closes it for another try. `--expand-all` and
  `--collapse-all` on a button for the tree open and close every group that holds items.
- Reordering (`js/reorder.js`): a list or a tree with `data-reorder` naming a hidden field moves its items, each with a
  `data-value`, by a `drag-handle` — a button opening the list's menu of moves, its items `data-move="up"`, `down`,
  `first`, `last`, and in a tree `in`, to the end of the group of the item above, and `out`, after its parent — or by
  the pointer dragging the handle within its group (pointer events, a tap still opens the menu). A move is done at
  once, the focus back on the handle and the page's text `moved` said; then `redz:move` on the item: refused, the move
  is undone and the page's words said; left alone, hidden fields beside the list hold the order, and with
  `data-parent` each item's parent.
- Uploads (`css/components/upload.css`, `js/upload.js`): an `upload` with its file input, an `upload-zone` button, a
  `<template>` of one file's row and an `upload-list`. Chosen, dropped on the zone or pasted, each file is checked
  against `accept` and `data-max-size` — the page's texts `file.type` and `file.size` say a refusal in its row — then
  sent on its own by `redz:files`, with its row, `progress(fraction)` for its bar and a `signal` its remove button
  aborts; one file's error leaves the others. Left alone, the file joins the input's files for the form. A file
  dropped beside the zone does not open in the window; each remove button is named after its file.
- The names pass reads `.catch(` and `.for(` as the properties they are, not as the statements' heads.
- The docs: pages for trees and uploads, reordering on the page of list groups, 34 Arabic strings; the probes walk
  `--expand-all`, a move by each list's menu and two files on each upload, wait for a toggle busy with its children,
  and flag a handle outside an item of a `data-reorder` list and an upload without its parts.

## 0.5.0 — 2026-11-03

### Forms: tags that create values, inline edit, the one-time code, passwords
- Tags that create values: a list with `data-create` ends with “Create …” — the page's text `create` — while the
  search's words are no option's label and no chosen one. Taken, the label goes into a hidden field `data-create`
  names, beside the list's own, and the search empties for the next one; a page that makes the value on its server
  cancels `redz:create` and answers `{value, label}`, an option of the list from then on.
- Inline edit (`js/inline-edit.js`): a button with `command="--edit"` opens a form of class `inline-edit-form` in
  place of the value it names in `data-for` — or a `popover` form beside the button, for a value inside another form —
  its field focused and selected. Enter saves, Escape or `--cancel` puts the field back, a blur leaves it open; the
  submit fires `redz:save`, and a page that answers it with a promise has the Save button busy until it settles, a
  refusal's words in the form's `invalid-feedback`, said at once.
- The one-time code: `form-control-otp` — one field, its digits spaced, `autocomplete="one-time-code"`: it takes a
  paste and the code the system offers; no box per digit, no submit on the last digit.
- Passwords (`js/password.js`): `--reveal` shows a password field's text and hides it again, `aria-pressed` saying
  which, and hides it on the form's submit and on a return from the history. Elements with `data-strength` naming the
  field show its level as it is typed — shorter than its `minlength`, long enough, then four characters longer or of
  three kinds of characters, then both or twice the minimum — a `meter` at once, the words (`strength.short`,
  `.fair`, `.good`, `.strong`) once the typing pauses, said politely; a hint beside the server's own rules.
- The page's answers (`js/answer.js`): every moment only the page can carry out is a cancelable `redz:*` event whose
  `detail.respondWith(promise)` the widget waits for; cancelled without a promise, the moment is all the page's.
- The docs: a page for inline edit, new parts on the pages of form fields and of the combobox, 23 Arabic strings; the
  probes walk each Edit button, each `--reveal`, each strength field and a combobox's “Create …”, and flag a
  `data-strength` without its field and an inline edit form without its value. 21.3 KB and 11.1 KB gzipped.

## 0.4.0 — 2026-11-02

### The ERP's gaps
- `pagination` › `page-item` › `page-link` with `pagination-sm` and `pagination-lg`: the current page
  `aria-current="page"`, a page there is none of `aria-disabled="true"` on a link without `href`; `page-text` for words
  between the links — a list paged by "the next 50" shows previous, next and where you are.
- Dialogs on a window under 576 px fill the screen by themselves — the body scrolls, the footer stays at the bottom —
  and `dialog-sm` and confirmations stay a card; `dialog-fullscreen` fills it on any window.
- Scrollspy (`js/scrollspy.js`): in a nav or list group with `data-scrollspy`, the link to the section in view says so
  in `aria-current="location"`, in the page or in a box that scrolls.
- Tables `table-striped`, `table-striped-columns` — the stripe lies under the hover's light and a row's tone —
  `table-bordered` — the lines between columns and, outside a card, the table's own frame — `table-borderless`,
  `table-group-divider`; card images `card-img`, `card-img-top`, `card-img-bottom`, `card-img-overlay`; `nav-fill`,
  `nav-justified`.
- Utilities: `rounded-top`, `-end`, `-bottom`, `-start`; `z-n1` … `z-3`; `float-start`, `-end`, `-none` with width
  prefixes; `top`, `bottom`, `start`, `end` at 50 and 100; `translate-middle`, `-x`, `-y`, turned round right to left;
  `vw-100`, `min-vw-100`, `vh-100`, `min-vh-100` (heights by `dvh`); `visually-hidden-focusable` for a skip link;
  `stretched-link`. A vocabulary entry's `rtl` gives its rule right to left.
- The map from Bootstrap 5.3 covers them — 69 classes left without a form here, from 214 — and names the
  replacement of what Bootstrap 6 dropped too (`link-underline-*`, `bg-opacity-*`, `text-opacity-*`).
- The docs: a page for pagination, the new parts on the pages of navs, tables, cards, dialogs and utilities, and an
  icon for every page in the menu; the probes flag a scrollspy nav without exactly one current link.

### One stylesheet and one script for a project
- `dist/redz-ui.min.css` — the stylesheets `css/index.css` pulls in, as one file, squeezed: 21.2 KB gzipped, from 34 KB
  as 40 files. `dist/redz-ui.min.js` — the modules of `js/index.js` as one ES module, squeezed and given short local
  names: 9.4 KB gzipped, from 20.4 KB as 14 modules three imports deep. A page links them and `css/icons.css`; the
  sources stay to read, and the passport names the two files (`dist`) with their hashes.
- `tools/min.php` makes them, with no tool from outside: its JS scanner — strings, patterns and a template's text as
  written, white space only where two tokens would fuse — and its verdict come from the REDZ ERP's minifier, with one
  rule more (a `/` after `++` or `--` divides); the joiner, the short names — scoped as esbuild scopes them, never a
  free name or a property — and the CSS pass are new. A selector keeps its descendant space, also before `:`; a value
  the engine keeps as written — a custom property's, or one with `var()` — keeps its spaces. Each pass proves its
  result before it is written: the scanner's tokens and idempotence, the names' declarations one for one, the
  stylesheet's bytes beyond white space.
- The probes run the two files on every page, and in every engine the scripts of `tools/min/` answer the same as
  written and minified, and the stylesheet gives the same rules squeezed as written. The budgets are measured on the
  two files, gzipped; the ceilings stay 24 KB and 25 KB.

### Changed — breaking, in a minor release while the version is 0.x
- The combobox's server search event is `redz:search`, not `redz:filter`: a page listens for `redz:search` on the
  search, as before with `detail.query` and `detail.signal`.

### Fixed
- A table of several `tbody` keeps the line between them: only the table's last row goes without one, and its
  corners round with the card's.

## 0.3.0 — 2026-11-02

### The combobox and the command palette
- `combobox` — the WAI-ARIA combobox with a listbox, one core in three places (`js/combobox.js`):
  - a choice in a form: a `form-select combobox-toggle` button with `role="combobox"` shows the value
    (`combobox-value`, its `data-placeholder` while empty) and opens a `combobox-menu` panel with `combobox-search` ›
    `combobox-search-input` and a `combobox-list`; the value lives in hidden fields named by the list's `data-name`,
    one per value (`name[]` for many), so a form posts it as it is; Down, Up or a letter on the button open it; the
    button names its panel in `aria-controls` only while it is open, and one choice closes the panel a frame after it
    is written, so VoiceOver reads the new value;
  - many values: `aria-multiselectable="true"` keeps the panel open; the button lists the values in the page's
    language while they fit, else the first ones and `+N` (`combobox-more`); a list whose `data-chips` names a
    `combobox-chips` container shows each value there as a chip with its remove button instead;
  - a list in the page: the same search and list without a button or a panel.
- The search folds case and accents (not Thai marks; Arabic vowel marks off), finds what holds every word, the best
  first — the text itself, its start, a word's start (`Intl.Segmenter`), anywhere, then `data-keywords` — within each
  group, and paints the matches by the browser's highlights where it has them; once the typing pauses, the option
  Enter would take is said politely by its label — VoiceOver says nothing of it while keys are typed — and with
  nothing found, the count; no option is active when the panel opens, so a screen reader names the
  search, and the first Down goes to the chosen option; `aria-activedescendant` keeps the focus in the search; Escape
  empties the search, then closes
  the panel or the palette — the library closes it itself, as Safari's search field keeps the key.
- `redz:filter` on the search, with the query and an `AbortSignal`: a page that finds options itself cancels it and
  puts them into the list, which is `aria-busy` meanwhile. A choice fires `input` and `change` on the list; a form's
  reset puts the values back as the page sent them.
- `palette` — the command palette on a `<dialog>`: `palette-search`, `palette-list` of links and buttons with
  `role="option"` (kept out of the Tab order), `palette-footer`; Enter opens a link or presses a button, and the
  palette closes first.
- Shortcuts (`js/shortcuts.js`): a button or link whose `aria-keyshortcuts` names a combination with Control, Meta or
  Alt is pressed by it; where both `Meta+K` and `Control+K` are named, Apple's systems answer Meta and the others
  Control.
- Texts: a text fills its `{names}` from arguments, and a count picks its plural form by the page language's rules
  (`found.one`, `found.few`, … else `found.other`); new keys `remove`, `found.*`.
- `menu-item-content` and `menu-item-description` for a second line in an item; an option's chosen state by
  `aria-selected`, as an item's by `aria-checked`.
- The docs have a page for the combobox and one for the palette and shortcuts; the probes walk every combobox — open,
  Down, Enter, the value written, the panel closed, the focus back — and the palette's search, and flag a combobox
  whose button, active option or chosen values disagree with its list.
- A probe run stopped by a signal still ends its Safari session, so its automation windows close; the Safari they run
  in is the Mac owner's browser too and is never quit.
- The probes' engine `voiceover` hears what VoiceOver says in Safari through the combobox and the palette, each step
  against the words it must hold, and the sheet shows the phrases; CI runs it on macOS 15 and 26 after
  `php tools/probe.php voiceover-setup` lets AppleScript drive VoiceOver (ported from `@guidepup/setup`, MIT).

## 0.2.0 — 2026-11-02

### The missing basics
- `accordion` on the browser's `<details>` and `<summary>`, as Bootstrap 6 has it: `accordion-item` on the
  `<details>`, `accordion-header` on its `<summary>`, `accordion-body`, `accordion-icon` on the chevron,
  `accordion-flush`; the items of one group share a `name`. No script; a section opens with an animation only where
  the browser has `interpolate-size` and the reader allows motion.
- Collapse by the library's command `--toggle`: a button with `commandfor` opens and closes the region it names,
  closed as `hidden="until-found"` so find in page still opens it; the library keeps `aria-expanded` on its buttons
  (`js/toggle.js`).
- `input-group`, `input-group-sm` and `input-group-text`; the borders of the parts meet by themselves, and a menu or a
  hidden element inside the group is left out of the joining.
- `list-group`, `list-group-item`, `-action`, `-flush`, `-numbered`, `-horizontal` and its width-prefixed forms by the
  region (`md:list-group-horizontal`); the current item by `aria-current`, the unavailable by `disabled` or
  `aria-disabled`.
- `progress` on the browser's `<progress>` — tones `progress-{tone}`, `progress-sm`, `progress-lg`, `progress-striped`,
  `progress-animated`, the indeterminate state of a `<progress>` without a value — and `meter` on `<meter>`, coloured
  by `low`, `high` and `optimum`.
- `ratio-1x1`, `ratio-4x3`, `ratio-16x9`, `ratio-21x9` and `ratio-auto` on the element itself.
- The docs have a page for each, the map from Bootstrap 5.3 their rows, and the probes walk every accordion by Enter
  and Space, every `--toggle` button by Enter, and flag a `--toggle` button whose `aria-expanded` is not its region's
  state. The probes' Chrome sends Space as the key `" "`, and their focus helper stands before a `<details>`.
- The app shell keeps what the browser scrolls to — a focused control, a link's target — clear of its sticky header
  (`scroll-padding-block-start` on the page), as WCAG 2.4.11 asks; the probes' Firefox clicked the header where a
  header of an accordion had been scrolled under it.

## 0.1.0 — 2026-10-28

The first release.

### The release
- `redz-ui.json`, the passport, written by `php tools/build.php` and held current on every commit: the version, the
  floor, the stylesheets a bundle joins in their order, the modules of `js/index.js`, every class, custom property,
  command and text key of the library, and the sha256 of every file a release archives, in the SRI form.
- A tag `v*` becomes a release only when the probes are clean in every engine: `redz-ui-<version>.zip` — the passport
  and the files it names — and `checks.zip`, the sheet of the probes, are attached to a draft whose notes come from
  this changelog, and the draft is published. Releases are immutable: GitHub locks the tag and the files and signs an
  attestation of both, which `gh release verify-asset` checks.

### The reference, the docs and the skills
- `docs/`: a page per component and getting started, layout, utilities, tokens, icons and the move from Bootstrap 5.3
  — examples whose code is printed from the same markup, every state as a named grid, keyboard and accessibility, the
  tokens a component reads, its rows of the Bootstrap map; written by `php tools/docs.php` from `docs/src/` into one
  shell, with `docs/all.html` (every example and state on one page, the probes' fixture), its Arabic twin and those of
  the demo screens (`docs/ar.tsv`), a Markdown twin of every page, `llms.txt` and `llms-full.txt`. The docs' own
  script shows `:hover`, `:focus-visible` and `:focus` by copying those rules under `[data-docs-state]`.
  `reference/widgets.html` folded into the component pages.
- `skills/redz-ui` and `skills/redz-ui-from-bootstrap-5` (Agent Skills): building screens, and moving a project from
  Bootstrap 5.3 with `scripts/scan.sh`, a read-only scan that reports what Bootstrap left and every class REDZ.UI does
  not have. Both carry `assets/map.tsv` — every class of Bootstrap 5.3.8 with its REDZ.UI form, written by
  `php tools/map.php` from Bootstrap's own stylesheet — and `assets/classes.txt`.
- Busy regions: `REDZ.ui.busy()` on a card, its body, a dialog's or a drawer's body or any `region` turns it `inert`
  under an overlay shown after 400 ms and held at least 400 ms (`css/components/busy.css`), says so once politely (the
  page's text `busy`) and brings back a focus it dropped; on or around a live region it is refused in the console.
- Tabs with `data-activation="manual"`: the arrow keys move the focus, Enter or Space selects.
- A check, radio or switch marked `aria-disabled` ignores clicks and Space, as a button so marked.
- Arabic-script text (`lang` ar, fa, ur) takes `--redz-font-arabic`, a stack without Arial — macOS's Arial carries
  Arabic and won over the system face — and headings drop their letter-spacing there, which broke the joins in Safari
  and in Chrome 130–136.
- `pre`, `code`, `kbd` and `samp` run left to right in a right-to-left page; code lost its order there.
- `btn-subtle-*` darken their text on hover, pressed and expanded: the darker fill had taken it below 4.5:1.
- `js/menu-place.js` places a tooltip too, above its button first.
- `empty-state-drop` is the containing block of the hidden file input it holds: placed against the page, the input
  escaped a scrolling parent and widened the page.
- A menu closes on Tab with or without Option — Option-Tab is how Safari's users move through buttons, and it had
  only moved to the next item — and whenever the focus leaves it another way.
- Budgets in `php tools/build.php --check`: the stylesheet at most 24 KB and the scripts 25 KB, gzipped as one file
  each.
- Probes: the docs pages in the current three engines at 1440 and 390; the right-to-left cells on the Arabic twins;
  `aria-busy` on a live region, the docs' state copies against the real pointer and Tab, and the fonts of Arabic text
  in Chrome are checked; text that spills out of its box is named; Safari's Tab is Option-Tab, which reaches buttons
  and links; a cell sets its theme with transitions off; an exception may name a finding; every wait in the page ends
  in a few seconds; CI runs in five parallel parts joined by `php tools/probe.php merge`, with Chrome for Testing 156
  as its current Chrome. The Chrome driver sends a key without a native key code, as Playwright does: Chrome 152–154
  on macOS sent a key the page left alone back into the page, forever. A cell that runs past five minutes stops its
  engine as stalling, the cell and its slowest call named.

### The look, approved as a prototype
- Tokens `--redz-*`: neutral grays, a blue accent, six tones (`primary`, `secondary`, `success`, `danger`, `warning`,
  `info`) each with `-subtle` and `-contrast`, layered shadows for floating layers only, radii 6 / 8 / 12 / 16 px, UI
  text 14 / 20 px, controls 32 / 28 px, a compact density by `[data-density="compact"]`, themes by
  `[data-theme="light" | "dark"]` on any element or by the system; every text pair at 4.5:1 and every field border and
  focus ring at 3:1 in both themes.
- Demo screens in `reference/demo/`: a list, a resource page, a settings form; checked at 1440, 1280, 1024, 390 and
  320 px in light and dark, left-to-right and right-to-left, in Chrome, Safari and Firefox.

### Written by the reading rules (see the README)
- Components under Bootstrap 5's names, and Bootstrap 6's where it moved onto the platform: `btn` with `btn-{tone}`,
  `btn-outline-{tone}`, `btn-subtle-{tone}`, `btn-text`, `btn-link`, the sizes `btn-xs` / `btn-sm` / `btn-lg`,
  `btn-icon`, `btn-close`, `btn-group`, `btn-toolbar`; `form-field`, `form-label`, `form-text`, `invalid-feedback`,
  `form-control`, `form-select`, `form-floating`, `form-adorn`, `form-check`; `check`, `radio`, `switch`; `card` ›
  `card-header`, `card-body`, `card-footer`; `badge`, `badge-{tone}`, `badge-subtle-{tone}`; `alert`, `alert-{tone}`;
  `table` with `table-hover`, row states `table-danger` / `table-warning` / `table-secondary` and the parts
  `table-title`, `table-sub`, `table-note`, `table-check`, `table-actions`; `nav` with `nav-underline` / `nav-pills` ›
  `nav-link`; `menu` › `menu-header`, `menu-item`, `menu-divider`; `dialog`, `drawer`, `toast`, `tooltip`,
  `breadcrumb`, `placeholder`, `spinner-border`, `chip`, `avatar`, `dot`; our own where neither has one: `icon-tile`,
  `empty-state`, `selection-bar`, `save-bar` and the shell `app` › `app-header`, `app-sidebar`, `app-main`,
  `app-aside`.
- Utilities under Bootstrap 5's names with the number as the value (`p-16`, `gap-8`, `fs-14`, `rounded-8`), the grid
  (`grid`, `cols-1…12`, `cols-min-160…320`, `span-1…12`, `span-full`), `vstack` / `hstack`, and the prefixes `sm:` 576 ·
  `md:` 768 · `lg:` 1024 · `xl:` 1280 · `2xl:` 1536 for placement and spacing, `print:` for display. They are generated
  from `tools/vocabulary.json` by `php tools/build.php` into `css/utilities.css` and `css/scales.css` and committed, so
  nothing is built where the library is used; `php tools/build.php --check` fails when they are out of date.
- A width prefix measures the nearest region: `app-header`, `app-main`, `app-aside`, a `card`, a `dialog`, a `drawer`,
  or any block with the class `region` — a page without the shell marks its own.
- States are the attributes accessibility needs anyway (`aria-current`, `aria-pressed`, `aria-selected`,
  `aria-checked`, `aria-invalid`, `aria-busy`, `disabled`, `[open]`); dialogs and menus open by the browser's commands
  (`commandfor` + `command`), with `js/commands.js` standing in where the browser has none.
- Icons as CSS masks: `css/icons.css`, one generated rule per icon over its file in `icons/`, under Bootstrap Icons'
  own class names — `<i class="bi bi-NAME" aria-hidden="true"></i>`; no icon font, no JavaScript, no build.
- Forced colors (Windows high contrast): icons, check marks and dots take the system colors; the selected tab keeps its
  underline, the current section a bar, pressed buttons, chips and pills the system highlight; badges, alerts,
  tooltips and placeholders keep an outline; a select shows its native arrow.
- Print: the shell's header and sidebar, toasts and the save bar stay off paper; checkboxes, switches, select arrows,
  badges and icons print as on screen.

### The browser floor
- The floor is Bootstrap 6's: Chrome / Edge 130, Firefox 132, Safari 18 (desktop and mobile). What must work rests on
  features of the floor; invoker commands and anchor positioning stay in the markup and the CSS as enhancements.
- `tools/floor.php`: every property, value, function, unit, selector, at-rule, media feature, element and attribute of
  the library against MDN's browser-compat-data 8.1.7 at the floor. A block counts only for the browsers that can apply
  it (`@media`, `@supports`); a vendor form beside a property covers the browsers that need it; every exception is in
  `tools/floor/rules.json` with its reason, and so is every repair of an engine bug with the first versions that fixed
  it — an exception that allows nothing any more and a repair the floor has outgrown are findings. It runs on every
  commit and in the new Check workflow; `check FILE…` checks any stylesheet or page.
- `floor.json`: every name the gate knows with its verdict at the floor, for projects that check their own CSS.
- Fixed at the floor, as the gate found: `print-color-adjust` is unprefixed only from Chrome 136, so every use carries
  `-webkit-print-color-adjust` (icons, badges and checkboxes now print in Chrome 130–135); `user-select` needs its
  `-webkit-` form in Safari; `forced-color-adjust: preserve-parent-color` stays for Chrome only inside `@supports` —
  Firefox has no such value and already paints the icons in the forced text color; the tooltip pairs `block-start`
  with `span-inline-end` (the single keyword overflows the viewport in Chrome 129–143 and Firefox 147); `text-break`
  is `overflow-wrap: anywhere`.

### Scripts
- ES modules, one per behavior, behind `js/index.js` — the one module a page loads beside `css/index.css`; it sets
  `REDZ.ui` for calls from code. The library has no words of its own: they come from the caller or from the page's
  island `<script type="application/json" id="redz-ui-text">` (`js/text.js`), a missing one named in the console.
- `js/menu.js`: menus by keyboard (the WAI-ARIA menu button) — the focus on the checked or the first item when a menu
  opens, the arrow keys, Home, End and a letter, Tab and Escape close it, the down and up arrows open it from its button;
  choosing an item closes the menu.
- `js/tabs.js`: tab lists by keyboard (the WAI-ARIA tabs, automatic activation) — the arrow keys, mirrored right to
  left, Home and End select a tab and show its panel; only the selected tab takes Tab.
- `REDZ.ui.toast()` (`js/toast.js`): notices in the live regions of `.toast-container` — `role="status"`, and
  `role="alert"` for danger — present from the first paint and moved into an open modal dialog; success and info leave
  after 8 seconds unless the pointer or the focus rests on them, an error and a notice with an action stay.
  `.toast-container` now holds the two regions instead of being one.
- `REDZ.ui.confirm()` (`js/confirm.js`): a modal alert dialog that answers `true` or `false`, the focus on cancel.
- `REDZ.ui.busy()` (`js/busy.js`): `aria-busy` while a promise runs, a button `aria-disabled` too; a button marked
  `aria-disabled` swallows its clicks.
- `js/dialog.js`: where the browser has no `closedby`, a click on the backdrop of a modal dialog with
  `closedby="any"` closes it. A modal dialog keeps the page's scrollbar gutter while it locks the scroll.
- `js/commands.js`: where the browser has no invoker commands (Chrome before 135, Firefox before 144, Safari before
  26.2), a popover command becomes the browser's own `popovertarget` inside the click — so the browser still reports the
  menu as expanded, returns focus and anchors it — and a dialog command calls `showModal()`, `close()` or
  `requestClose()`; every command first dispatches the `command` event, which a listener may cancel.
- `js/menu-place.js` (the placement guard, apart from the keyboard so that it can go as one file): places an opened menu beside its button wherever the engine cannot anchor it (Firefox before 147,
  Safari before 26, and Chrome 130–132, which make no implicit anchor of a popover's invoker) or puts it out of view or
  away from its button — Chrome 135–136 in a middle-aligned table cell, Safari 26 at the bottom of a page taller than
  the viewport. Such a menu carries `data-placed="script"` while it is open.

### Checks in real engines
- `tools/probe.php`: every page in the installed Chrome, Firefox and Safari, in the floor's Chrome 130, Firefox 132 and
  Safari 18 in the iOS simulator, and in Chrome 136 and Safari 26 in the simulator; at 1440, 1024, 390 and 320 px,
  light left-to-right and dark right-to-left. Overflow, icons without a mask, width prefixes outside a region, cut
  labels and errors; every menu and dialog opened, judged inside the viewport and beside its button; axe-core 4.14.0 at
  WCAG 2.2 AA; forced colors and print where the engine has them. Chrome over its debugging pipe, Firefox over WebDriver
  BiDi, Safari over safaridriver; older engines fetched once into the cache and checked against their checksums.
- The keyboard walk: at 1440 px, in both directions, every menu, modal dialog and tab list is driven by real keys —
  and a dialog with `closedby="any"` by a click outside it — against the WAI-ARIA patterns, and two notices must land
  in their live regions. The page's own errors are collected inside it, so Safari's show too, and a page whose library
  script did not run is a finding. Proved on planted breaks: a menu's down arrow, a tab list's panels, the `closedby`
  stand-in.
- The sheet of shots and findings in `.dev/probes/`, with the menus `js/menu-place.js` had to place; the Probes workflow runs
  it on macOS 15 on every commit, and every release publishes it under `checks/` on the site.
- Fixed as the probes found: the profile buttons name the person they open (`MK, profile`), the type fields link has a
  name, a scrolling code block takes focus, and links are underlined in running text.

### Added
- Bootstrap Icons 1.13.2 in `icons/`, the files unchanged (MIT, see `NOTICE`).
- The site on GitHub Pages, assembled without a build: the latest release at the root, the main branch under `next/`,
  every release under its version; a landing page that leads to the demo screens. Until the first release the root
  shows the main branch.
- `docs/why.md` and its Russian version `docs/why.ru.md`: why the library exists instead of Bootstrap 5.3 or
  Bootstrap 6 — what we need, where each falls short for us, why not a layer over Bootstrap, what it costs us; every
  number with its source or its method.
