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
- `input-group`, `input-group-sm` and `input-group-text` keep their names; `input-group-lg` becomes the default size;
  `has-validation` goes — the error sits under the group in its `form-field`. A menu inside the group stays where it
  is: the joining skips popovers. An icon inside the field itself is `form-adorn`.

## Accordion and collapse

- The accordion is `<details>`: `accordion-item` on the `<details>`, `accordion-header` on its `<summary>` with the
  words straight in it, `accordion-body` after it; `accordion-button` and `accordion-collapse` go, and so does the
  heading around the button. The items of one group share `name="…"` — that replaces `data-bs-parent` — and the open
  one has `open` instead of `show`. The chevron is `<i class="bi bi-chevron-down accordion-icon" aria-hidden="true">`
  at the end of the summary.
- A standalone collapse keeps its button and its region where they are: the button gets `commandfor="ID"
  command="--toggle" aria-expanded="false"` instead of `data-bs-toggle` and `data-bs-target`; the region drops
  `collapse` and gets `hidden="until-found"` while closed (no `hidden` when it starts open, its button
  `aria-expanded="true"`).

## List groups, progress, ratio

- `list-group`, `list-group-item`, `-action`, `-flush`, `-numbered` and `-horizontal` keep their names;
  `list-group-horizontal-md` → `md:list-group-horizontal`; `active` → `aria-current`, `disabled` → `disabled` on a
  button or a link without `href` and with `aria-disabled="true"`; the item tones go — a badge or a dot says it.
- `<div class="progress"><div class="progress-bar" style="width: 40%">` → `<progress class="progress" value="40"
  max="100">` with a name; `progress-bar-striped` and `-animated` → `progress-striped` and `progress-animated` on the
  `<progress>`; `bg-success` on the bar → `progress-success`; text inside the bar moves beside it. A quota or a score
  is a `<meter class="meter">` with `low`, `high` and `optimum`.
- `ratio ratio-16x9` on a wrapper → `ratio-16x9` on the element itself; an image inside a frame gets `w-100 h-100
  object-fit-cover`.

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

Pagination, popover, carousel, spinner-grow: keep their markup under the module's own classes with its prefix, and
note it for the order that adds them.
