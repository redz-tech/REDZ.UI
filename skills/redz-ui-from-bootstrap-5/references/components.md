# Components

## Modal → dialog

```html
<!-- Bootstrap 5.3 -->
<div class="modal fade" id="note" tabindex="-1" aria-labelledby="note-title" aria-hidden="true">
  <div class="modal-dialog modal-sm">
    <div class="modal-content">
      <div class="modal-header"><h5 class="modal-title" id="note-title">A note</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body">…</div>
      <div class="modal-footer"><button class="btn btn-primary" data-bs-dismiss="modal">Done</button></div>
    </div>
  </div>
</div>

<!-- REDZ.UI -->
<dialog id="note" class="dialog dialog-sm" closedby="any" aria-labelledby="note-title">
  <div class="dialog-header"><h2 class="dialog-title" id="note-title">A note</h2><button class="btn-close" type="button" commandfor="note" command="close" aria-label="Close"></button></div>
  <div class="dialog-body">…</div>
  <div class="dialog-footer"><button class="btn btn-primary" type="button" commandfor="note" command="close">Done</button></div>
</dialog>
```

The page behind is inert and keeps its scroll; the focus comes back to the opening button by itself.

## Dropdown → menu

```html
<!-- Bootstrap 5.3 -->
<div class="dropdown">
  <button class="btn dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">Actions</button>
  <ul class="dropdown-menu dropdown-menu-end">
    <li><a class="dropdown-item" href="/edit">Edit</a></li>
    <li><hr class="dropdown-divider"></li>
    <li><button class="dropdown-item text-danger">Delete</button></li>
  </ul>
</div>

<!-- REDZ.UI -->
<button class="btn" type="button" commandfor="row-menu" command="toggle-popover" aria-haspopup="menu">Actions<i class="bi bi-chevron-down" aria-hidden="true"></i></button>
<div id="row-menu" class="menu" popover role="menu" aria-label="Actions">
  <a class="menu-item" href="/edit" role="menuitem">Edit</a>
  <hr class="menu-divider">
  <button class="menu-item menu-item-danger" type="button" role="menuitem">Delete</button>
</div>
```

No wrapper and no list: the items are the menu's children. The menu meets its button's end edge; `menu-start` its
start edge. The browser keeps `aria-expanded`; the library adds the arrow keys.

## Offcanvas → drawer

`offcanvas offcanvas-end` → `<dialog class="drawer">`, `offcanvas-start` → `drawer drawer-start`; header, title and
body are `drawer-header`, `drawer-title`, `drawer-body`. It opens like a dialog: `command="show-modal"`.

## Forms

- `form-check-input` → `check`, `radio` or `switch` on the input, by its type; the switch also gets `role="switch"`.
  The `form-check` is the `<label>` around the input; `form-check-label` goes.
- `form-floating`, `form-control`, `form-select`, `form-label`, `form-text`, `invalid-feedback` keep their names.
- `is-invalid` → `aria-invalid="true"`; drop `was-validated`, `is-valid` and `valid-feedback`.
- `input-group` is missing: an icon inside a field is `form-adorn`; a field joined to a button keeps the module's own
  classes until REDZ.UI has the input group.

## Tables

`table`, `table-hover` and the tones `table-danger`, `table-warning`, `table-secondary` keep their names. The row's
title is a `table-title` link, the line under it `table-sub`, a problem `table-note`, the checks column `table-check`,
the actions `table-actions`. Drop `table-responsive`: the card's body holds the table and columns hide below `md:`.

## Navs and tabs

`nav-tabs` → `nav-underline`; `nav-item` goes. Links between pages are `<a class="nav-link">` with `aria-current`.
Tabs are `<button class="nav-link" role="tab" aria-selected aria-controls>` in a `role="tablist"`, the panels
`role="tabpanel"` with `hidden`; `tab-content` and `tab-pane` go.

## Toasts, badges, alerts

- Toasts are made by `REDZ.ui.toast({title, text, tone})`; keep one `<div class="toast-container"><div
  role="status"></div><div role="alert"></div></div>` on the page and delete hand-built toast markup.
- `text-bg-primary` on a badge → `badge-primary`; `badge-subtle-*` for a quiet one.
- `alert-*` tones keep their names; `alert-heading` is a `<strong>` in the alert's text; a dismissible alert is a
  `btn-close` your script removes.

## Missing for now

Accordion and collapse, list group, progress, input group, ratio, pagination, popover, carousel, spinner-grow: keep
their markup under the module's own classes with its prefix, and note it for the order that adds them.
