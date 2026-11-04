// REDZ.UI, a nav that scrolls: a nav or a tab list wider than its box scrolls sideways, and the edge it goes on past fades,
// data-more saying which - start, end or both - as the person scrolls, as its box changes and as the direction turns; when it
// loads, its current or selected item is scrolled into its view, never the page. A nav-overflow's nav folds instead.
const NAVS = '.nav:not(.nav-overflow > .nav)';
const watched = new WeakSet();

/** Says which edges of the nav have more past them. */
const mark = (nav) => {
	const room = nav.scrollWidth - nav.clientWidth;
	const gone = Math.abs(nav.scrollLeft);
	const more = room <= 1 ? [] : [...(gone > 1 ? ['start'] : []), ...(gone < room - 1 ? ['end'] : [])];
	if (more.length === 0) {
		nav.removeAttribute('data-more');
	} else {
		nav.dataset.more = more.join(' ');
	}
};

/** Scrolls the nav, alone, so that its current or selected item is in its view. */
const reveal = (nav) => {
	const item = nav.querySelector('[aria-current]:not([aria-current="false"]), [aria-selected="true"]');
	if (item === null || nav.scrollWidth <= nav.clientWidth) {
		return;
	}
	const box = nav.getBoundingClientRect();
	const it = item.getBoundingClientRect();
	const margin = 24;
	if (it.left < box.left) {
		nav.scrollLeft -= box.left - it.left + margin;
	} else if (it.right > box.right) {
		nav.scrollLeft += it.right - box.right + margin;
	}
};

const sizes = new ResizeObserver((entries) => {
	for (const entry of entries) {
		mark(entry.target);
	}
});

const watch = (nav) => {
	if (watched.has(nav)) {
		return;
	}
	watched.add(nav);
	nav.addEventListener('scroll', () => mark(nav), {passive: true});
	sizes.observe(nav);
	reveal(nav);
	mark(nav);
};

document.querySelectorAll(NAVS).forEach(watch);

new MutationObserver((records) => {
	for (const record of records) {
		if (record.type === 'attributes') {
			document.querySelectorAll(NAVS).forEach(mark);
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(NAVS) ? [node] : [...node.querySelectorAll(NAVS)]).forEach(watch);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['dir']});
