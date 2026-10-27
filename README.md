# REDZ.UI

The interface library of the REDZ products: plain CSS and small JavaScript on the browser platform — no framework, no
build step.

**Status:** in design. Nothing is released yet. The look is approved as a prototype: three demo screens in
`reference/demo/` — a list, a resource page and a settings form — in light and dark themes, left-to-right and
right-to-left.

**Site:** [redz-tech.github.io/REDZ.UI](https://redz-tech.github.io/REDZ.UI/) — documentation and the demo screens of
the latest release at the root, of the main branch under `next/`, and of every release under its version.

## What it is
- Tokens, a reset, cascade layers, components and a short set of utilities, written as plain CSS files.
- Behaviour of the widgets that the platform does not give by itself (menus and tabs by keyboard, toasts, a combobox),
  as small JavaScript that attaches by delegation.
- Light, dark and system themes; left-to-right and right-to-left from one stylesheet; WCAG 2.2 AA in both themes.
- A static reference of every component in every state, checked in Chrome, Safari and Firefox.

## Icons
[Bootstrap Icons](https://icons.getbootstrap.com/) 1.13.2, one SVG file per icon in `icons/`. The library will deliver
each icon as a CSS mask over its file (decided; it lands with the base), so an icon takes the color of the text around
it and needs no font, no JavaScript and no build:

```html
<i class="icon icon--pencil" aria-hidden="true"></i>
```

Such an icon follows the system colors in forced-colors mode and prints, from your own server or from a CDN that sends
CORS headers.

## Browsers
Released since January 2026: Chrome and Edge 135+, Firefox 147+, Safari 26.2+ (macOS and iOS). Nothing is written for
older browsers; newer features only as enhancements.

## License
MIT — see [LICENSE](LICENSE). Pieces taken from other MIT-licensed projects are listed with their notices in `NOTICE`.
