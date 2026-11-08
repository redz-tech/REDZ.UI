// REDZ.UI, following: an element that scrolls with data-follow - a pre.log, a thread's box, any list - keeps its end in
// view while its contents come in or grow, as a terminal does, unless the reader scrolled away to read; scrolled back,
// it follows again. With data-follow="current" it keeps its child with aria-current in view instead - at the nearest
// edge, with the room of one step beside it - and its end while it has none; the list alone scrolls, never the page. A
// button with command="--follow" and aria-controls naming it shows while the reader is away and something new came
// in; pressed, it brings the end back, follows again and hides. Boxes on the page, put in later or given data-follow
// later are followed the same.
const FOLLOWED = '[data-follow]';
const following = new WeakMap();
const sized = new ResizeObserver((entries) => new Set(entries.map((entry) => entry.target.closest(FOLLOWED))).forEach((box) => box !== null && keep(box)));

/** The box's child the reader is told is current, or null. */
const currentOf = (box) => box.dataset.follow === 'current' ? box.querySelector('[aria-current]:not([aria-current="false"])') : null;

/** Whether the box shows its end, within a line's height, or its current child whole. */
const inPlace = (box) => {
	const current = currentOf(box);
	if (current === null) {
		return box.scrollHeight - box.scrollTop - box.clientHeight < 8;
	}
	const [outer, inner] = [box.getBoundingClientRect(), current.getBoundingClientRect()];
	return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
};

/** The --follow buttons of the box. */
const buttonsOf = (box) => box.id === '' ? [] : [...document.querySelectorAll('button[command="--follow"][aria-controls="' + CSS.escape(box.id) + '"]')];

/** Scrolls the box to its end, or its current child to the nearest edge with a step's room beside it. */
const bring = (box) => {
	const current = currentOf(box);
	if (current === null) {
		box.scrollTop = box.scrollHeight;
		return;
	}
	const [outer, inner] = [box.getBoundingClientRect(), current.getBoundingClientRect()];
	const before = current.previousElementSibling?.getBoundingClientRect().height ?? 0;
	const after = current.nextElementSibling?.getBoundingClientRect().height ?? 0;
	if (inner.top < outer.top + before) {
		box.scrollTop -= outer.top + before - inner.top;
	} else if (inner.bottom > outer.bottom - after) {
		box.scrollTop += Math.min(inner.bottom - outer.bottom + after, inner.top - outer.top - before);
	}
};

/** Keeps the box in place while it follows; answers whether it did. */
const keep = (box) => {
	if (following.get(box) && box.hasAttribute('data-follow')) {
		bring(box);
		return true;
	}
	return false;
};

/** Starts following a box once. */
const watch = (box) => {
	if (following.has(box)) {
		keep(box);
		return;
	}
	following.set(box, true);
	box.addEventListener('scroll', () => {
		following.set(box, inPlace(box));
		if (following.get(box)) {
			buttonsOf(box).forEach((button) => {
				button.hidden = true;
			});
		}
	}, {passive: true});
	new MutationObserver((records) => {
		[...records.flatMap((record) => [...record.addedNodes])].forEach((node) => node instanceof Element && sized.observe(node));
		const fresh = records.some((record) => [...record.addedNodes].some((node) => !(node instanceof Element) || !node.matches('.follow-dock')));
		if (!keep(box) && fresh) {
			buttonsOf(box).forEach((button) => {
				button.hidden = false;
			});
		}
	}).observe(box, {childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-current']});
	sized.observe(box);
	[...box.children].forEach((child) => sized.observe(child));
	keep(box);
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--follow"][aria-controls]') : null;
	const box = button === null ? null : document.getElementById(button.getAttribute('aria-controls'));
	if (box === null || !box.matches(FOLLOWED)) {
		return;
	}
	following.set(box, true);
	bring(box);
	buttonsOf(box).forEach((one) => {
		one.hidden = true;
	});
	if (box.hasAttribute('tabindex')) {
		box.focus({preventScroll: true});
	}
});

document.querySelectorAll(FOLLOWED).forEach(watch);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.type === 'attributes' ? [record.target] : record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(FOLLOWED) ? [node] : [...node.querySelectorAll(FOLLOWED)]).forEach(watch);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-follow']});
