# REDZ.UI — Changelog

All notable changes of the library. Newest first. Versions follow Semantic Versioning: a class, token, attribute
or JavaScript call removed or renamed is a major release, one added is a minor release, a fix is a patch.

## Unreleased

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
  and links; a cell sets its theme with transitions off; an exception may name a finding; CI runs in five parallel
  parts joined by `php tools/probe.php merge`.

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
