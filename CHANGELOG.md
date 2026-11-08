# REDZ.UI - Changelog

All notable changes of the library. Newest first. Versions follow Semantic Versioning: a class, token, attribute
or JavaScript call removed or renamed is a major release, one added is a minor release, a fix is a patch. While the
version is 0.x, a removal or a rename is a minor release, as Semantic Versioning allows, and its section says so.

## Unreleased

### Added
- A banner for a state of the whole system, `app-banner` with the tones `app-banner-info` (the default),
  `app-banner-success`, `app-banner-warning` and `app-banner-danger`: the first row of `app`, above its header, across
  the window and sticky with the header under it; first in the body of a page without the shell; off paper.
  `REDZ.ui.banner({tone, text})` shows the one banner or replaces it, and answers a function that removes it;
  `REDZ.ui.banner(null)` removes it. The same tone and words again change nothing and say nothing, so a page may call it
  on every answer of its server. The words are said once, politely, at once for `danger`. Its height goes to
  `--redz-app-banner-height` on the root, which the header, the side navigation, `--redz-sticky-top` and the scroll
  padding add.
- `redz-ui-tools-<version>.zip` in every release: the tools a project runs on its own server and never serves, each
  the very file the release was built and checked with - `floor.php`, the browser floor checker, with its list
  `floor.json`, and `min.php`, the minifier -, PHP 8.4 or newer with no extension, no network, and their passport
  `redz-ui-tools.json`: the PHP they need, the file of each tool and the sha256 of every file. `tools/dist/` of the tag,
  written by `php tools/build.php`; the Check workflow runs both on PHP 8.4 with no extension loaded.
- The floor checker for a project: `php floor.php check [--allow=FILE] [--json] FILE…`, a finding a line on standard
  output and the summary on standard error, exit 0 clean, 1 findings, 2 for anything else; `--json` prints the findings
  as objects. An exception of a project's own carries its reason: `/* floor-allow NAME[, NAME…] -- reason */` covers its
  lines and the next one, `--allow=FILE` a set of files; one that allows nothing is a finding. It applies the release's
  exceptions of scope `any` only.
- The minifier for a project: `MIN__JsBlocks([$label => $js, …])` joins classic scripts, each in a block of its own, for
  one ES module, and refuses what reads otherwise there - a static `import` or `export`, a `var` or a function declared
  outside any function, `this` outside any function but an arrow, `with`, an HTML-like comment, a legacy octal number or
  escape; `MIN__SelfTest()` gives the samples it proves itself on that misfire. A class's private names `#name` are read.
- Outside judges of the minifier on every commit, `php tools/judge.php`: Lightning CSS reprints every stylesheet it
  squeezes, the library's and the css-tokenizer-tests corpus, as written and as squeezed, which must read the same;
  esbuild parses every script it writes for the browser floor; a watch on the size of the two main files against esbuild
  `--minify`. Both are native binaries from npm, pinned by version and sha512.

### Changed
- `floor.json` carries, for each name that falls short at the floor, its BCD key, and for each vendor form the browsers
  that take it; its exceptions carry their scope and, for a key, the names under it. The verdict `prefix -webkit-` gives
  way to the browsers of `"-webkit-"`.
- Every exception of `tools/floor/rules.json` has a scope: `any` for an engine's own fact, `library` where the library's
  own code stands in - `js/menu-place.js` places only the library's menus and tooltips.
- The library's floor gate, `tools/floor.php`, judges through the checker each release ships and by `floor.json`, and
  runs that checker on its command line on every commit.
- A refusal of the minifier names the byte and the line of the text it was given, with the code around it, and has the
  byte as its code; a fault of its own proof is a `LogicException`.
- The floor gate and the minifier read bytes without the ctype and mbstring extensions: on macOS ctype read bytes by the
  locale, so a byte such as 0xA0 counted as a space there and not on Linux.

### Fixed
- The minifier no longer hangs on a stylesheet that ends in a `\`; it refuses it (since 0.4.0).
- The minifier refuses a script with a string, a pattern, a template or a comment that runs to its end, and a string or
  a pattern that runs past its line, instead of failing in its own proof.
- A `table`'s head sticks at the top of a page without the shell, or under a page's own bar by `--redz-sticky-top`. It held the shell header's
  height everywhere, so a table at the top of such a page had its head over its first row.
- A `menu`, `popover` or `dialog` inside a `th` takes the size, weight and color of the page's text, not the head's.
- A group's end slot `table-group-end` in a table wider than its `table-scroll`, as on a phone, stays at the scroller's
  visible end, over a label that runs under it. It stood at the far end of the band, out of sight until scrolled there.
- A `table-group` band in a `table-scroll-first` or `table-scroll-last` keeps its own background and no line: it took
  the held column's background, line and stickiness.
- A search field over a table with groups keeps a group's `table-group` band and `table-subtotal` while a row of the
  group matches, and hides them with the group's last row. It matched each band and subtotal against its own words, so
  a search hid the band of every row it found.

## 0.18.2 - 2026-11-06

Pack `it` found a row's menu turning see-through, and the cause reaches further. Browsers now stop `:hover`, `:active` and
`:focus-within` at the top layer, so an open menu or dialog no longer tells the row around it that the pointer or the focus is inside.
A row now asks whether it holds an open layer. It no longer asks only where the pointer and the focus are.

### Fixed
- A `menu` or `dialog` inside `table-actions` is not dimmed with the row's actions.
- A row keeps its actions lit while its menu is open, wherever the pointer goes, for a menu in the row and for one shared from outside
  the table. `tree-actions` too: they used to vanish while a button among them had its menu open.
- A `dialog` or `[popover]` takes no `text-align` or `white-space` from where it stands. A long item of a menu in a table cell wraps, where
  it ran out of the menu.

### Changed
- A row holds its light while its menu is open.
- The release files carry a banner of the name and the address, and the editor's its license too. `css/icons.min.css` stays as it is.

### Docs
- The table page shows a menu in a row.
- On these pages a row's actions stayed dim under a real pointer and a tree's stayed hidden: the page's own state mirror did that, the
  library did not, and it is fixed.

## 0.18.1 - 2026-11-06

Two fixes the ERP found moving onto 0.18.0.

### Fixed
- A `step-list-body` that is also a `vstack` takes a line of its own under the step's name. 0.18.0 put it beside the name.
- A caption of a board's scale that would touch the one before it hides, by measure, in any language and at any width. It replaces
  the rule that hid every second caption in a narrow region, which let a long first word run into the next one.

## 0.18.0 - 2026-11-06

What the ERP's walk and the move of its screens left: a step that waits for a press, step details that fit a phone without a
width in sight, and every table lighting its row.

### Changed
- Every `table` lights the row under the pointer, on a device with hover, so `table-hover` does nothing now and can go.
  `--redz-row-hover` sets the light, on the page or on one table, and `table-static` keeps a table's rows still. A tinted row keeps
  its tone and a selected one its color. The editor's Hover property writes `table-static` for no.
- A `step-list-detail` stays at the end of the line while the name and it fit, and falls under the name, aligned with it, when
  they do not, at any width of the page. An empty one takes no room. The step's icon stands in its padding, out of the flow.
- `.diff` scrolls in its own box past 25rem and prints in full; a `max-h-*` utility sets another height. One that may scroll
  takes `tabindex="0"` and a name.
- A link `nav-overflow` folds is marked `data-overflow` alone, so `hidden` is always the page's. A page that read `.hidden` to
  find a folded link reads `[data-overflow]`.

### Added
- `data-state="ready"` on `step-list` and `stage-list`: next, it waits for a press. It wears the look of `current`, and its icon
  stays still.
- `data-highlighted="hold"`: a mark the page sets itself stays until the page takes it away, whatever the pointer does.
- `--redz-lanes-track`, the color of a board's track.

### Fixed
- `d-none` beats every display class on its element, `vstack`, `hstack` and `grid` among them; a width prefix still beats it.
- `nav-overflow` looks again when the page sets or clears `hidden` on a link, a folded one too.
- A `stat` keeps the tone of an `icon-tile-*` on its tile.
- A `vstack` as an `alert`'s words stays beside the icon however long its text.
- `REDZ.ui.confirm({title})` with nothing else has no empty body.
- A lit lane of a board tints its track too, the grid on top.
- A row with a `stretched-link` lights in the row's color, not a gray of its own.

### Documentation
- Icons from another host: a browser fetches a mask in CORS mode, so that host must send `Access-Control-Allow-Origin` on `.svg`.

## 0.17.0 - 2026-11-05

The editor gets the rest of what was decided on the mockup: live facts, an AI that only suggests, a review word by word, the
tone pad, translations side by side, the page's reading, and who wrote what. No model is ever called from a page.

### Changed - the license of the editor
- From this release the editor, `editor/` and its built files, is under PolyForm Strict 1.0.0, in `dist/LICENSE-editor`: noncommercial
  use only, no changes, no redistribution. It comes with REDZ products under their terms; anything else needs a separate license, see
  `LICENSING.md`. The library stays under MIT, and versions up to 0.16.0 stay under MIT as released.

### Added - the editor
- **Live facts:** `<data value="KEY">` stands in every place a price, a date or a phone number is used, by `options.facts`.
  `@` in the text puts one in, Facts in the foot counts its places and changes it in all of them through `options.onFact`.
  A value typed by hand where a fact holds it is found by the checks.
- **The AI's seam:** `options.ai(task, {signal, progress})` is the host's and async. Tasks `rewrite`, `tones`, `translate`,
  `write`, `read` and `alt` carry plain words, a fact as a token `⟦KEY⟧`. A refusal answers `{refusal}` and is said as one. A
  closed block is never sent, and an answer whose block changed, whose fields do not fit or that lost a fact is left out.
- **The review:** a suggestion is drawn word by word by `Intl.Segmenter`, each change taken or left alone, and the value stays
  what it was until the last one is decided. Marks on the words around a change stay. One task is one step of undo, and
  `options.onBatch` hears it as one batch.
- **The lock on what an AI writes:** it answers flat blocks of the passport's schema `editor.write`, and the editor writes them
  as REDZ.UI markup by the catalog, so a kind, a tone or a size the library does not have cannot come out.
- **The tone pad:** nine versions from one request, shorter to longer and stricter to warmer, opened at once and tried on the block.
- **Side by side:** the source language in a frame of its own, row by row. `data-from` keeps the hash of the source's words a block
  was made from, so only the block that changed goes stale; a price that changes stales nothing. A stale row says what changed, by
  `languages[].versions`. Translate all sends every row left as one task. `options.source` names the language.
- **Ask the page:** what a visitor's assistant would answer from this page alone.
- **Who wrote it:** `data-by` and `data-checked` on a block, shown by the strip, kept with `ids`. Text nobody checked is listed in the
  checks. The right `review` signs it; a person without it can take a suggestion, and it stays unchecked.

### Changed
- `languages`: a language the session left keeps what was written in it when the session comes back to it, also without `getLanguage`.
- The foot holds the AI's menu, Facts and Check. A page that looked for the Check button as the foot's first button looks for
  `[data-editor-foot="check"]`.

### Changed - the library
- The budgets: the stylesheet at most 36 KB, the script 34 KB, gzipped.
- A plain `btn` in an `input-group` wears the field's line, an accent face and weight 600, so the group reads as one control; a plain
  `btn-icon` there reads as `input-group-text`. Solid, outline, subtle and text buttons stay as they are.
- A click on a control with `aria-disabled="true"` and a title shows the title for three seconds and says it, as a tap always did.
- The mark of a `table-danger`, `table-warning`, `table-active` or current row stands on the first cell a phone shows, when a `d-none`
  cell comes first.

### Fixed
- The caret in a block whose text changed under it threw in Safari, which stopped undo.
- A dialog and the palette keep their column while they close: for 0.2 s the header, the body and the footer stood in a row.
- `stat-label` and `stat-sub` break one long word instead of running past a narrow tile.
- A deep link to a tab's panel leaves the tabs in view, under a sticky header too.

### Added
- `REDZ.ui.combobox.set(list, values)` sets what a list holds from the page, as a choice does: its hidden fields, its button
  or chips, then `input` and `change`. A form's Discard can go back to the last saved value; `reset` goes back to the first.
- `data-changed` on a `nav-link` draws the dot a field's mark has; the tab's `aria-label` says it to a screen reader.
- `form-more` on a `details` folds a long hint under a field, with a chevron that turns.
- `data-tooltip-delay` on a title or around it sets the wait of its tooltip; `0` shows it at once.
- A folded rail's tooltip stands beside its link, so it covers no other icon.
- `--redz-progress-top-size`, `--redz-progress-top-track` and `--redz-progress-top-glow` set how much the request bar shows.
- A flush list group with an `edge-start-*`, a tinted `bg-*-subtle` or an `alert` row gives every row a card's side room, and edged rows keep
  their starts in line.
- `--redz-card-header-bg`, `--redz-drawer-header-bg` and `--redz-dialog-header-bg` tint a section's head; a dialog's takes
  `--redz-dialog-header-end` and `--redz-dialog-header-line` for the room and the line under it.
- `table-scroll-last` holds a wide table's last column in place, where a row's buttons stay in view.
- `--redz-table-head-bg`, `--redz-table-head-text`, `--redz-table-head-weight` and `--redz-table-head-border` set the look of every
  table head from a product's tokens.

### Fixed
- `data-show-when` and a switch's hidden twin: a hidden field beside a checkbox or a radio of its name is what the form sends
  while none is checked, so `data-show-in` can name its value and a region without `data-show-in` no longer counts it.

## 0.16.0 - 2026-11-05

The editor is rebuilt around a living block: nobody needs HTML to change a REDZ.UI element, and every setting the
library has is one click away. Every block has a stable id, so its history, protection and, later, its translations stay
with it.

### Changed - the editor's words and marks, so update your pages
- The editor's texts changed: the passport's `editor.texts` lists about 150 new keys, and `editor.block`, `editor.block.up`,
  `editor.block.down`, `editor.block.edit`, `editor.block.columns`, `editor.block.delete`, `editor.columns.*` and
  `editor.image` are gone. A page gives its island what the passport lists.
- `editor/` is split into modules, still one file in `dist/`. The classes `editor-island*` are gone.
- A block's parts are no longer edited as HTML by everyone: the HTML of a block and of the page is an expert's, under the
  right `html`.
- The value holds every block's `data-block` and `data-lock` only with the option `ids`. A CMS passes it.

### Added - the editor
- **Blocks you can change without HTML:** the words of a block are fields found by walking it, so typing never breaks its
  markup. Hover a table for the bars of its row and column, a list for the bar of its item, with plus, trash and arrows.
  Click a word for the element bar: the path of the block down to that word, its settings, copy, move and delete.
- **The catalog:** `tools/catalog.json` names what can be changed on 19 elements, nested ones too, also in the passport as
  `editor.catalog`. The build refuses a class the stylesheets do not have, and a variant of a covered component that is
  neither in the catalog nor set aside with a reason, so a new variant cannot be forgotten.
- **The card of a block:** settings tried on while hovered or focused and kept by a click, Esc takes them back; a list's
  words as bullets, numbers, a list group, cards, an accordion, steps or a table of two columns, the words untouched; the
  block's own history, one block going back while the others stay, `options.versions` adding what the host stored; on a
  table, the numbers of rows and columns and the header row. It stands beside the editor, and on a phone as a sheet on the
  side away from its block, so it never covers what it changes.
- **Rights:** `options.rights`, flags `html`, `ai`, `design`, `structure`, `facts`, `lock`, `review`, and `langs`; left out,
  all but HTML and protection; given, a key left out is off. `setRights()` changes them on the open page. The passport lists
  them as `editor.rights`. They only hide controls: the server decides on every save.
- **Protection:** `data-lock="form"` keeps the words open and closes the form, the place and the removal; `data-lock="all"`
  closes the words too. Neither a selection nor Backspace deletes a protected block, and in the page's source it is a
  marker that comes back untouched, even when its line is removed.
- **The expert mode:** the HTML tab of a block and the source of the page, cleaned, naming what was taken out and the classes
  REDZ.UI does not know.
- **Typing:** `##`, `###`, `####`, `>`, `-`, `*`, `1.`, `**bold**`, `*italic*` and `` `code` ``; `/` on an empty line for the
  blocks; ⌘/ for all the commands; Alt Enter for the card; ⌘⇧ and an arrow to move a block; Tab and Shift Tab to nest a list;
  Tab through a table and a new row after its last cell.
- **The handle:** a block moves by dragging it, with a drop line and a View Transition where there is one; pressed, it opens
  the card.
- **Paste:** Word, Google Docs, spreadsheets and Markdown from a chat come in as REDZ.UI markup: a table stays a table, a
  heading a heading, every style and font stays behind. A link pasted over selected words links them.
- **The lens:** the strip above the text changes the width, the theme, the site's stylesheets and the language under it, and
  the text stays editable.
- **The checks:** the foot counts the words by the language's own word breaks, so Thai and Burmese count too, and lists an
  empty heading, a skipped level, an image without words, a vague link, a long paragraph and a table without a head.
- **The toolbar:** 36 px buttons with 20 px icons, a filled pressed state, the block's style as a word, an Insert that stands
  out, one scrolling row on a phone, undo and redo from the editor's own history, the caret back where a change started.
- Lists and formats are the editor's own: the browser's commands keep a paragraph with attributes around a list. The value
  says `strong` and `em` whatever the browser wrote.
- The keys hold in fields in every engine: Safari no longer throws the caret out on Enter or pulls words out on Backspace,
  Firefox crosses blocks by the arrows. Nothing touches the text while a character is composed.
- A line to type in between two blocks takes no room until the caret is in it, so the text stands as the page will.
- Markup the catalog does not know, as a migrated body has it, comes back as it came: old `font` and `center`, styles, tables
  with `colspan`. Its words can be typed, and a command takes away only what it wrote itself.
- The frame follows the page's theme live. The editor's preview names its script hosts: Firefox never matches `'self'` in a
  frame of its own, and the library may live on another host.

### Added - the library
- `REDZ.ui.status(line, null)` empties a status line.
- `data-density="comfortable"` and `"spacious"`, for tables and rows: the editor's sizes of a table.
- `badge-sm`, `badge-lg`, `alert-sm`, `alert-lg`.
- `tree-item` is in the class vocabulary.

### Fixed
- An inline edit in a `thread` keeps the message's full width.
- Escape closes a menu whose item shows a tooltip: the tooltip no longer holds the first press back.
- A tooltip survives a page that replaces its body.

### Probes
- A behaviour check can be a walk that yields real input: clicks, moves of the pointer, keys, typed text and drags. The
  editor's walk runs on every desktop engine: every kind of block, every level of rights, lists, paste, the lens and the keys.

### Budgets
- The editor's script has a soft ceiling of 70 KB gzipped, it was 30, and its styles 8 KB, they were 5. It is 30 KB today.

## 0.15.0 - 2026-11-05

A release is now the folder a project serves, and the icons are a release of their own: 13 files of 480 KB in place of
2,219 files of 8.9 MB, and a new version of the library no longer moves 2,078 icons nor empties their cache.

### Changed - renames, so update your links
- The archive `redz-ui-<version>.zip` is the folder a project serves, as it is: `css/`, `js/`, `LICENSE`, `NOTICE` and
  `redz-ui.json`. There is no `dist/` in it, and every CSS and JS file is minified:

  | Before | Now |
  | --- | --- |
  | `dist/redz-ui.min.css`, `dist/redz-ui-NAME.min.css` | `css/redz-ui.min.css`, `css/redz-ui-NAME.min.css` |
  | `dist/redz-ui.min.js`, `dist/redz-ui-NAME.min.js` | `js/redz-ui.min.js`, `js/redz-ui-NAME.min.js` |
  | `js/floor.js` | `js/floor.min.js` |
  | `css/icons.css` | `css/icons.min.css`, in the icon pack |

- The sources, the docs, this file, the README and `floor.json` are no longer in the archive: they stay in the
  repository and in the tag's source archive.
- The passport: `dist` is now `main`, `{css, js, floor}`, each path relative to the version's folder, as are the paths of
  `editor` and `packages`. `icons` is `{name, version, css}`, the pack this release needs. `css` and `js`, the lists of
  source files, are gone, and `files` lists what the archive holds beside the passport.
- In the repository `dist/` is that folder, passport included, and a CDN reads `dist/css/...` and `dist/js/...` by a tag.

### Added
- The icon pack: `redz-ui-icons-1.13.2.zip` under the tag `icons-1.13.2`, a release that changes only with Bootstrap Icons.
  It holds `css/icons.min.css`, `icons/` and its own passport `redz-ui-icons.json`, with the sha256 of every file. A
  project keeps it in a folder of its own, whose address does not change with the library's version.

### Fixed
- A `th` in `tfoot` reads as a row's head, not the table's: it kept the head's band, 12 px, `nowrap` and sticky place (#99).

### Changed in the editor
- Its frames take the icon masks from the address the page links `icons.min.css` from at that moment, whatever its host
  and query. A page that links no icons has none in the frame.

### Checks
- `php tools/build.php --check` refuses icons that changed under a published pack's version; `tools/release.php` refuses
  an archive that differs from what its passport lists. A behavior check of a `th` in `tfoot`.

## 0.14.1 - 2026-11-05

Four fixes from a walk of the ERP's screens in Chrome and Safari, and from the ERP's list.

### Fixed
- A title's tooltip no longer opens when the focus comes back from a closed menu or dialog. In Chrome it threw
  `InvalidStateError: Invalid to show a popover during another show operation` on `Esc` from a menu opened by a titled
  button, such as a drag handle's menu of moves.
- `btn-link` wraps a long text. On a phone a long title in a `btn-link` stayed on one line and pushed the page sideways;
  `text-break` alone cannot change that.
- A `data-show-when` region inside a hidden region counts as hidden: its own field no longer shows it and turns its
  fields back on, so the form does not send them. It follows its field again once the outer region shows.
- A `table-scroll` is a tab stop only while its table is wider than it. The library sets and removes `tabindex`, so a
  page drops its own: a table that fits leaves no stop that does nothing.

### Checks
- Behaviour checks of each fix: a title's tooltip with the focus back from a menu and a dialog, a region inside a
  hidden region, the tab stop of a scroller that fits and of one that does not. The docs' long `btn-link` is judged by
  the overflow check at the phone widths.

## 0.14.0 - 2026-11-05

The ERP's #98: a file the page sends becomes a stored one when the server answers its id.

### Added
- An upload's `redz:files` promise resolved with a string or a number is the id the server keeps the file under: the
  row gets `data-file-stored`, and from then on its Remove asks the page in `redz:remove`, as a row the server wrote
  does. Resolved with a Blob, or with nothing, it works as before. The row gets no field of its own: a form that
  posts the ids it keeps adds one, or reads `data-file-stored`.

### Checks
- The behaviour check of stored files sends one and removes it: kept under the id the docs' server answers, its
  Remove asks the page for that id.
- An opened layer is measured once its box rests two frames running, within a second: in CI's iOS 18 simulator, which
  has no anchor positioning, the menu guard placed a menu later than two frames after it opened.

## 0.13.0 - 2026-11-05

The packages built into `dist/` like the main two files, the ERP's #95-#97, and probes that wait for what they read:
a full CI run in 15 minutes, 25 to 35 before.

### Added
- Each package's files in `dist/`, built by `tools/min.php` from its folder as the main two are from `css/` and `js/`:
  `redz-ui-charts.min.css` and `.min.js`, `redz-ui-calendar.min.css`, `redz-ui-media.min.css`,
  `redz-ui-editor.min.css` and `.min.js`, and `redz-ui-editor-surface.min.css`, which the editor's frame links. The
  passport's `packages` and `editor` keep their shape, their paths now these, each hashed in `files`; the budgets
  hold these files; the folders stay to read, and the release archives both. The editor's script is 8.4 KB gzipped,
  11.0 as written.
- The class list knows the packages' classes (#97): the passport's `classes` and `assets/classes.txt` of both skills
  hold `calendar`, `chart`, `spark`, `lanes`, `media-grid` and the rest, so `scan.sh --moved` no longer reports them
  as unknown; a page that uses one links its package.

### Changed
- The docs link the packages from `dist/`, the editor's example as the others: the probes run what a project serves.

### Fixed
- A popover that several buttons open - the handles of a list sharing one menu of moves - marked every one of them
  `aria-expanded="true"`, drawn pressed and said "expanded" (#96). Only its opener is now: the toggle event's source,
  else the button just pressed, else the one with the focus, else the only one; the others say `false`.
- The Print docs named Bootstrap's `d-print-none`; REDZ.UI's class is `print:d-none` (#95).

### Checks
- The probes wait for what they read, not for fixed pauses: a key, a click or a drag waits two frames, in which every
  state they read is set, and a layer's transitions only where its box is read live; a popover is measured at rest
  whatever its transition. Chrome's driver answers as soon as its message is in. `docs/all.html` in Chrome: 5:55 to
  1:46, the same findings.
- A part of CI may run a share of its engines' pages, split by a hash of each page's name, so a page keeps its share
  whatever pages come or go: the current Chrome and NVDA in Chrome and in Firefox run in two shares each, iOS 18 and
  iOS 26 in a job each - five macOS jobs, no queue. Measured on run 41961288948: Chrome 24 to 13 minutes in one job,
  Firefox 15 to 7, Safari 18 to 9, iOS 17 to 7 and 9, the floor 7 to 3-4, NVDA 21 to 11-12, VoiceOver 10.
- Sharper reach: the behaviour checks reach the full pages of the desktop browsers, a package's file the pages that
  link it; an exception of the config is marked used by its own text, not by its place in the list.
- The minifier's cell holds each package's stylesheet squeezed against it as written, in every engine.
- `tools/docs.php` refuses docs prose that names a Bootstrap class the map renames or removes.
- On the Mac before CI: Chrome, Firefox and Safari Technology Preview (`safari-preview`), whose own driver takes a
  session while the Mac owner's Safari is open; CI keeps the shipping Safari.

## 0.12.0 - 2026-11-04

The ERP's one list of every screen left to move, asked as #42-#93: commands and overlays, form controls, behaviours
of regions, tables and lists, status and data, utilities. CI checks each part where it stands, and the behaviour
checks run in every desktop engine.

### Added
- **Commands:**
  - `command="--copy"` copies its `data-copy`, a field's value or an element's text, says so politely (texts
    `copy.done`, `copy.failed`), shows a check in place of its icon and fires `redz:copy`; the browser's copy
    command stands in where the Clipboard API is missing.
  - `command="--print"` prints the page; printing opens every closed `details` and `--toggle` region for the paper
    and closes them after; cards are not cut across pages.
  - `command="--theme"` with `light`, `dark` or `system` sets `data-theme` on `html` and shows which in
    `aria-pressed`; one button with `toggle` flips light and dark; the page hears `redz:theme`.
  - `command="--share"` shares through the device's share sheet, or opens its menu, whose `share-*` links the
    library writes and colours; `share-vk` draws its letters.
  - `command="--download"` saves a QR tile as a PNG on white (`data-file`, `data-size`).
  - `command="--step-up"` or `"--step-down"` with `aria-controls` steps a number field, `aria-disabled` at its ends.
- **Overlays and calls:**
  - An image viewer: a link with `data-zoom` opens its image in one modal dialog the library makes, in the top
    layer, above an open dialog too; links with the same word make a set, stepped by the arrow keys and buttons, with
    a count (texts `viewer.prev`, `viewer.next`, `viewer.count`).
  - `REDZ.ui.prompt({title, text, label, value, placeholder, type, inputmode, pattern, required, ok, cancel, tone})`
    asks for one value and answers it, or `null`.
  - `REDZ.ui.progress(promise)` shows a thin bar along the top of the window: after 150 ms, for at least 400 ms, one
    for every request at once, still under reduced motion.
  - `REDZ.ui.status(line, promise | {tone, text})` on a `.form-status`: "Saving…" past 400 ms, then "Saved", which
    fades, or the refusal's own words, which stay (texts `status.saving`, `status.saved`).
  - `REDZ.ui.confirm({rows})` shows label and value rows, text only.
  - A tablist with `data-hash` follows `location.hash`, nested tabs too, and a choice writes the panel's id into the
    address; `redz:selected` fires after every selection; `REDZ.ui.select(tab)` chooses a tab from code through
    `redz:select`.
  - `menuitemcheckbox` and grouped `menuitemradio` items flip `aria-checked`, keep the menu open and fire
    `redz:check`.
- **Forms:**
  - A textarea with `data-grow` starts at its rows and grows with its text: `field-sizing` where the engine has it,
    the library's script below; a `max-h-*` caps it.
  - `data-submit="change"` on a form or one of its controls sends the form by `requestSubmit` when it changes.
  - `data-show-when` and `data-show-in`: a region shows while a field holds one of the values, its fields disabled
    while it is hidden.
  - `form-counter` with `data-counter`: the characters typed against `maxlength` or `data-counter-max`,
    `data-state` `near` and `over`, said once the typing pauses near or over (text `counter`).
  - `form-control-color` with a hex twin, `data-color-for`; `data-color` sets `--redz-color` through the CSSOM for
    a `dot`, an `icon-tile`, a `choice-media` and the edges `edge-top-color` and `edge-start-color`.
  - `data-brand` on `html` or a region makes the primary tone, its subtle fill, its contrast text, the focus ring and
    the links of one colour, `--redz-brand`, in both themes.
  - Segmented choices on Bootstrap's `btn-check` in a `btn-group`; a `btn` with `aria-current` drawn pressed;
    `btn-float`, a button as tall as a floating field.
  - A combobox with `data-create` and no options takes free values: a comma takes the words, a `pattern` or
    `type="email"` refuses others (text `chip.invalid`). Options with `data-level` 2 or 3 are indented, and the
    search shows a match with its parents.
  - `rating`, stars filled to `data-v`, and `rating-input`, five radios drawn as stars; a page, Ratings.
  - `choice-danger`; the save bar's `data-state="error"` and `"saved"`; `data-changed` marks a changed field, check
    or switch.
  - Uploads with the files the server holds: rows with `data-file-stored`, whose Remove asks the page in the
    cancelable `redz:remove` (`detail.id`, `detail.row`), busy until it settles, its words said when it is refused;
    `redz:change` with `detail.count` after each change; a plain `button.btn` as the zone; `upload-image`, one image
    shown whole on white with its remove button in the corner.
  - Repeaters: a list with `data-repeat` and a `<template>` adds rows by `--add` and takes them by `--remove`, `{i}`
    in their attributes a running index, the count held by `data-min` and `data-max`, `redz:add` and `redz:remove`
    cancelable.
- **Regions:**
  - A search with `data-filter` hides a region's items that lack the typed words, case and accents aside; a tree
    keeps a match's parents; `data-filter-empty` shows when nothing matches; the count is said.
  - A tap on a disabled control with a title shows and says why, for three seconds.
  - `toggle-chevron`, `toggle-open` and `toggle-closed` follow a button's `aria-expanded`.
  - `time[data-elapsed]` shows a clock since its `datetime`, and `time[data-ago]` says how long ago or how soon in
    the page's language; one ticker serves them all, paused while the page is hidden.
- **Tables and lists:**
  - `table-group` and `table-subtotal` rows; `aria-current`, `aria-selected` and `table-active` rows drawn;
    `a.table-sort` for a server's sort.
  - `table-scroll`, sideways in its card, with `table-scroll-first` holding the first column; the head sticks to the
    page where an element can scroll on one axis alone (Chrome 156), and scrolls away with it elsewhere.
  - A row whose title link is a `stretched-link` is a link as a whole; its controls stay its own.
  - `dl.summary`, `dl.totals` with `totals-grand`; `list-group-header`; tree rows draw `aria-current`, hold
    `tree-actions` and checks.
  - The media grid as a chooser (`label.media-tile` around a radio or a check), `media-grid-compact`, and
    `data-cover` for a cover mark.
- **Status and data:**
  - `pre.log` with tone lines, following its end with `data-follow`; `div.diff` with `ins` and `del` lines and
    changed words inside a line; a page, Logs and diffs.
  - `dot-live` breathes while its `data-state="running"`, still otherwise and with reduced motion.
  - The step list's states warning, info, ask, waiting, skipped and locked; `step-list-body`, the current, asking and
    failed blocks tinted; `stage-list`, a pipeline across from a 768 px region, with `stage-list-actions`.
  - Stat tiles as links (`a.stat`, `aria-current`), with `stat-sub`, `stat-delta` (`data-trend`, `data-good`), a
    progress or meter slot, `stat-meta`, `stat-emphasis`, and `aria-busy` drawing the number as a placeholder.
  - Calendar days in a `data-state` (worked, open, pending, absent, off) with `calendar-legend`, drawn as lines in
    forced colors; `button.calendar-day`.
  - Charts: `chart-bar` (shares of a whole in one bar), `chart-rows` (breakdown rows) and `chart-values` (each
    column's number above it).
  - The charts' eight colours in the main tokens, for categories outside a chart: `dot-chart-1..8`,
    `edge-top-chart-1..8`, `edge-start-chart-1..8`, `icon-tile-chart-1..8`; `icon-tile-lg`; `drawer-lg`, 38rem.
- **Utilities:** `fs-11`, `fs-40`, `fs-48`, `text-pre-wrap`, `tracking-wide`, `line-clamp-2`, `line-clamp-3`,
  `w-56..160`, `h-32/40/72`, `size-32..80`, `min-w-56..288`, `max-w-360`, `max-w-560` and `ratio-1.91x1`.
- An empty `.alert` takes no room and stays in the accessibility tree: a page keeps its `role="alert"` on the page
  from the start and fills it, so a screen reader says the words. VoiceOver on macOS 15 could miss an alert shown from
  `hidden` at the moment it was filled. The PIN pad's docs fill their alert in place.

### Changed
- The budgets: the stylesheet at most 32 KB, the script 30 KB, gzipped (the owner, for the ERP's list #42-#93).
- `busy()` and `data-cooldown` share a button's `aria-disabled`: neither wakes the other's wait, and the state from
  before both comes back when the last ends.
- A table's head sticks to the top of a `dialog-body` or a `card-scroll` card's body.
- `page-center` lays its column out as a grid, so a child that is a `vstack` or an `hstack` stays centered.
- Dragging an item by its handle: a lifted copy follows the pointer while the item's place - an empty, dashed slot -
  goes where it will land, the other items gliding aside; near the edge of the box the list scrolls in, it scrolls;
  `Escape` takes the item back. Moves by the menu glide too. With reduced motion nothing glides.
- `nav-underline` links keep a little room of their own, the gap between them smaller by as much, so the focus ring
  stands off the words.

### Fixed
- `form-adorn` gives a select the start room it gives a field: its value no longer sits under the icon.
- Row headers (`th` in `tbody`) took the head's sticky offset.
- `data-cooldown="0"` during a count froze it.
- A flush list of `list-group-item-action` rows keeps the rows' room, so a hover's tint and the current row's bar no
  longer sit on the words (#94); a flush accordion keeps its rows' room the same way.
- An accordion's header has the item's corners: a `summary` cannot inherit them, so its hover and its focus ring were
  square inside a rounded item.
- A prompt's field is heard as the dialog opens: the dialog holds no form, and a value is taken once the field is
  valid.
- `--download` that the browser cannot draw says so in the console instead of throwing.

### Checks
- Chrome and Firefox, the current ones and the floor's, run on Linux in CI, each engine a job of its own; macOS runs
  Safari, the simulators and VoiceOver.
- CI checks each part where it stands: a part - an engine, or the floor's three - that passed on a commit stays passed
  on a later one whose changes cannot reach it. A fix in one reader's probe runs that reader again, a package's file
  only the pages that load it, a speech step only its page in the readers. The sheet shows which parts were checked
  on an earlier commit.
- The behaviour checks of the widgets are permanent probes (`tools/probes/behave.js`), run on `docs/all.html` in every
  desktop engine: the PIN pad, cooldowns, a busy button's words, a confirmation's note and lists, charts' numbers and
  roles, highlights, the media views, scrolling navs, uploads of one file and with thumbnails, a thread's editing,
  floating labels in input groups, an alert filled in place, and dragging rows and grid cards - by the engine's own
  pointer, left to right and right to left.

## 0.11.0 - 2026-11-04

The ERP's sign-in, kiosk, console, list and support screens, asked as #16-#41; charts, calendars and the media
library as packages of the release.

### Added
- **A floating label in an input group:** `.input-group > .form-floating` grows as a field does, its control's joined
  corners square, and its parts - `input-group-text` for an icon or a unit, a `btn` or a square `btn-icon` - take its
  height. `form-floating form-adorn` on one element puts an icon inside the field's own border, the label after it.
- **A centered page** (`page-center`, `page-center-brand`, `page-center-corner`): a page without the shell - sign-in,
  registration, a reset, a second factor, an unlock, an enrolment - in a column of `--redz-page-center-width` (30rem)
  at the middle of the window; a card in it is raised, and the corner's theme button scrolls with the page, clear of
  the logo on a phone.
- **A PIN pad** (`pin`, `js/pin.js`): around one numeric password field it draws the dots and a keypad of 1-9, 0 and
  delete, its keys out of the Tab order and never taking the focus; a minlength below the maxlength takes any length
  and adds an Enter key. A whole PIN asks the page in `redz:pin` (`detail.value`); the pad is busy while the page
  checks, a wrong one is cleared and marked - red dots and one shake; left alone it submits its form. Texts
  `pin.delete`, `pin.enter`.
- **QR codes** (`qr`): a white tile in both themes, in forced colors and on paper, the code sized by `--redz-qr-size`.
- **A kiosk** (`kiosk` and its `-head`, `-langs`, `-main`, `-date`, `-clock`, `-state`, `-title`, `-line`, `-corner`,
  `-foot`): a full screen for an always-on tablet - a huge clock, a round state on an icon tile that breathes while
  it waits and turns a ring while busy, huge actions, a mirrored camera preview in the corner.
- **`btn-xl`**, 56 px, for a touch screen and a page's one action; a kiosk's grow to its size.
- **Cooldowns** (`data-cooldown`, `js/cooldown.js`): a button waits N seconds, `aria-disabled`, the seconds left after
  its words in the text `cooldown`, then wakes; setting the attribute again starts it again.
- **A busy button's words:** `REDZ.ui.busy()` turns a button's leading icon into its spinner and keeps its words; with
  `data-busy` the button shows those words while it waits and says them politely after 400 ms.
- **A confirmation that says what goes:** `REDZ.ui.confirm()` takes `note: {tone, text}`, an alert under the text, and
  `sections: [{title, items}]`, a title over a list each - what goes, what stays - all of it text.
- **Reordering a table's rows and a grid:** `data-reorder` on a `tbody` moves its `tr[data-value]`, the order's hidden
  fields and status after the table; in a grid of more than one column or a flex row the pointer drags in two
  dimensions, before or after the item under it by the half it is in, right to left too.
- **Stat tiles** (`stat`, `stat-value`, `stat-label`, `stat-{tone}`): a number, its label and an icon in a tone - and
  as a button with `aria-pressed`, the filter for what it counts.
- **Steps and timelines:** `step-list`, the steps of a long job with `data-state` done, current (its own icon turns),
  failed, kept or pending and a `step-list-detail`; `timeline`, a record's events joined by a line, each with an icon
  tile, a `timeline-time`, words and a description list.
- **Choice tiles** (`choice`, `choice-media`): radios or checks drawn as tiles, the chosen one the only thing in
  color; a white banner for a logo.
- **Sortable columns** (`table-sort`): a header's button draws the arrow of the header's `aria-sort`.
- **Hairlines:** `progress-xs` (3 px) and `meter-xs` (2 px).
- **Charts**, a package of the release (`charts/charts.css`, `charts/charts.js`), linked on the screens that show them:
  a chart is the table of its numbers drawn by CSS. `chart` stacks each row's cells as a column from its `data-v`, the
  header cells its legend, eight series colors `--redz-chart-1` to `-8` chosen to stay apart for color-blind eyes in
  both themes, `data-tone` for a state's color, `data-empty` for a stub; `spark` (`spark-md`, `spark-lg`,
  `spark-median`) is a row's sparkline of runs by `data-state`; `lanes` is a board over a time window - `lanes-scale`,
  `lanes-tick`, `lanes-tick-once`, `lanes-span` - with a now line. The script hands the `data-v`, `data-at`,
  `data-from`, `data-to`, `data-median` and `data-now` numbers to the stylesheet through the CSSOM, which a strict CSP
  allows, and gives a chart table its table roles.
- **Calendars**, a package (`calendar/calendar.css`): `calendar`, a month of days with `calendar-day`,
  `calendar-event` and `calendar-more`, days outside the month, weekends and today; `schedule`, days across things
  with a sticky name column and `data-state` busy or over.
- **The media library**, a package (`media/media.css`): `media-grid` of `media-tile`s - a check, a handle, a square
  `media-tile-thumb`, `-name`, `-meta`, `-actions` - and `data-view="list"`, rows without previews.
- **Views** (`command="--view"`, `js/view.js`): buttons with `aria-controls` and a `value` put it in the list's
  `data-view`, press the one that shows and tell the page in `redz:view`.
- **Highlights** (`data-highlight`, `js/highlight.js`): elements of one key light together on hover and focus,
  `data-highlighted`.
- **A nav that scrolls shows it goes on** (`js/nav-scroll.js`): a nav or a tab list wider than its box fades at the
  edge it goes on past, `data-more` saying which, by scroll position and right to left; its current or selected item
  is scrolled into its view when it loads, the page left where it is.
- **An upload of one file:** an input without `multiple` holds one file - a new one takes the place of the one before,
  its row and its sending, and of several dropped only the first is taken.
- **Upload thumbnails:** `upload-thumbs` draws the files as 5rem squares, an `img data-file-preview` in the template
  showing the image itself with the remove button on its corner; `data-max-files` refuses the files past it with the
  text `file.count`; a page answering `redz:files` with a promise of a file - a resized image - puts that file in the
  input in the original's place.
- **Message threads** (`thread`, `thread-message` with `data-mine`, `thread-body`, `thread-meta`, `thread-edited`,
  `thread-bubble`, `thread-files`, `thread-file-remove`): a conversation, the person's own at the end in a tint, edited
  in place by an inline edit.
- **A card whose body scrolls** (`card-scroll`) between its fixed header and footer, and `max-h-*` utilities, 160 to
  640 px; `max-w-80`, `-120`, `-160` and `-240` for the controls of a toolbar.
- **Utilities:** `edge-top-{tone}` and `edge-start-{tone}`, a 3 px state on an edge; `flash`, a ground lit once;
  `sticky-top`, under the app header in the shell (`--redz-sticky-top`); `offscreen`, outside the page yet rendered -
  a trap field for bots, a badge reader's field.

### Changed
- The main stylesheet's budget is 28 KB gzipped, from 26 KB (the owner's choice for this release).
- `fieldset` has no frame, margin or padding of its own and `legend` no padding, as in Bootstrap's reboot.
- Buttons in `.table-actions` sit 4 px apart, whitespace between them or not.

### Fixed
- After a drag, the next press of a drag handle from the keyboard opened no menu: the click the drag swallows is now
  only the one that ends it.

## 0.10.0 - 2026-11-04

What the ERP's move from Bootstrap 5.3 asked for, and the editor.

### Added
- **The editor**, a package of the release linked apart (`editor/editor.css`, `editor/editor.js`,
  `editor/surface.css`; the passport's `editor`): `REDZ.ui.editor(host, {value, placeholder, lang, dir, styles, scripts,
  blocks, images, embed, grid, onChange})` → `{getHTML(), setHTML(html), focus(), destroy()}`. It edits REDZ.UI markup
  only, in a frame whose own Content-Security-Policy runs no script, every value parsed inert and cleaned (no script,
  no `on*`, no address but a path, a fragment, http(s), mailto or tel). Prose - paragraphs, headings, lists, quotes,
  code - is edited in place; any other element is a block kept as the markup it came as, with its tools (move, edit its
  HTML, preview, delete, a grid's columns); the package's blocks are the library's components (notes, a card, an
  accordion, tabs, a list group, a table, a carousel, badges, buttons, a button group, progress, grids); a block that
  moves is drawn open and its Preview runs it alive in a dialog's frame of REDZ.UI's own CSS and JS. An APG toolbar
  (one tab stop, the arrows, Alt+F10 from the text), its own undo and redo, a paste kept to prose, images from the
  page's sources, YouTube and Vimeo videos; its words are the island's `editor.*` texts (`editor.texts` in the
  passport). Budgets: 30 KB of script, 5 KB of styles, gzipped.
- **Tooltips from titles** (`data-tooltips`, `js/tooltips.js`): inside an element with `data-tooltips` (`<html>` for
  the whole page) an element's own `title` shows as the library's tooltip after a short hover and on a keyboard's
  focus; Escape hides it without moving the focus, the pointer may rest on it, a touch never opens it. While hovered
  the title is held back so the browser does not show its own, and an element named only by its title keeps that
  name; screen readers hear the title as before.
- **A tab the page may refuse** (`redz:select`): before a person's click or key selects a tab, the tablist fires the
  cancelable `redz:select` (`detail.tab`, the tab asked for, and `detail.from`, the one being left); a page that answers
  with `event.detail.respondWith(promise)` has the tab selected only when the promise gives `true`, and otherwise the
  tab being left stays, with the focus.
- **A confirmation with a phrase to type** (`REDZ.ui.confirm({…, phrase})`): a field under the text, labelled by the
  island's new text `confirm.phrase`, takes the focus; the confirming button waits until the words match, and Enter in
  the field confirms then.
- **The browser floor in one script** (`js/floor.js`, the passport's `dist.floor`): a plain script for the head, before
  the stylesheets, that marks `<html data-floor="below">` when the browser lacks a feature the library is built on, so
  every product judges a browser the same way and shows its own words. `tools/build.php` writes it from
  `tools/floor/tests.json`, and the floor gate holds that every browser at the floor passes it.
- **Carousels** (`carousel`, `carousel-inner`, `carousel-item`, `carousel-indicators`, `carousel-fade`,
  `carousel-center`, `carousel-auto`, `carousel-overlay`, `--redz-carousel-items`, `-gap`, `-peek`, `js/carousel.js`),
  Bootstrap 6's on a scroll-snap row: the browser swipes, scrolls and snaps the slides; buttons with `command="--prev"`
  or `"--next"` and `aria-controls` move a slide round the ends; an empty `carousel-indicators` fills with a 24 px button
  per slide; the slide in place is `aria-current="true"`, each a group named by the island's new text `slide`
  ("{position} of {count}"); `command="--play"` plays them every 5 seconds while pressed, never for less motion,
  paused on hover, focus and a hidden page; a slide a person moves to is told politely, never while it plays.
- **A one-time converter of stored content** (`scripts/convert.php` in the migration skill, PHP 8.4+): rewrites a
  Bootstrap 5.3 body into REDZ.UI markup by the map - forms taken, removals dropped, a row's grid given the columns its
  children's spans need, a few review rows by their context (a badge's tone, a compact table, a lead, a display
  heading, white text on a tone, a fluid image, a light alert) - and lists what it left; by file, by stream or from PHP.
- `list-unstyled` and `text-{tone}-contrast` (the tone's contrast text, for white text on a toned shape).
- **A side navigation folded to a rail** (`command="--fold"`, `data-folded`, `js/fold.js`): a header button with
  `aria-controls` naming `app-sidebar` folds it into a 56 px rail of its icons above 1024 px and back, pressed while
  folded; each link shows its words as a tooltip and keeps them as its name. The library stores nothing: `redz:fold`
  (`detail.folded`) tells the page, which writes `data-folded` back when it loads. A shell without `app-sidebar` is one
  column by itself.
- **`--redz-link`**, the links' color, the primary tone unless a theme or a white-label palette sets its own.
- **`badge-inverse`**: the text color with the page color on it, for a mark that stands apart from every tone.
- `border-{tone}-subtle`, `spinner-grow` (a dot that grows and fades), `btn-group-vertical`.
- The migration skill's scan reads Bootstrap's custom properties (`--bs-*`, in stylesheets, style attributes and
  scripts; the map's 449 new rows from `tools/map/properties.tsv`), class values written over several lines and icon
  names `icons/` lacks, and prints the map's note where a finding has no form; `--moved` reads a moved file by
  REDZ.UI's names (`gap-4` is its 4 px) and template code that writes whole names for them, so it scans clean.

### Changed
- `dialog-lg` is 50 rem wide (800 px, Bootstrap's `modal-lg`), so `md:` fires inside it (from 48 rem, where it never
  did).
- The stylesheet's budget is 26 KB gzipped (from 24).
- `data-density="compact"` is documented on any element - a table, its card, a region - not only on `<html>`.
- The map: `offcanvas-*` is the app shell's `app-sidebar` (review), `table-sm` is `data-density="compact"` on the
  table, `data-bs-toggle="tooltip"` is the title inside `data-tooltips`, `data-bs-title` is `title`.

### Fixed
- A long dialog keeps its header and its footer in view on any window, only `dialog-body` scrolling between them (above
  576 px the whole dialog scrolled), with a `<form method="dialog">` holding all three too.
- `--toggle` closes a table's row: containment cannot hide a row, so `hidden="until-found"` left it on screen; a row,
  a row group or a cell now closes as plain `hidden` (find in page does not open it).
- The App shell page's state grid wrote `<navaria-label>` for `<nav aria-label>`.
- The scan named `references/triggers.md`, which is `references/states-and-triggers.md`.
- The map's notes wrote a rule's `$1` as it was (`bg-$1`) where its forms had the class's own words.

## 0.9.0 - 2026-11-04

A site's header by Bootstrap 6's names, for the sites as well as the admin.

### Added
- **Navbars** (`navbar`, `navbar-brand`, `navbar-nav`, `navbar-text`, `navbar-toggler`, `navbar-translucent`,
  `navbar-expand` and its width prefixes `sm:` to `2xl:`, `js/navbar.js`): a header with the site's name and its links,
  which stand in its row from the header's own width and below it open from the toggler as a `<nav class="drawer"
  popover>` panel at the side of the screen. The panel closes when a link in it is followed, when the focus leaves it
  for the page and when the header grows wide enough for its row; the page under it does not scroll while it is open.
  The link the person is on is underlined. With `nav-overflow` inside, the links that do not fit the row fold into
  "More" before the whole row goes behind the toggler.
- The migration skill's map turns Bootstrap 5's `navbar`, `navbar-expand-*`, `navbar-brand`, `navbar-nav`,
  `navbar-text`, `navbar-toggler` and `navbar-toggler-icon` into these, and names what `navbar-collapse` and
  `navbar-dark` become.
- The screen reader probes hear the "More" button of a nav that does not fit, a popover's button and a navbar's toggler.

### Changed
- **Nav overflow:** a link that opens a menu folds with it, as a group of the menu's items under the link's words, and
  stays in the row while its menu holds the page the person is on; a menu open under a link that folds closes.
- A drawer that is a `popover` slides in as a modal drawer does.

### Fixed
- A drawer on a narrow screen stays inside it where the browser draws a scrollbar beside the page (Firefox): its width
  counted the window with the scrollbar's place, which an open drawer keeps.

## 0.8.0 - 2026-11-04

What Bootstrap 6 has that REDZ.UI had not, for the admin of the CMS and the ERP, by Bootstrap 6's names.

### Added
- **Steppers** (`stepper`, `stepper-item`, `stepper-horizontal` and its width prefixes `sm:` `md:` `lg:`): the steps
  of a task on an `<ol>`, the step the person is on `aria-current="step"`, the steps before it drawn as done by their
  place, the numbers counted by the list, a track between the circles; a done step may hold a link back.
- **Nav overflow** (`nav-overflow`, `nav-overflow-keep`, `js/nav-overflow.js`): a nav that does not fit its own box
  hides its links from the end and gives them back, in their order, as the items of a "More" menu after the nav; the
  link the person is on and a link with `nav-overflow-keep` stay in the row. Tabs fold the same way: the arrows pass
  over a hidden tab, and a tab chosen in the menu comes back into the row selected. A plain click on an item clicks the
  hidden link itself, so the page's own handlers run. The button says the island's new text `more`.
- **Popovers** (`popover`, `popover-header`, `popover-body`): a titled panel beside its button on the browser's
  `popover`, opened by `commandfor` and `command="toggle-popover"`, placed below with its start edge on the button's
  and kept beside it by `js/menu-place.js` where an engine cannot anchor it.
- **Prose** (`prose`): long text from an editor or Markdown with no classes inside: reading sizes, the rhythm between
  blocks, a 72-character measure, lists, quotes, code, rules, images and tables.
- **A range** (`form-range`): the native slider in the accent color, full width, disabled as a field is.
- **Utilities**: `divide-x` and `divide-y` (a line between the children), `vr` (a rule as tall as its flex row),
  `icon-link` (an icon in a link's line), `justify-items-*` and `place-items-*` with width prefixes.
- The migration skill's map turns Bootstrap 5's `popover`, `form-range`, `vr` and `icon-link` into these, and
  `data-bs-toggle="popover"` into `commandfor` with `command="toggle-popover"`.

### Changed
- The docs, the demo pages, the Bootstrap map and the tools that write them use "-" where they used the em dash and the
  en dash.
- A docs page's "States" is one region, the scrolling grid's: its section no longer carries the same name, which a
  screen reader's landmark keys met twice.

## 0.7.1 - 2026-11-04

### Fixed
- The passport's `texts` holds every key the island must give the library - `close`, `confirm.ok`, `confirm.cancel`,
  `busy`, `remove`, `create`, `moved`, `file.type`, `file.size`, `strength.short` … `strength.strong`, `found.other` -
  where 0.7.0's held only the first four, and its new `plurals` names the keys whose other plural forms a page may add
  (`found`). The keys are declared once in `tools/vocabulary.json`; `php tools/build.php --check` holds them against
  every `text('…')` and `textCount('…')` the scripts ask for and against the docs' texts.
- The migration skill's `scan.sh` reads a class value that holds template code by its words: the text around the code
  and the quoted strings inside it, not the code (PHP's `?`, `echo`, `===` were reported as unknown classes); a string
  compared, a key or an index is no class; only the quoted names of `classList` calls count; a class joined in a
  script's string is reported as built in code; minified files (`*.min.js`) are left out. On the ERP the findings went
  from 21 192 to 14 935, the unknown ones from 5 458 to 1 902.
- A combobox's button is collapsed by the time its closing panel hands the focus back to it: its `aria-expanded`
  follows the panel's `beforetoggle`, not its later `toggle`. NVDA in Firefox said the button expanded after a choice
  and never said it collapsed.
- A button that opens a popover by `commandfor` (`toggle-popover`, `show-popover`) says whether it is open in
  `aria-expanded` in every browser: `js/commands.js` writes it before the popover opens or closes and when the button
  takes the focus. Firefox gives such a button no expanded state of its own, so NVDA said a menu's button and a
  tooltip's button without "collapsed" or "expanded". An open menu's button now also takes the look of
  `.btn[aria-expanded="true"]`.

### Faster probes
- `php tools/probe.php` runs the engines at once on a Mac, a process each, the ones `safaridriver` drives (Safari,
  VoiceOver, the simulators) one after another, and joins their sheets; `--serial` keeps the old way. `--pages=PAGE,…` (and the workflows'
  `pages` input) checks only those pages, leaving the other pages' exceptions unjudged.
- CI checks only what changed since the nearest commit that passed: `php tools/probe.php affected` sorts the changed
  files into what the probes never read (texts, skills, the build and release tools, comments), pages (only those, in
  the parts whose engines run them) and the rest (every part); the run's sheet is the base's with those pages checked
  again, and a run that passes leaves the artifact `verified` for the next one. A commit that passed runs nothing
  again (a branch fast-forwarded to `main`, a tag on a passed commit), and Pages takes that run's sheet; a run whose job GitHub never placed on a runner reruns its failed jobs once by itself
  (`.github/workflows/rerun.yml`); a simulator's Safari that ends while pairing is started afresh before the next try;
  the engines' cache is restored from the last one when the config changes.
- On a Mac whose own Safari is open, desktop Safari and VoiceOver are skipped with the reason: Safari 27 takes an
  automation session only in a Safari `safaridriver` starts ("Safari was not launched for automation"), and the
  owner's Safari is never quit; CI runs them.
- A finding's parts are joined by " - ", the exceptions' findings with them.

### Every widget that speaks, heard by NVDA too
- The probes hear NVDA 2026.3 in Chrome and in Firefox on Windows Server 2025 through the same 80 speech steps: a
  portable copy made from NVDA's official installer, its sha256 checked, on a config of the run. NVDA's own Remote
  Access serves itself on a port of the run, and the probe joins it over TLS, its certificate pinned by its
  fingerprint: every utterance comes as a phrase and every key goes in as a user's, so NVDA meets a page in browse
  mode and switches to focus mode by itself. A page's words are compared as NVDA says them: split where its dictionary splits
  words, its signs said as its symbol table says them.
- NVDA also reads each speech page whole by its quick navigation - headings by H, landmarks by D, form fields by F -
  and every heading, landmark and control the page holds must be among what it says, in order; a control with no
  words to say is a finding of its own.
- The probes run on Windows: Chrome's DevTools protocol over a port and a WebSocket where its pipe cannot run, shown
  windows for a screen reader, the runner's own removal and unpacking. The sheet's "Said by the screen readers" shows
  every reader; "Read by NVDA" shows each page's reading.

## 0.7.0 - 2026-11-03

### Every widget that speaks, heard by VoiceOver
- Removed: `commandfor` on a `--toggle` button. The button names its region in `aria-controls` and carries
  `command="--toggle"` and `aria-expanded`; `js/toggle.js` takes its click and sends the region the command event,
  with `command` and `source`, as the platform sends it to a `commandfor`'s target. WebKit exposes a button with
  `commandfor` and a custom command as collapsed whatever its `aria-expanded` says, so VoiceOver in Safari said
  "collapsed" of every open region and tree group. The trees' toggles moved too; a button still written with
  `commandfor` toggles where the browser has commands, and the probes flag it.
- A tooltip's button names its tooltip in `aria-describedby`: a screen reader says the answer with the question -
  opening a popover says nothing of its words. The probes flag a tooltip's button its tooltip does not describe.
- Live regions are made before their first words: a list's status of moves when its menu of moves opens or a drag
  starts, a combobox's when its search takes the focus, a password's words when the first key is typed. A region made
  with its words says nothing, so the first move, the first count found and every level of strength went unsaid.
- A combobox of many says politely the label of a value it creates, its panel still open.
- A password's level is said by a live region of the field's own: VoiceOver says nothing of a password field's own
  description changing, live or not.
- The probes hear every widget that speaks: the config's `speech`, one list of 80 steps on 18 pages for every
  reader - the words the page owns shared, a reader's own apart - which VoiceOver goes through on macOS 15 and 26. A
  listener writes each phrase as it comes; a page is heard up to three times; the docs' header and navigation are
  inert meanwhile, as VoiceOver's cursor carried the keyboard focus through them. What a version does every run is an
  exception with its reason, what it does now and then a step `unsteady` there. A manual run may name its parts.

## 0.6.0 - 2026-11-03

### Structures: trees, reordering, uploads
- Trees (`css/components/tree.css`, `js/tree.js`): `tree` › `tree-item` › a `tree-row` with a `tree-toggle` - a
  `--toggle` button for the item's `tree-group`, its chevron turned when open and mirrored right to left - and the
  item's link. A group with `data-lazy` and no items fires `redz:expand` when it first opens: answered with a promise,
  its toggle is busy until the page has put the items in, and a refusal closes it for another try. `--expand-all` and
  `--collapse-all` on a button for the tree open and close every group that holds items.
- Reordering (`js/reorder.js`): a list or a tree with `data-reorder` naming a hidden field moves its items, each with a
  `data-value`, by a `drag-handle` - a button opening the list's menu of moves, its items `data-move="up"`, `down`,
  `first`, `last`, and in a tree `in`, to the end of the group of the item above, and `out`, after its parent - or by
  the pointer dragging the handle within its group (pointer events, a tap still opens the menu). A move is done at
  once, the focus back on the handle and the page's text `moved` said; then `redz:move` on the item: refused, the move
  is undone and the page's words said; left alone, hidden fields beside the list hold the order, and with
  `data-parent` each item's parent.
- Uploads (`css/components/upload.css`, `js/upload.js`): an `upload` with its file input, an `upload-zone` button, a
  `<template>` of one file's row and an `upload-list`. Chosen, dropped on the zone or pasted, each file is checked
  against `accept` and `data-max-size` - the page's texts `file.type` and `file.size` say a refusal in its row - then
  sent on its own by `redz:files`, with its row, `progress(fraction)` for its bar and a `signal` its remove button
  aborts; one file's error leaves the others. Left alone, the file joins the input's files for the form. A file
  dropped beside the zone does not open in the window; each remove button is named after its file.
- The menu guard (`js/menu-place.js`) places a menu again when the menu or its button changes size, and waits for a
  menu with no box yet: on iOS 18 a menu of moves opened from a second handle stood off the screen, and on the floor's
  engines a combobox's panel above its field came 252 px away from it as its list shrank. A menu placed again keeps
  its gap from the button.
- The names pass reads `.catch(` and `.for(` as the properties they are, not as the statements' heads.
- The docs: pages for trees and uploads, reordering on the page of list groups, 34 Arabic strings; the probes walk
  `--expand-all`, a move by each list's menu and two files on each upload, wait for a toggle busy with its children,
  and flag a handle outside an item of a `data-reorder` list and an upload without its parts. The docs' state mirror
  is checked on the page as loaded, before the walks: in headless Firefox, after a move of the focused handle, Tab
  went on from the handle's old place.

## 0.5.0 - 2026-11-03

### Forms: tags that create values, inline edit, the one-time code, passwords
- Tags that create values: a list with `data-create` ends with “Create …” - the page's text `create` - while the
  search's words are no option's label and no chosen one. Taken, the label goes into a hidden field `data-create`
  names, beside the list's own, and the search empties for the next one; a page that makes the value on its server
  cancels `redz:create` and answers `{value, label}`, an option of the list from then on.
- Inline edit (`js/inline-edit.js`): a button with `command="--edit"` opens a form of class `inline-edit-form` in
  place of the value it names in `data-for` - or a `popover` form beside the button, for a value inside another form -
  its field focused and selected. Enter saves, Escape or `--cancel` puts the field back, a blur leaves it open; the
  submit fires `redz:save`, and a page that answers it with a promise has the Save button busy until it settles, a
  refusal's words in the form's `invalid-feedback`, said at once.
- The one-time code: `form-control-otp` - one field, its digits spaced, `autocomplete="one-time-code"`: it takes a
  paste and the code the system offers; no box per digit, no submit on the last digit.
- Passwords (`js/password.js`): `--reveal` shows a password field's text and hides it again, `aria-pressed` saying
  which, and hides it on the form's submit and on a return from the history. Elements with `data-strength` naming the
  field show its level as it is typed - shorter than its `minlength`, long enough, then four characters longer or of
  three kinds of characters, then both or twice the minimum - a `meter` at once, the words (`strength.short`,
  `.fair`, `.good`, `.strong`) once the typing pauses, said politely; a hint beside the server's own rules.
- The page's answers (`js/answer.js`): every moment only the page can carry out is a cancelable `redz:*` event whose
  `detail.respondWith(promise)` the widget waits for; cancelled without a promise, the moment is all the page's.
- The docs: a page for inline edit, new parts on the pages of form fields and of the combobox, 23 Arabic strings; the
  probes walk each Edit button, each `--reveal`, each strength field and a combobox's “Create …”, and flag a
  `data-strength` without its field and an inline edit form without its value. 21.3 KB and 11.1 KB gzipped.

## 0.4.0 - 2026-11-02

### The ERP's gaps
- `pagination` › `page-item` › `page-link` with `pagination-sm` and `pagination-lg`: the current page
  `aria-current="page"`, a page there is none of `aria-disabled="true"` on a link without `href`; `page-text` for words
  between the links - a list paged by "the next 50" shows previous, next and where you are.
- Dialogs on a window under 576 px fill the screen by themselves - the body scrolls, the footer stays at the bottom -
  and `dialog-sm` and confirmations stay a card; `dialog-fullscreen` fills it on any window.
- Scrollspy (`js/scrollspy.js`): in a nav or list group with `data-scrollspy`, the link to the section in view says so
  in `aria-current="location"`, in the page or in a box that scrolls.
- Tables `table-striped`, `table-striped-columns` - the stripe lies under the hover's light and a row's tone -
  `table-bordered` - the lines between columns and, outside a card, the table's own frame - `table-borderless`,
  `table-group-divider`; card images `card-img`, `card-img-top`, `card-img-bottom`, `card-img-overlay`; `nav-fill`,
  `nav-justified`.
- Utilities: `rounded-top`, `-end`, `-bottom`, `-start`; `z-n1` … `z-3`; `float-start`, `-end`, `-none` with width
  prefixes; `top`, `bottom`, `start`, `end` at 50 and 100; `translate-middle`, `-x`, `-y`, turned round right to left;
  `vw-100`, `min-vw-100`, `vh-100`, `min-vh-100` (heights by `dvh`); `visually-hidden-focusable` for a skip link;
  `stretched-link`. A vocabulary entry's `rtl` gives its rule right to left.
- The map from Bootstrap 5.3 covers them - 69 classes left without a form here, from 214 - and names the
  replacement of what Bootstrap 6 dropped too (`link-underline-*`, `bg-opacity-*`, `text-opacity-*`).
- The docs: a page for pagination, the new parts on the pages of navs, tables, cards, dialogs and utilities, and an
  icon for every page in the menu; the probes flag a scrollspy nav without exactly one current link.

### One stylesheet and one script for a project
- `dist/redz-ui.min.css` - the stylesheets `css/index.css` pulls in, as one file, squeezed: 21.2 KB gzipped, from 34 KB
  as 40 files. `dist/redz-ui.min.js` - the modules of `js/index.js` as one ES module, squeezed and given short local
  names: 9.4 KB gzipped, from 20.4 KB as 14 modules three imports deep. A page links them and `css/icons.css`; the
  sources stay to read, and the passport names the two files (`dist`) with their hashes.
- `tools/min.php` makes them, with no tool from outside: its JS scanner - strings, patterns and a template's text as
  written, white space only where two tokens would fuse - and its verdict come from the REDZ ERP's minifier, with one
  rule more (a `/` after `++` or `--` divides); the joiner, the short names - scoped as esbuild scopes them, never a
  free name or a property - and the CSS pass are new. A selector keeps its descendant space, also before `:`; a value
  the engine keeps as written - a custom property's, or one with `var()` - keeps its spaces. Each pass proves its
  result before it is written: the scanner's tokens and idempotence, the names' declarations one for one, the
  stylesheet's bytes beyond white space.
- The probes run the two files on every page, and in every engine the scripts of `tools/min/` answer the same as
  written and minified, and the stylesheet gives the same rules squeezed as written. The budgets are measured on the
  two files, gzipped; the ceilings stay 24 KB and 25 KB.

### Changed - breaking, in a minor release while the version is 0.x
- The combobox's server search event is `redz:search`, not `redz:filter`: a page listens for `redz:search` on the
  search, as before with `detail.query` and `detail.signal`.

### Fixed
- A table of several `tbody` keeps the line between them: only the table's last row goes without one, and its
  corners round with the card's.

## 0.3.0 - 2026-11-02

### The combobox and the command palette
- `combobox` - the WAI-ARIA combobox with a listbox, one core in three places (`js/combobox.js`):
  - a choice in a form: a `form-select combobox-toggle` button with `role="combobox"` shows the value
    (`combobox-value`, its `data-placeholder` while empty) and opens a `combobox-menu` panel with `combobox-search` ›
    `combobox-search-input` and a `combobox-list`; the value lives in hidden fields named by the list's `data-name`,
    one per value (`name[]` for many), so a form posts it as it is; Down, Up or a letter on the button open it; the
    button names its panel in `aria-controls` only while it is open, and one choice closes the panel a frame after it
    is written, so VoiceOver reads the new value;
  - many values: `aria-multiselectable="true"` keeps the panel open; the button lists the values in the page's
    language while they fit, else the first ones and `+N` (`combobox-more`); a list whose `data-chips` names a
    `combobox-chips` container shows each value there as a chip with its remove button instead;
  - a list in the page: the same search and list without a button or a panel.
- The search folds case and accents (not Thai marks; Arabic vowel marks off), finds what holds every word, the best
  first - the text itself, its start, a word's start (`Intl.Segmenter`), anywhere, then `data-keywords` - within each
  group, and paints the matches by the browser's highlights where it has them; once the typing pauses, the option
  Enter would take is said politely by its label - VoiceOver says nothing of it while keys are typed - and with
  nothing found, the count; no option is active when the panel opens, so a screen reader names the
  search, and the first Down goes to the chosen option; `aria-activedescendant` keeps the focus in the search; Escape
  empties the search, then closes
  the panel or the palette - the library closes it itself, as Safari's search field keeps the key.
- `redz:filter` on the search, with the query and an `AbortSignal`: a page that finds options itself cancels it and
  puts them into the list, which is `aria-busy` meanwhile. A choice fires `input` and `change` on the list; a form's
  reset puts the values back as the page sent them.
- `palette` - the command palette on a `<dialog>`: `palette-search`, `palette-list` of links and buttons with
  `role="option"` (kept out of the Tab order), `palette-footer`; Enter opens a link or presses a button, and the
  palette closes first.
- Shortcuts (`js/shortcuts.js`): a button or link whose `aria-keyshortcuts` names a combination with Control, Meta or
  Alt is pressed by it; where both `Meta+K` and `Control+K` are named, Apple's systems answer Meta and the others
  Control.
- Texts: a text fills its `{names}` from arguments, and a count picks its plural form by the page language's rules
  (`found.one`, `found.few`, … else `found.other`); new keys `remove`, `found.*`.
- `menu-item-content` and `menu-item-description` for a second line in an item; an option's chosen state by
  `aria-selected`, as an item's by `aria-checked`.
- The docs have a page for the combobox and one for the palette and shortcuts; the probes walk every combobox - open,
  Down, Enter, the value written, the panel closed, the focus back - and the palette's search, and flag a combobox
  whose button, active option or chosen values disagree with its list.
- A probe run stopped by a signal still ends its Safari session, so its automation windows close; the Safari they run
  in is the Mac owner's browser too and is never quit.
- The probes' engine `voiceover` hears what VoiceOver says in Safari through the combobox and the palette, each step
  against the words it must hold, and the sheet shows the phrases; CI runs it on macOS 15 and 26 after
  `php tools/probe.php voiceover-setup` lets AppleScript drive VoiceOver (ported from `@guidepup/setup`, MIT).

## 0.2.0 - 2026-11-02

### The missing basics
- `accordion` on the browser's `<details>` and `<summary>`, as Bootstrap 6 has it: `accordion-item` on the
  `<details>`, `accordion-header` on its `<summary>`, `accordion-body`, `accordion-icon` on the chevron,
  `accordion-flush`; the items of one group share a `name`. No script; a section opens with an animation only where
  the browser has `interpolate-size` and the reader allows motion.
- Collapse by the library's command `--toggle`: a button with `commandfor` opens and closes the region it names,
  closed as `hidden="until-found"` so find in page still opens it; the library keeps `aria-expanded` on its buttons
  (`js/toggle.js`).
- `input-group`, `input-group-sm` and `input-group-text`; the borders of the parts meet by themselves, and a menu or a
  hidden element inside the group is left out of the joining.
- `list-group`, `list-group-item`, `-action`, `-flush`, `-numbered`, `-horizontal` and its width-prefixed forms by the
  region (`md:list-group-horizontal`); the current item by `aria-current`, the unavailable by `disabled` or
  `aria-disabled`.
- `progress` on the browser's `<progress>` - tones `progress-{tone}`, `progress-sm`, `progress-lg`, `progress-striped`,
  `progress-animated`, the indeterminate state of a `<progress>` without a value - and `meter` on `<meter>`, coloured
  by `low`, `high` and `optimum`.
- `ratio-1x1`, `ratio-4x3`, `ratio-16x9`, `ratio-21x9` and `ratio-auto` on the element itself.
- The docs have a page for each, the map from Bootstrap 5.3 their rows, and the probes walk every accordion by Enter
  and Space, every `--toggle` button by Enter, and flag a `--toggle` button whose `aria-expanded` is not its region's
  state. The probes' Chrome sends Space as the key `" "`, and their focus helper stands before a `<details>`.
- The app shell keeps what the browser scrolls to - a focused control, a link's target - clear of its sticky header
  (`scroll-padding-block-start` on the page), as WCAG 2.4.11 asks; the probes' Firefox clicked the header where a
  header of an accordion had been scrolled under it.

## 0.1.0 - 2026-10-28

The first release.

### The release
- `redz-ui.json`, the passport, written by `php tools/build.php` and held current on every commit: the version, the
  floor, the stylesheets a bundle joins in their order, the modules of `js/index.js`, every class, custom property,
  command and text key of the library, and the sha256 of every file a release archives, in the SRI form.
- A tag `v*` becomes a release only when the probes are clean in every engine: `redz-ui-<version>.zip` - the passport
  and the files it names - and `checks.zip`, the sheet of the probes, are attached to a draft whose notes come from
  this changelog, and the draft is published. Releases are immutable: GitHub locks the tag and the files and signs an
  attestation of both, which `gh release verify-asset` checks.

### The reference, the docs and the skills
- `docs/`: a page per component and getting started, layout, utilities, tokens, icons and the move from Bootstrap 5.3 -
  examples whose code is printed from the same markup, every state as a named grid, keyboard and accessibility, the
  tokens a component reads, its rows of the Bootstrap map; written by `php tools/docs.php` from `docs/src/` into one
  shell, with `docs/all.html` (every example and state on one page, the probes' fixture), its Arabic twin and those of
  the demo screens (`docs/ar.tsv`), a Markdown twin of every page, `llms.txt` and `llms-full.txt`. The docs' own
  script shows `:hover`, `:focus-visible` and `:focus` by copying those rules under `[data-docs-state]`.
  `reference/widgets.html` folded into the component pages.
- `skills/redz-ui` and `skills/redz-ui-from-bootstrap-5` (Agent Skills): building screens, and moving a project from
  Bootstrap 5.3 with `scripts/scan.sh`, a read-only scan that reports what Bootstrap left and every class REDZ.UI does
  not have. Both carry `assets/map.tsv` - every class of Bootstrap 5.3.8 with its REDZ.UI form, written by
  `php tools/map.php` from Bootstrap's own stylesheet - and `assets/classes.txt`.
- Busy regions: `REDZ.ui.busy()` on a card, its body, a dialog's or a drawer's body or any `region` turns it `inert`
  under an overlay shown after 400 ms and held at least 400 ms (`css/components/busy.css`), says so once politely (the
  page's text `busy`) and brings back a focus it dropped; on or around a live region it is refused in the console.
- Tabs with `data-activation="manual"`: the arrow keys move the focus, Enter or Space selects.
- A check, radio or switch marked `aria-disabled` ignores clicks and Space, as a button so marked.
- Arabic-script text (`lang` ar, fa, ur) takes `--redz-font-arabic`, a stack without Arial - macOS's Arial carries
  Arabic and won over the system face - and headings drop their letter-spacing there, which broke the joins in Safari
  and in Chrome 130-136.
- `pre`, `code`, `kbd` and `samp` run left to right in a right-to-left page; code lost its order there.
- `btn-subtle-*` darken their text on hover, pressed and expanded: the darker fill had taken it below 4.5:1.
- `js/menu-place.js` places a tooltip too, above its button first.
- `empty-state-drop` is the containing block of the hidden file input it holds: placed against the page, the input
  escaped a scrolling parent and widened the page.
- A menu closes on Tab with or without Option - Option-Tab is how Safari's users move through buttons, and it had
  only moved to the next item - and whenever the focus leaves it another way.
- Budgets in `php tools/build.php --check`: the stylesheet at most 24 KB and the scripts 25 KB, gzipped as one file
  each.
- Probes: the docs pages in the current three engines at 1440 and 390; the right-to-left cells on the Arabic twins;
  `aria-busy` on a live region, the docs' state copies against the real pointer and Tab, and the fonts of Arabic text
  in Chrome are checked; text that spills out of its box is named; Safari's Tab is Option-Tab, which reaches buttons
  and links; a cell sets its theme with transitions off; an exception may name a finding; every wait in the page ends
  in a few seconds; CI runs in five parallel parts joined by `php tools/probe.php merge`, with Chrome for Testing 156
  as its current Chrome. The Chrome driver sends a key without a native key code, as Playwright does: Chrome 152-154
  on macOS sent a key the page left alone back into the page, forever. A cell that runs past five minutes stops its
  engine as stalling, the cell and its slowest call named.

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
  or any block with the class `region` - a page without the shell marks its own.
- States are the attributes accessibility needs anyway (`aria-current`, `aria-pressed`, `aria-selected`,
  `aria-checked`, `aria-invalid`, `aria-busy`, `disabled`, `[open]`); dialogs and menus open by the browser's commands
  (`commandfor` + `command`), with `js/commands.js` standing in where the browser has none.
- Icons as CSS masks: `css/icons.css`, one generated rule per icon over its file in `icons/`, under Bootstrap Icons'
  own class names - `<i class="bi bi-NAME" aria-hidden="true"></i>`; no icon font, no JavaScript, no build.
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
  it - an exception that allows nothing any more and a repair the floor has outgrown are findings. It runs on every
  commit and in the new Check workflow; `check FILE…` checks any stylesheet or page.
- `floor.json`: every name the gate knows with its verdict at the floor, for projects that check their own CSS.
- Fixed at the floor, as the gate found: `print-color-adjust` is unprefixed only from Chrome 136, so every use carries
  `-webkit-print-color-adjust` (icons, badges and checkboxes now print in Chrome 130-135); `user-select` needs its
  `-webkit-` form in Safari; `forced-color-adjust: preserve-parent-color` stays for Chrome only inside `@supports` -
  Firefox has no such value and already paints the icons in the forced text color; the tooltip pairs `block-start`
  with `span-inline-end` (the single keyword overflows the viewport in Chrome 129-143 and Firefox 147); `text-break`
  is `overflow-wrap: anywhere`.

### Scripts
- ES modules, one per behavior, behind `js/index.js` - the one module a page loads beside `css/index.css`; it sets
  `REDZ.ui` for calls from code. The library has no words of its own: they come from the caller or from the page's
  island `<script type="application/json" id="redz-ui-text">` (`js/text.js`), a missing one named in the console.
- `js/menu.js`: menus by keyboard (the WAI-ARIA menu button) - the focus on the checked or the first item when a menu
  opens, the arrow keys, Home, End and a letter, Tab and Escape close it, the down and up arrows open it from its button;
  choosing an item closes the menu.
- `js/tabs.js`: tab lists by keyboard (the WAI-ARIA tabs, automatic activation) - the arrow keys, mirrored right to
  left, Home and End select a tab and show its panel; only the selected tab takes Tab.
- `REDZ.ui.toast()` (`js/toast.js`): notices in the live regions of `.toast-container` - `role="status"`, and
  `role="alert"` for danger - present from the first paint and moved into an open modal dialog; success and info leave
  after 8 seconds unless the pointer or the focus rests on them, an error and a notice with an action stay.
  `.toast-container` now holds the two regions instead of being one.
- `REDZ.ui.confirm()` (`js/confirm.js`): a modal alert dialog that answers `true` or `false`, the focus on cancel.
- `REDZ.ui.busy()` (`js/busy.js`): `aria-busy` while a promise runs, a button `aria-disabled` too; a button marked
  `aria-disabled` swallows its clicks.
- `js/dialog.js`: where the browser has no `closedby`, a click on the backdrop of a modal dialog with
  `closedby="any"` closes it. A modal dialog keeps the page's scrollbar gutter while it locks the scroll.
- `js/commands.js`: where the browser has no invoker commands (Chrome before 135, Firefox before 144, Safari before
  26.2), a popover command becomes the browser's own `popovertarget` inside the click - so the browser still reports the
  menu as expanded, returns focus and anchors it - and a dialog command calls `showModal()`, `close()` or
  `requestClose()`; every command first dispatches the `command` event, which a listener may cancel.
- `js/menu-place.js` (the placement guard, apart from the keyboard so that it can go as one file): places an opened menu beside its button wherever the engine cannot anchor it (Firefox before 147,
  Safari before 26, and Chrome 130-132, which make no implicit anchor of a popover's invoker) or puts it out of view or
  away from its button - Chrome 135-136 in a middle-aligned table cell, Safari 26 at the bottom of a page taller than
  the viewport. Such a menu carries `data-placed="script"` while it is open.

### Checks in real engines
- `tools/probe.php`: every page in the installed Chrome, Firefox and Safari, in the floor's Chrome 130, Firefox 132 and
  Safari 18 in the iOS simulator, and in Chrome 136 and Safari 26 in the simulator; at 1440, 1024, 390 and 320 px,
  light left-to-right and dark right-to-left. Overflow, icons without a mask, width prefixes outside a region, cut
  labels and errors; every menu and dialog opened, judged inside the viewport and beside its button; axe-core 4.14.0 at
  WCAG 2.2 AA; forced colors and print where the engine has them. Chrome over its debugging pipe, Firefox over WebDriver
  BiDi, Safari over safaridriver; older engines fetched once into the cache and checked against their checksums.
- The keyboard walk: at 1440 px, in both directions, every menu, modal dialog and tab list is driven by real keys -
  and a dialog with `closedby="any"` by a click outside it - against the WAI-ARIA patterns, and two notices must land
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
  Bootstrap 6 - what we need, where each falls short for us, why not a layer over Bootstrap, what it costs us; every
  number with its source or its method.
