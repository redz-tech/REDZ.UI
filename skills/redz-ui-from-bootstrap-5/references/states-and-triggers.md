# States, triggers, the JS API, events

## State classes become attributes

| Bootstrap 5.3 | REDZ.UI |
| --- | --- |
| `.active` on a nav link | `aria-current="page"` |
| `.active` on a tab | `aria-selected="true"` (the library sets it) |
| `.active` on a toggle button, a filter | `aria-pressed="true"` |
| `.active` on a list item, a dropdown item | `aria-current="true"`, or `aria-checked="true"` on a `menuitemradio` |
| `.disabled` on a link or button | `disabled` on a button; `aria-disabled="true"` keeps it focusable — the library swallows its clicks |
| `.show` | the browser's `[open]` (dialog) and `:popover-open` (menu); nothing to set |
| `.collapsed` | `aria-expanded="false"`, set by the browser on the button |
| `.is-invalid` | `aria-invalid="true"` on the control, its error in `invalid-feedback` joined by `aria-describedby` |
| `.was-validated` | nothing: the browser's `:user-invalid` shows after the person edits |
| `.is-valid` | nothing: fields have no success state |

Script that reads or writes these classes changes with them: `el.classList.contains('active')` →
`el.getAttribute('aria-current') === 'page'`; `.dropdown-menu.show` → `.menu:popover-open`.

## data-bs-* triggers become commands

```html
<!-- Bootstrap 5.3 -->
<button data-bs-toggle="modal" data-bs-target="#edit">Edit</button>
<div class="modal fade" id="edit" tabindex="-1">…<button data-bs-dismiss="modal">Close</button>…</div>

<!-- REDZ.UI -->
<button class="btn" type="button" commandfor="edit" command="show-modal">Edit</button>
<dialog id="edit" class="dialog" aria-labelledby="edit-title">…<button class="btn" type="button" commandfor="edit" command="close">Close</button>…</dialog>
```

| Bootstrap 5.3 | REDZ.UI |
| --- | --- |
| `data-bs-toggle="modal"` / `"offcanvas"` | `commandfor="ID" command="show-modal"` |
| `data-bs-dismiss="modal"` / `"offcanvas"` | `commandfor="ID" command="close"` |
| `data-bs-toggle="dropdown"` | `commandfor="ID" command="toggle-popover" aria-haspopup="menu"`; the menu gets `popover` and `role="menu"` |
| `data-bs-toggle="tab"` / `"pill"` | `role="tab" aria-controls="ID"` inside `role="tablist"`; the library selects |
| `data-bs-backdrop="static"` | `closedby="closerequest"` on the dialog (Esc closes, a click outside does not) |
| `data-bs-keyboard="false"` | `closedby="none"` |
| a click outside closes | `closedby="any"` |
| `data-bs-theme="dark"` | `data-theme="dark"` on `<html>` |
| `data-bs-placement`, `data-bs-offset`, `data-bs-auto-close` | nothing: anchor positioning places and flips the menu |

`commandfor` takes the id alone, without `#`. A trigger that is a link becomes a `<button type="button">`.

## The JS API

| Bootstrap 5.3 | REDZ.UI |
| --- | --- |
| `bootstrap.Modal.getOrCreateInstance(el).show()` / `.hide()` | `el.showModal()` / `el.close()` |
| `bootstrap.Offcanvas…show()` | `el.showModal()` on the drawer |
| `bootstrap.Dropdown…toggle()` | `menu.togglePopover()` |
| `new bootstrap.Toast(el).show()` | `REDZ.ui.toast({title, text, tone})` |
| a confirm modal built by hand | `await REDZ.ui.confirm({title, text, ok, tone})` → `true` or `false` |
| a spinner set by hand on a button | `await REDZ.ui.busy(button, promise)` |
| `new bootstrap.Tooltip(el)` loops at start | delete them |

## Events

| Bootstrap 5.3 | REDZ.UI |
| --- | --- |
| `hidden.bs.modal` | the dialog's `close` event; `dialog.returnValue` holds the closing button's `value` |
| `hide.bs.modal` | the dialog's `cancel` event (Esc); your buttons close it |
| `shown.bs.modal` | code right after `showModal()` |
| `shown.bs.dropdown`, `hidden.bs.dropdown` | the menu's `toggle` event: `event.newState` is `"open"` or `"closed"` |
| `shown.bs.tab` | the tab's click, or watch `aria-selected` |
