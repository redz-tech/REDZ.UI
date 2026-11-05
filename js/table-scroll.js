// REDZ.UI, a table that scrolls: a table-scroll is a tab stop only while its table is wider than it, so the keyboard can
// scroll it; a table that fits leaves no stop that does nothing.
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

const sizes = new ResizeObserver((entries) => {
	for (const entry of entries) {
		mark(entry.target.closest(SCROLLERS));
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
