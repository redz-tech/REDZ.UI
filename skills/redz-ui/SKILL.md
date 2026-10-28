---
name: redz-ui
description: Build or change admin screens with REDZ.UI — its class names, states, commands and page skeleton, with one reference per component. Use when writing HTML, PHP templates or JavaScript for a project that links redz-ui/css/index.css, or when asked for a list, form, card, dialog, menu, tabs or notice in REDZ.UI.
license: MIT
metadata:
  version: "0.1.0"
---

# Building screens with REDZ.UI

REDZ.UI is plain CSS and small ES modules on the browser platform: no framework, no build. It reads like Bootstrap 5
where the meaning is the same, and like the platform where Bootstrap 6 moved onto it.

## The rules

1. A component, its variant, its size and its parts are one class each, joined by a dash: `btn btn-primary btn-sm`,
   `card-header`. A utility is `property-value`: `d-flex`, `text-muted`.
2. A condition is a prefix with a colon: `md:cols-2`, `print:d-none`. A width prefix measures the nearest **region** —
   the shell's columns, a card, a dialog, a drawer, any `region` — never the window. Breakpoints: `sm` 576, `md` 768,
   `lg` 1024, `xl` 1280, `2xl` 1536.
3. The number is the value: px for lengths (`p-16`, `gap-8`, `fs-14`, `rounded-8`), percent for widths (`w-50`), a
   count in a grid (`cols-3`, `span-8`). Only a scale's values exist — space 0 2 4 8 12 16 20 24 32 40 48 64.
4. The parent sets the grid: `grid md:cols-2 gap-16`; a child's exception `span-full`, `lg:span-8`; "as many as fit"
   `cols-min-240`; a column or a row of items `vstack` / `hstack` with `gap-*`. Components have no outer margin.
5. A state is the attribute accessibility needs: `aria-current`, `aria-selected`, `aria-pressed`, `aria-expanded`,
   `[open]`, `disabled` / `aria-disabled`, `aria-invalid`, `aria-busy` — never a state class.
6. Behavior is the browser's commands: `commandfor` + `command="show-modal" | "close" | "toggle-popover"`. Menus, tabs
   and dialogs need no start-up call; the library listens on the document.
7. Tokens are `--redz-` with the classes' words: `--redz-text-muted`, `--redz-space-16`. No inline styles: values come
   from classes, `<progress>` / `<meter>`, or the module's CSS.
8. A module's own classes carry its prefix: `orders-summary`, never a bare name that could collide.

## The page

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="redz-ui/css/index.css">
  <link rel="stylesheet" href="redz-ui/css/icons.css">
  <script type="module" src="redz-ui/js/index.js"></script>
  <script type="application/json" id="redz-ui-text">{"close": "Close", "confirm.ok": "OK", "confirm.cancel": "Cancel", "busy": "Loading…"}</script>
</head>
```

`data-theme="light"` or `"dark"` on `<html>` fixes a theme (none follows the system); `dir="rtl"` turns the page right
to left — the same stylesheet serves both. Every word the library shows comes from that island.

## From script

- `REDZ.ui.toast({title, text, tone, action, persistent})` — a notice; answers a function that closes it.
- `await REDZ.ui.confirm({title, text, ok, cancel, tone})` — a question; `true` or `false`.
- `await REDZ.ui.busy(element, promise)` — a button or a region busy until the promise settles.

## Before you write a class

Check it exists: `grep -x 'CLASS' assets/classes.txt`. A class that is not there does not exist in REDZ.UI — Bootstrap
6 habits (`md:col-6`, `btn-solid`, `fg-*`) and invented names included.

## References — one per page of the docs

Start: `references/index.md` (getting started), `layout.md`, `utilities.md`, `tokens.md`, `icons.md`.
Actions: `btn.md`, `chip.md`, `menu.md`. Forms: `form.md`, `check.md`. Content: `card.md`, `table.md`, `badge.md`,
`dot.md`, `avatar.md`, `icon-tile.md`, `empty-state.md`, `placeholder.md`. Layers: `dialog.md`, `drawer.md`,
`tooltip.md`. Feedback: `alert.md`, `toast.md`, `spinner.md`, `busy.md`, `save-bar.md`, `selection-bar.md`.
Navigation: `nav.md`, `breadcrumb.md`, `app.md`. The same pages live at
`https://redz-tech.github.io/REDZ.UI/docs/`.
