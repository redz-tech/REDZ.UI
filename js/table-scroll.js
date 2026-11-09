// REDZ.UI, a table that scrolls: a table-scroll is a tab stop only while its table is wider than it, so the keyboard can
// scroll it; a table that fits leaves no stop that does nothing. A band's table-group-line reads the width it shows.
const SCROLLERS = '.table-scroll';
const watched = new WeakSet();

/** Makes the scroller a tab stop while it has something to scroll. */
const mark = (scroller) => {
	if (scroller.scrollWidth > scroller.clientWidth + 1) {
		scroller.tabIndex = 0;
	} else {
		scroller.removeAttribute('tabindex');
	}
};

/** Writes the width the scroller shows. */
const measure = (scroller) => scroller.style.setProperty('--redz-table-scroll-size', scroller.clientWidth + 'px');

// The width changes the height of the bands, so it is written outside the observer's own turn.
const sizes = new ResizeObserver((entries) => {
	for (const entry of entries) {
		const scroller = entry.target.closest(SCROLLERS);
		mark(scroller);
		if (entry.target === scroller) {
			requestAnimationFrame(() => measure(scroller));
		}
	}
});

const watch = (scroller) => {
	if (watched.has(scroller)) {
		return;
	}
	watched.add(scroller);
	sizes.observe(scroller);
	for (const table of scroller.querySelectorAll(':scope > table')) {
		sizes.observe(table);
	}
	mark(scroller);
	measure(scroller);
};

document.querySelectorAll(SCROLLERS).forEach(watch);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(SCROLLERS) ? [node] : [...node.querySelectorAll(SCROLLERS)]).forEach(watch);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});
