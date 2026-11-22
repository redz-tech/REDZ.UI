// REDZ.UI, breadcrumb: a .breadcrumb with data-fold keeps its trail on one line. Where it does not fit, the items
// between the first and the last hide from the start - the last one's parent last of all - and come back, in their
// order, as the items of a menu behind a button in the trail's second place, named by the page's text
// "breadcrumb.more"; a menu item clicks the item it stands for, links and buttons alike, so the page's own handlers
// run. Where even the first, that button and the last do not fit, the trail is tight: its items shrink with an
// ellipsis, the last one least, and a cut item's words show in its title. It looks again when the trail changes size,
// its items or their words change, or the fonts load; a trail added to the page later is taken up as it comes.
import {itemOf} from './nav-overflow.js';
import {text} from './text.js';

const folds = new WeakMap();
const titled = new WeakSet();
const hid = new WeakSet();
const pending = new Set();
let frame = 0;
let made = 0;

/** The trail's fold: an item holding the button and its menu, made once. */
const foldOf = (trail) => {
	if (!folds.has(trail)) {
		const menu = Object.assign(document.createElement('div'), {className: 'menu', id: 'redz-breadcrumb-' + ++made});
		menu.popover = 'auto';
		menu.setAttribute('role', 'menu');
		menu.setAttribute('aria-label', text('breadcrumb.more'));
		const button = Object.assign(document.createElement('button'), {type: 'button', className: 'breadcrumb-more'});
		button.setAttribute('commandfor', menu.id);
		button.setAttribute('command', 'toggle-popover');
		button.setAttribute('aria-haspopup', 'menu');
		button.setAttribute('aria-label', text('breadcrumb.more'));
		button.append(Object.assign(document.createElement('i'), {className: 'bi bi-three-dots'}));
		button.firstChild.setAttribute('aria-hidden', 'true');
		const fold = Object.assign(document.createElement('li'), {className: 'breadcrumb-item breadcrumb-fold'});
		fold.append(button, menu);
		folds.set(trail, fold);
	}
	return folds.get(trail);
};

/** Folds the trail's middle from its start until the trail fits, tight where it still does not. */
const update = (trail) => {
	const fold = foldOf(trail);
	const items = [...trail.children].filter((item) => item !== fold);
	const fits = () => trail.scrollWidth - trail.clientWidth <= 1;
	const folded = [];
	trail.removeAttribute('data-tight');
	fold.hidden = true;
	items.filter((item) => hid.has(item)).forEach((item) => {
		item.hidden = false;
		hid.delete(item);
	});
	if (items.length > 2 && items[0].nextElementSibling !== fold) {
		items[0].after(fold);
	}
	if (!fits() && items.length > 2) {
		fold.hidden = false;
		for (const item of items.slice(1, -1).filter((one) => !one.hidden)) {
			if (fits()) {
				break;
			}
			item.hidden = true;
			hid.add(item);
			folded.push(item);
		}
	}
	trail.toggleAttribute('data-tight', !fits());
	fold.lastChild.replaceChildren(...folded.map((item) => item.querySelector('a, button')).filter(Boolean).map((control) => itemOf(control)));
	for (const item of items) {
		const cut = item.scrollWidth - item.clientWidth > 1;
		if (cut && !item.hasAttribute('title')) {
			item.title = item.textContent.trim();
			titled.add(item);
		} else if (!cut && titled.has(item)) {
			item.removeAttribute('title');
			titled.delete(item);
		}
	}
};

/** Folds the trail again in the next frame, before it is painted. */
const schedule = (trail) => {
	pending.add(trail);
	frame ||= requestAnimationFrame(() => {
		frame = 0;
		pending.forEach(update);
		pending.clear();
	});
};

const sized = new ResizeObserver((entries) => entries.forEach((entry) => schedule(entry.target)));

/** Takes up the trail once: its first fold, and the watch on its size and on its items. */
const setUp = (trail) => {
	if (folds.has(trail)) {
		return;
	}
	update(trail);
	sized.observe(trail);
	new MutationObserver((records) => {
		if (records.some((record) => !folds.get(trail).contains(record.target))) {
			schedule(trail);
		}
	}).observe(trail, {childList: true, subtree: true, characterData: true});
};

document.querySelectorAll('.breadcrumb[data-fold]').forEach(setUp);

new MutationObserver((records) => {
	for (const node of records.flatMap((record) => [...record.addedNodes])) {
		if (node instanceof Element) {
			[node, ...node.querySelectorAll('.breadcrumb[data-fold]')].filter((one) => one.matches('.breadcrumb[data-fold]')).forEach(setUp);
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});

document.fonts?.ready.then(() => document.querySelectorAll('.breadcrumb[data-fold]').forEach(schedule));
