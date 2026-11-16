// REDZ.UI, a table that scrolls: a table-scroll is a tab stop only while its table is wider than it, so the keyboard can
// scroll it; a table that fits leaves no stop that does nothing. A band's table-group-line reads the width it shows. Where
// columns go on past what shows, data-more names that side, and a bar of the library's own after the scroller holds to
// the bottom of the screen while the table's own scrollbar is below it.
const SCROLLERS = '.table-scroll';
const watched = new WeakSet();
const bars = new WeakMap();
const owners = new WeakMap();
const queued = new WeakSet();
const seen = new WeakSet();
const away = new WeakSet();

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

/** The gap a column of flex or grid items would set before the bar, which the bar takes back. */
const gapBefore = (element) => {
	const style = getComputedStyle(element);
	const column = style.display.endsWith('grid') || (style.display.endsWith('flex') && style.flexDirection.startsWith('column'));
	return column ? parseFloat(style.rowGap) || 0 : 0;
};

/** The scroller's bar, made the first time its table is wider than it: a rail and a thumb a pointer drags. */
const barOf = (scroller) => {
	let bar = bars.get(scroller);
	if (bar !== undefined && bar.isConnected) {
		return bar;
	}
	bar = document.createElement('div');
	bar.className = 'table-scroll-bar';
	bar.setAttribute('aria-hidden', 'true');
	const panel = document.createElement('span');
	const rail = document.createElement('span');
	const thumb = document.createElement('span');
	rail.append(thumb);
	panel.append(rail);
	bar.append(panel);
	thumb.addEventListener('pointerdown', (event) => {
		event.preventDefault();
		thumb.setPointerCapture(event.pointerId);
		const from = event.clientX;
		const start = scroller.scrollLeft;
		const scale = (scroller.scrollWidth - scroller.clientWidth) / Math.max(rail.clientWidth - thumb.offsetWidth, 1);
		const move = (moved) => {
			scroller.scrollLeft = start + (moved.clientX - from) * scale;
		};
		thumb.addEventListener('pointermove', move);
		thumb.addEventListener('lostpointercapture', () => thumb.removeEventListener('pointermove', move), {once: true});
	});
	rail.addEventListener('click', (event) => {
		if (event.target === thumb) {
			return;
		}
		const box = thumb.getBoundingClientRect();
		const toward = event.clientX > box.right ? 1 : (event.clientX < box.left ? -1 : 0);
		const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
		scroller.scrollBy({left: toward * scroller.clientWidth * 0.9, behavior: instant ? 'instant' : 'smooth'});
	});
	scroller.after(bar);
	bars.set(scroller, bar);
	owners.set(bar, scroller);
	rest.observe(bar);
	return bar;
};

/** Shows a bar held away from its rest while enough of its table is in sight. */
const place = (bar) => bar.toggleAttribute('data-stuck', away.has(bar) && seen.has(owners.get(bar)));

/** Names the sides where columns go on past what shows, and sets the bar to match. */
const follow = (scroller) => {
	if (!scroller.isConnected) {
		return;
	}
	const range = scroller.scrollWidth - scroller.clientWidth;
	const done = Math.min(Math.abs(scroller.scrollLeft), Math.max(range, 0));
	const more = [done > 1 ? 'start' : '', range - done > 1 ? 'end' : ''].filter(Boolean).join(' ');
	if (more === '') {
		scroller.removeAttribute('data-more');
	} else if (scroller.getAttribute('data-more') !== more) {
		scroller.setAttribute('data-more', more);
	}
	const bar = more === '' ? bars.get(scroller) : barOf(scroller);
	if (bar === undefined) {
		return;
	}
	bar.hidden = more === '';
	bar.style.setProperty('--redz-table-bar-size', scroller.clientWidth / scroller.scrollWidth * 100 + '%');
	bar.style.setProperty('--redz-table-bar-at', range > 1 ? String(done / range) : '0');
	bar.style.setProperty('--redz-table-bar-gap', gapBefore(scroller.parentElement) + 'px');
};

/** Follows the scroller on the next frame, once however often it is asked. */
const queue = (scroller) => {
	if (queued.has(scroller)) {
		return;
	}
	queued.add(scroller);
	requestAnimationFrame(() => {
		queued.delete(scroller);
		follow(scroller);
	});
};

// A bar at rest under its table is in sight and stays hidden; held to the screen's bottom it stands a pixel past it.
const rest = new IntersectionObserver((entries) => {
	for (const entry of entries) {
		if (entry.isIntersecting) {
			away.delete(entry.target);
		} else {
			away.add(entry.target);
		}
		place(entry.target);
	}
});

// A held bar shows only while more of its table than the bar's own height is in sight, never over what stands above it.
const sight = new IntersectionObserver((entries) => {
	for (const entry of entries) {
		if (entry.isIntersecting) {
			seen.add(entry.target);
		} else {
			seen.delete(entry.target);
		}
		const bar = bars.get(entry.target);
		if (bar !== undefined) {
			place(bar);
		}
	}
}, {rootMargin: '0px 0px -24px 0px'});

// The width changes the height of the bands, so it is written outside the observer's own turn.
const sizes = new ResizeObserver((entries) => {
	for (const entry of entries) {
		const scroller = entry.target.closest(SCROLLERS);
		mark(scroller);
		if (entry.target === scroller) {
			requestAnimationFrame(() => measure(scroller));
		}
		queue(scroller);
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
	scroller.addEventListener('scroll', () => queue(scroller), {passive: true});
	sight.observe(scroller);
	mark(scroller);
	measure(scroller);
	follow(scroller);
};

document.querySelectorAll(SCROLLERS).forEach(watch);

// A page turned to the other side keeps or moves its scroll offsets without telling: follow every scroller again.
new MutationObserver(() => document.querySelectorAll(SCROLLERS).forEach(queue)).observe(document.documentElement, {attributes: true, attributeFilter: ['dir']});

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(SCROLLERS) ? [node] : [...node.querySelectorAll(SCROLLERS)]).forEach(watch);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});
