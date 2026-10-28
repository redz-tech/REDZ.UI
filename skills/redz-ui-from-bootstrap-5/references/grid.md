# Rows, columns, gutters, containers

In REDZ.UI the parent sets the grid and the number is the count. A width prefix measures the nearest region.

## Equal columns

```html
<!-- Bootstrap 5.3 -->
<div class="row g-3">
  <div class="col-md-6">…</div>
  <div class="col-md-6">…</div>
</div>

<!-- REDZ.UI -->
<div class="grid md:cols-2 gap-16">
  <div>…</div>
  <div>…</div>
</div>
```

`g-3` (1 rem) is `gap-16`; `gx-*` is `column-gap-*`, `gy-*` `row-gap-*`. There are no gutters to cancel: drop `g-0`.

## Spans of 12

```html
<!-- Bootstrap 5.3 -->
<div class="row">
  <div class="col-lg-8">…</div>
  <div class="col-lg-4">…</div>
</div>

<!-- REDZ.UI -->
<div class="grid lg:cols-12 gap-16">
  <div class="lg:span-8">…</div>
  <div class="lg:span-4">…</div>
</div>
```

Below the prefix, the grid has one column — as Bootstrap's columns stack.

## row-cols

`row-cols-2 row-cols-lg-4` on the row become `cols-2 lg:cols-4` on the grid; the children lose `col`.
"As many as fit, none narrower than N px": `cols-min-240` (160, 200, 240, 280, 320).

## Offsets and auto columns

There are no offsets: put an empty element or a `span-N` before, or rethink the layout. A column as wide as its
content (`col-auto`) is an `hstack`, or a track in the module's CSS.

## Containers

`container` and `container-fluid` go. Inside the admin shell the main column (`app-main`) is the region; a page without
the shell marks its own wrapper `region` and limits it with `max-w-*` and `mx-auto`.

## Prefixes measure regions

`md:` means "the nearest region is at least 768 px wide": a card, a dialog, a drawer, the shell's columns, any
`region`. A card in the 8-of-12 column of a 1440 px window is about 740 px wide — use `sm:` inside it. A region inside a
flex row needs a width (`flex-grow-1`, a grid track): inline-size containment does not size it by its content.
