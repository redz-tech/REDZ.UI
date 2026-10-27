# REDZ.UI — Changelog

All notable changes of the library. Newest first. Versions follow Semantic Versioning: a class, token, attribute
or JavaScript call removed or renamed is a major release, one added is a minor release, a fix is a patch.

## Unreleased

### The look, approved as a prototype
- Tokens: neutral greys, a blue accent, layered shadows for floating layers only, radii 6 / 8 / 12 / 16 px, UI text
  14 / 20 px, controls 32 / 28 px, a compact density by `[data-density="compact"]`; every text pair at 4.5:1 and every
  field border and focus ring at 3:1 in both themes.
- Layout primitives: page, stack, cluster, split, grid.
- Components: button, field with a floating label, check, switch, panel, pill, chip, rows, menu, dialog, drawer, tabs,
  notice, banner, hint, pager, trail, empty, avatar, spinner, skeleton, toolbar, savebar.
- Demo screens in `reference/demo/`: a list, a resource page, a settings form; checked at 1440, 390 and 320 px in
  Chrome, Safari and Firefox. Icons in them are still an inline sprite; the mask delivery below lands with the base.

### Decided
- Icons are CSS masks over the files of Bootstrap Icons: `<i class="icon icon--NAME" aria-hidden="true"></i>`, no icon
  font, no build in any project that uses the library.

### Added
- Bootstrap Icons 1.13.2 in `icons/`, the files unchanged (MIT, see `NOTICE`).
- The site on GitHub Pages, assembled without a build: the latest release at the root, the main branch under `next/`,
  every release under its version; a landing page that leads to the demo screens. Until the first release the root
  shows the main branch.
- `docs/why.md` and its Russian version `docs/why.ru.md`: why the library exists instead of Bootstrap 5.3 or
  Bootstrap 6 — what we need, where each falls short for us, why not a layer over Bootstrap, what it costs us; every
  number with its source or its method.
