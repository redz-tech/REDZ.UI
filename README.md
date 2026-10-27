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
- Behavior of the widgets that the platform does not give by itself (menus and tabs by keyboard, toasts, a combobox),
  as small JavaScript that attaches by delegation.
- Light, dark and system themes; left-to-right and right-to-left from one stylesheet; WCAG 2.2 AA in both themes.
- A static reference of every component in every state, checked in Chrome, Safari and Firefox.

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

## Browsers
Released since January 2026: Chrome and Edge 135+, Firefox 147+, Safari 26.2+ (macOS and iOS). Nothing is written for
older browsers; newer features only as enhancements inside `@supports`.

**The floor gate.** `php tools/floor.php check` reads every stylesheet and page of the library and checks each
property, value, function, unit, selector, at-rule, media feature, element and attribute against MDN's
[browser-compat-data](https://github.com/mdn/browser-compat-data) at those versions — on every commit and in the Check
workflow here. A block is checked only for the browsers that can apply it: `@media (forced-colors: active)` and
`@supports (…)` narrow them. A vendor form beside a property covers the browsers that need it, as
`-webkit-print-color-adjust` does for Chrome 135. Every exception is in `tools/floor/rules.json` with its reason.
`php tools/floor.php check your.css page.html` checks your own files the same way.

`floor.json` lists every name the gate knows — `property:print-color-adjust`, `value:display:grid`, `unit:dvh`,
`selector:has`, `media:forced-colors`, `attribute:button:commandfor` — with `"ok"` or, per browser, what the floor
lacks. Its data is a pinned version of browser-compat-data in `tools/floor/bcd.tsv`, fetched and checked against its
sha512 by `php tools/floor.php refresh`.

## License
MIT — see [LICENSE](LICENSE). Pieces taken from other MIT-licensed projects are listed with their notices in `NOTICE`.
