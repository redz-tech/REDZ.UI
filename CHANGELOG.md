# REDZ.UI — Changelog

All notable changes of the library. Newest first. Versions follow Semantic Versioning: a class, token, attribute
or JavaScript call removed or renamed is a major release, one added is a minor release, a fix is a patch.

## Unreleased

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
  (`commandfor` + `command`).
- Icons as CSS masks: `css/icons.css`, one generated rule per icon over its file in `icons/`, under Bootstrap Icons'
  own class names — `<i class="bi bi-NAME" aria-hidden="true"></i>`; no icon font, no JavaScript, no build.
- Forced colors (Windows high contrast): icons, check marks and dots take the system colors; the selected tab keeps its
  underline, the current section a bar, pressed buttons, chips and pills the system highlight; badges, alerts,
  tooltips and placeholders keep an outline; a select shows its native arrow.
- Print: the shell's header and sidebar, toasts and the save bar stay off paper; checkboxes, switches, select arrows,
  badges and icons print as on screen.

### Added
- Bootstrap Icons 1.13.2 in `icons/`, the files unchanged (MIT, see `NOTICE`).
- The site on GitHub Pages, assembled without a build: the latest release at the root, the main branch under `next/`,
  every release under its version; a landing page that leads to the demo screens. Until the first release the root
  shows the main branch.
- `docs/why.md` and its Russian version `docs/why.ru.md`: why the library exists instead of Bootstrap 5.3 or
  Bootstrap 6 — what we need, where each falls short for us, why not a layer over Bootstrap, what it costs us; every
  number with its source or its method.
