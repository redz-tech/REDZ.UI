# Why REDZ.UI

*As of October 27, 2026: Bootstrap 5.3.8 and Bootstrap 6.0.0-alpha.1. Bootstrap 6 is an alpha, and its authors say
"things can still meaningfully change before beta" — we will revisit this page when it reaches beta.*

[Русская версия](why.ru.md)

## In short
- We build server-rendered products meant to live for many years, with modules written by other people. Over that
  time, the most expensive change is a rename that comes from outside.
- Bootstrap 5.3 was built for the browsers of 2017–2018. Today's platform does natively much of what it ships as
  JavaScript, and its line is coming to an end.
- Bootstrap 6 moves toward the platform in ways we agree with. But it renames the vocabulary everyone has already
  written — 71 % of the v5 class names — without a compatibility layer or a codemod, and costs more in the browser.
- A layer over Bootstrap does not shield a product; only a vocabulary that belongs to the product does.
- So REDZ.UI is that vocabulary: written on the platform of 2026, with no build step anywhere, accessible by
  construction, and checked in three real browser engines.

## 1. What we need
- Server-rendered products: a CMS whose modules come from third parties, and an ERP.
- No build step anywhere — not for us and not for anyone who downloads the library: no Node, no Sass, no bundler. Copy a
  release folder, or link it from a CDN.
- Browsers released since January 2026: Chrome and Edge 135+, Firefox 147+, Safari 26.2+ on macOS and iOS.
- WCAG 2.2 AA in the light and the dark theme; left-to-right and right-to-left from one stylesheet; the system theme
  followed without JavaScript.
- A vocabulary that changes only when we change it.

## 2. Why Bootstrap 5.3 no longer fits
Bootstrap 5.3 has served the web well. It no longer fits us — and, we think, many projects started today.

**It was built for the browsers of 2017–2018.** Its [browser list](https://github.com/twbs/bootstrap/blob/v5.3.8/.browserslistrc)
reaches back to Chrome 60, Firefox 60 and Safari 12. So it cannot rely on cascade layers, `:has()`, `light-dark()`,
OKLCH colors, logical properties, `<dialog>`, `popover`, anchor positioning or invoker commands — and it ships
JavaScript for what the platform now does by itself: Popper to place menus and tooltips, and a modal with its own focus
trap, scrollbar handling and backdrop.

**No cascade layers.** Its CSS sits outside any layer, so every override is a contest of specificity and source order;
our own fixes, written in layers, would lose to it.

**Right-to-left is a second compiled stylesheet** (`bootstrap.rtl.css`), not one stylesheet written in logical
properties.

**The system theme needs a script.** Color modes come by `data-bs-theme`; following the operating system takes a
JavaScript snippet, and theming beyond the custom properties means recompiling Sass.

**Contrast.** Measured from its own CSS: the border of a field is 1.30:1 against the page in the light theme and 1.89:1
in the dark one; the focus ring, a 25 % blue shadow, is 1.41:1 and 1.29:1.
[WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) asks for 3:1 for the boundaries of
controls and for focus indicators.

**Cost in the engine.** It declares 989 custom properties inside 287 component rules — 29 on every colored button. Our
bench (see [the method](#8-sources-and-method)) measured that pattern — 300 custom properties declared on components
instead of on `:root` — at ×10.9 the style recalculation of a list screen, ×2.7 its first paint and ×9.8 a theme switch.

**Icon fonts break.** Bootstrap Icons, Bootstrap's companion set, are commonly used as a web font, and web fonts are not
shown to everyone: Apple's Lockdown Mode, for one, says that ["web fonts might not be displayed"](https://support.apple.com/en-us/105120),
and content blockers can switch them off.

**The line is ending.** 5.3.8 (August 2025) is the latest release, and the Bootstrap 6 announcement says
["v5.4.0 will be released as soon as we can before we share an end of life date for Bootstrap 5"](https://blog.getbootstrap.com/2026/10/08/bootstrap-6-alpha/).
Staying on 5.3 means moving later anyway — to Bootstrap 6.

## 3. What Bootstrap 6 does right — and we take
Credit where it is due. Bootstrap 6 raises its browser floor (Chrome and Edge 130, Firefox 132, Safari 18). It puts its
CSS into cascade layers and writes logical properties — one stylesheet for both directions, about 1,060 logical
declarations to 30 physical ones by our count. It builds dialogs on `<dialog>` and accordions on `<details>` with fewer
wrappers, and puts the floating label before its control. It follows the system theme by default with `light-dark()`,
defines its colors in OKLCH, keeps shadows for floating layers and drops `system-ui` from its font stack for good
reasons ([#42780](https://github.com/twbs/bootstrap/pull/42780)). It moves things only when the user allows motion.

We agree with that direction. REDZ.UI takes the same ideas, with credit wherever code is ported.

## 4. Where Bootstrap 6 goes where we cannot follow

### a. It renames the vocabulary everyone has already written
The announcement is candid: ["Yes, this is a direct copy of how Tailwind does responsive"](https://blog.getbootstrap.com/2026/10/08/bootstrap-6-alpha/)
— `.d-md-none` becomes `.md:d-none`; colors move to `.theme-*` and `.fg-*`, and the stylesheet grows from 2,025 class
names to 3,113. The prefix itself reads well, and REDZ.UI uses it too. The cost is the rename: spacing, breakpoints and
colors already live in the markup of every screen written for v5, so renaming them rewrites every screen. For a product
whose screens are partly written by others, that is the most expensive kind of change there is — a vocabulary must stay
put once people have written it.

### b. Moving without a safety net
- 1,447 of the 2,025 class names of 5.3.8 — 71 % — do not exist in 6.0.0-alpha.1 (our count of both minified
  stylesheets).
- Some of the names that remain changed their meaning quietly: `.p-3` was `1rem` and is now `0.5rem`; `.rounded` went
  from 0.375 to 0.5 rem; the breakpoints moved (lg from 992 to 1024 px, xl from 1200 to 1280 px, and xxl became 2xl at
  1536 px). A search finds names, not meanings.
- There is no compatibility stylesheet, shim or codemod. The help offered is
  [a 652-line instruction file for coding agents](https://github.com/twbs/bootstrap/blob/main/skills/bootstrap-v5-v6-migration/SKILL.md).
- On our bench, one list screen needs 15 of its 22 places of Bootstrap markup changed — 60 changed classes and one
  change of structure. That is about 600 edits for 40 similar screens.

### c. It costs more in the browser
Bootstrap 6 alpha declares 1,400 custom properties inside component rules (5.3.8: 989), and its CSS holds 55
`[class*=…]` selectors and 148 `:has(`. The engines are tuned for many custom properties on the root and few below it,
a substring attribute selector is tested against every element that has a class, and `:has()` makes the engine walk up
the tree on every relevant change. The same list screen on our bench:

| | Bootstrap 5.3.8 | Bootstrap 6.0.0-alpha.1 |
|---|---|---|
| style recalculation, 200 rows | 25 ms | ×4.4 |
| style recalculation, 1,000 rows | 113 ms | ×5.7 |
| first paint, 200 rows | 148 ms | +54 % |
| switching the theme, 200 rows | 44 ms | ×6.9 |
| changing a class on `<html>`, CPU slowed 4× | 0.1 ms | 780 ms |

The issue tracker shows the same kind of problem: [#43003](https://github.com/twbs/bootstrap/issues/43003), open since
October 9 — ":has() control-state rules cause multi-second style recalculation on pages with many form controls". To be
fair, a maintainer measured under 15 ms for 18,000 elements in another setup; the reporter then measured 141 ms on 5.3.8
against 273 ms on the alpha. It is an alpha — but these are its foundations, not a detail.

### d. Weight and tools
The minified CSS grows from 30.9 to 51.6 KB gzip, the JavaScript bundle from 23.7 to 60.0 KB gzip, with Floating UI and
a date picker inside. The JavaScript is published as ES modules only, themes go through Sass modules, and the skill
files Bootstrap ships target npm, Vite, Parcel and Webpack. It is a world of build tools. We need "copy the folder and
it works".

### e. Its floor still needs JavaScript where the platform suffices
Anchor positioning is not in Bootstrap 6's floor — it arrived in Firefox 147 and Safari 26 — so its menus and tooltips
are placed by Floating UI. Our floor has it: a REDZ.UI menu is placed by CSS alone.

### f. Styling that works against accessibility
The focus ring is 3 px of the accent mixed half and half with the page — about 1.85:1 against white by our computation
from its CSS, under the 3:1 that WCAG 2.2 asks for. Backdrops are blurred, some menus are translucent, and the checkbox
tick springs past its mark. Text over a blurred, moving background has a contrast nobody can guarantee, and motion for
its own sake does not help a person working through a list. We keep solid surfaces, a 2 px solid focus outline at 3:1,
and motion that only shows where things go.

### g. Cross-browser behavior is checked by hand
Bootstrap's JavaScript tests run in Chromium only ([`js.yml`](https://github.com/twbs/bootstrap/blob/main/.github/workflows/js.yml)).
The BrowserStack integration was removed in July 2026 —
["Zero runs since ~October 2024, and its matrix pinned Chrome 60 / Firefox 60 / iOS 12"](https://github.com/twbs/bootstrap/pull/42764)
— and Safari and Firefox are checked by people. "A framework is tested in every browser" is not something we can count
on.

## 5. Why not a layer over Bootstrap
A layer between our screens and the kit was our first idea, and we measured it.
- A layer is free in the browser only when it emits the kit's markup byte for byte. Then the kit's speed, its browser
  floor and its behavior pass straight through, and the adapter is rewritten at every major version of the kit.
- Practice says the same. GitLab wrapped BootstrapVue and has been removing it since September 2024:
  ["Previous attempts to build a compat mode have proven as time-consuming as migrating to our own components"](https://handbook.gitlab.com/handbook/company/working-groups/task-groups/bootstrap-vue-removal/).
  Moodle's renderers did not shield it either, because its templates speak Bootstrap: the Bootstrap 5 upgrade
  ([MDL-75669](https://tracker.moodle.org/browse/MDL-75669)) took two and a half years, one commit touched 169 files,
  and 102 regression reports are linked to the issue.
- What held was a product's own API. TYPO3 moved its modal to the native `<dialog>`
  ([Breaking #107443](https://docs.typo3.org/c/typo3/cms-core/main/en-us/Changelog/14.0/Breaking-107443-MigrateModalComponentFromBootstrapToNativeDialog.html)):
  extensions that used TYPO3's own Modal API kept working, code bound to Bootstrap's `bs.modal` events did not — and
  TYPO3 had told extension authors two major versions earlier that those events were not part of its API
  ([Breaking #98288](https://docs.typo3.org/c/typo3/cms-core/main/en-us/Changelog/12.0/Breaking-98288-UpdatedBackendModalAPI.html)).

So the only layer that protects is a vocabulary the product owns. REDZ.UI is that vocabulary; Bootstrap 5 and 6 are a
quarry of ideas, never a dependency.

## 6. What REDZ.UI is instead
REDZ.UI is in design: its look is approved as a prototype, and nothing is released yet. It is built to be:
- **A vocabulary people already know, on the platform of 2026:** Bootstrap 5's names for components and utilities,
  Bootstrap 6's where it moved onto the platform as we do (`dialog`, `drawer`, `menu`, `check`, `switch`), and one
  reading rule — a component and its variant as one class (`btn btn-primary btn-sm`), every condition as a prefix
  (`md:`, `print:`), the number is the value (`p-16` is 16 px). Under it: `<dialog>`, `popover`, anchor positioning,
  invoker commands, `:has()`, cascade layers, `light-dark()`, OKLCH, logical properties.
- **No build step anywhere:** plain CSS files, one small classic script that works by delegation, and icons as CSS masks
  over their SVG files. Copy a release, or link it from a CDN — jsDelivr and GitHub Pages serve its CSS and SVG with
  CORS headers (checked).
- **Rules measured, not guessed:** tokens on `:root`; a component declares few custom properties, and only on its root;
  no substring attribute selectors; a state is an ARIA attribute on the component's class; `:has()` is never anchored on
  the root of the page; no wrapper elements; a budget for style recalculation.
- **Accessible by construction:** text at 4.5:1, field borders and the focus ring at 3:1, in both themes; forced-colors
  mode and print are part of the checks.
- **One stylesheet** for left-to-right and right-to-left, and the system theme without JavaScript.
- **Trust by machinery:** a gate checks every property, value and selector against MDN's compatibility data for the
  floor, and the components are checked in real Chrome, Safari and Firefox — the prototype screens already were, in
  both themes and both directions.
- **Icons, measured:** 1,000 icons as masks render in 1.6 ms in Chrome and 4 ms in Safari and Firefox — against
  12–16 ms for an external SVG sprite; there is no font to block, and they stay visible in forced colors and in print.
- **Moving from Bootstrap 5 is short:** most component and utility names stay, and Bootstrap Icons keep their own
  class names (`bi bi-pencil`). What changes — the spacing numbers, grids set by their parent, states as HTML
  attributes, dialogs and menus opened by the browser's commands — comes with a machine-readable map, a public
  migration skill and a scan for leftovers, and the vocabulary follows Semantic Versioning.

## 7. What it costs us
- We maintain it ourselves; there is no crowd reporting its bugs for us.
- The floor leaves older devices out — for example iPhone XS and XR, and Safari on macOS 13 and older (Chrome and
  Firefox still run there).
- New platform features still have engine bugs — in WebKit, anchor positioning
  ([295006](https://bugs.webkit.org/show_bug.cgi?id=295006), [310959](https://bugs.webkit.org/show_bug.cgi?id=310959))
  and VoiceOver with `<dialog>` ([302351](https://bugs.webkit.org/show_bug.cgi?id=302351)). Our checks run in the real
  engines to catch such bugs.
- Today it is a prototype, and nothing is released yet.

## 8. Sources and method
**Bootstrap:** [the Bootstrap 6 alpha announcement](https://blog.getbootstrap.com/2026/10/08/bootstrap-6-alpha/),
[the v6 migration guide](https://getbootstrap.com/docs/6.0/guides/migration), the browser lists of
[5.3.8](https://github.com/twbs/bootstrap/blob/v5.3.8/.browserslistrc) and
[main](https://github.com/twbs/bootstrap/blob/main/.browserslistrc), the minified stylesheets and bundles of both
versions from npm, [the migration skill](https://github.com/twbs/bootstrap/blob/main/skills/bootstrap-v5-v6-migration/SKILL.md),
[the JavaScript test workflow](https://github.com/twbs/bootstrap/blob/main/.github/workflows/js.yml),
[#42764](https://github.com/twbs/bootstrap/pull/42764), [#42780](https://github.com/twbs/bootstrap/pull/42780) and
[#43003](https://github.com/twbs/bootstrap/issues/43003).

**Others:** [WCAG 2.2, non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
[Apple Lockdown Mode](https://support.apple.com/en-us/105120),
[GitLab's BootstrapVue removal group](https://handbook.gitlab.com/handbook/company/working-groups/task-groups/bootstrap-vue-removal/),
[Moodle MDL-75669](https://tracker.moodle.org/browse/MDL-75669), TYPO3
[#107443](https://docs.typo3.org/c/typo3/cms-core/main/en-us/Changelog/14.0/Breaking-107443-MigrateModalComponentFromBootstrapToNativeDialog.html)
and [#98288](https://docs.typo3.org/c/typo3/cms-core/main/en-us/Changelog/12.0/Breaking-98288-UpdatedBackendModalAPI.html),
[MDN browser-compat-data](https://github.com/mdn/browser-compat-data) and
[web-features](https://github.com/web-platform-dx/web-features).

**Our counts:** class names, custom properties and selectors counted in the minified stylesheets of both versions;
contrast computed from the colors declared in their CSS with the WCAG formula, OKLCH converted to sRGB.

**Our bench (October 2026):** a synthetic list screen — a filter bar, a table and pagination; each row holds a checkbox,
a name and an email, a company, a status badge, an amount, a group of two buttons and a menu of two items; 200 rows are
about 4,200 DOM nodes, 1,000 rows about 21,000. Headless Chromium 141 through Playwright 1.56 in a Linux container;
Bootstrap 5.3.8 and 6.0.0-alpha.1 from npm; a fresh browser for every run, the variants alternated, medians of 7 to 11
runs. A copy of the reference screen differs from it by ±4 % (±15 % with the CPU slowed 4×), so smaller differences
count as none. Limits: one engine and a synthetic screen; absolute milliseconds depend on the hardware, so compare the
ratios. The bench scripts are not published.

**Our icon measurements:** Chrome 156, Safari 27.2 and Firefox 158 on macOS; 1,000 icons of 40 names inserted at once;
medians of 10 runs.
