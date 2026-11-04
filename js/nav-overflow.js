// REDZ.UI, nav overflow (the Priority+ pattern): a .nav-overflow wrapper keeps its .nav on one line. The links that do
// not fit hide from the end and come back, in their order, as the items of a menu behind a "More" button after the nav;
// the link the person is on (aria-current, or aria-selected="true" for a tab, or a current item in the menu it opens)
// and a link with nav-overflow-keep stay in the row; a link that opens a menu comes back as a group of that menu's
// items, named by the link's words. It measures the nav against the room the wrapper leaves it, as hiding links changes
// the nav's own width, and looks again when the wrapper changes size, the fonts load, or the nav's links or their
// states change. The button and the menu may be the page's own (a .nav-overflow-toggle and a .nav-overflow-menu in the
// wrapper); else the button says the page's text "more". A wrapper added to the page later is taken up as it comes.
import {text} from './text.js';

const state = new WeakMap();
let made = 0;
let frame = 0;
const pending = new Set();

/** The nav's links: its children with the nav-link class that the page itself has not hidden. */
const linksOf = (nav) => [...nav.children].filter((link) => link.classList.contains('nav-link') && (!link.hidden || 'overflow' in link.dataset));

/** The menu the link opens, when it opens one: the popover of role menu its commandfor names. */
const menuOf = (link) => {
	const menu = link.hasAttribute('commandfor') ? document.getElementById(link.getAttribute('commandfor')) : null;
	return menu !== null && menu.getAttribute('role') === 'menu' ? menu : null;
};

/** Whether the person is on the link, or on a page of the menu it opens. */
const isCurrent = (link) => (link.hasAttribute('aria-current') && link.getAttribute('aria-current') !== 'false') || link.getAttribute('aria-selected') === 'true' || (menuOf(link)?.querySelector('[aria-current]:not([aria-current="false"])') ?? null) !== null;

/** Whether the nav's links fit the room it has, to a pixel. */
const fits = (nav) => nav.scrollWidth - nav.clientWidth <= 1;

/** The menu item that stands for a hidden link: the link's words and icons and its address. A plain click on it closes
 *  the menu and clicks the link itself, so the page's own handlers run; a tab chosen so comes back into the row with
 *  the focus. A click with a modifier key opens the address as the browser does. */
const itemOf = (link, wrapper) => {
	const anchor = link instanceof HTMLAnchorElement && link.hasAttribute('href');
	const item = document.createElement(anchor ? 'a' : 'button');
	item.className = 'menu-item';
	item.setAttribute('role', 'menuitem');
	item.append(...[...link.childNodes].map((node) => node.cloneNode(true)));
	for (const name of anchor ? ['href', 'target', 'rel', 'hreflang', 'download', 'aria-disabled'] : ['aria-disabled']) {
		if (link.hasAttribute(name)) {
			item.setAttribute(name, link.getAttribute(name));
		}
	}
	if (!anchor) {
		item.type = 'button';
	}
	if (link.disabled) {
		item.setAttribute('aria-disabled', 'true');
	}
	item.addEventListener('click', (event) => {
		if (item.getAttribute('aria-disabled') === 'true' || (anchor && (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey))) {
			return;
		}
		event.preventDefault();
		item.closest('[role="menu"]')?.hidePopover();
		link.click();
		update(wrapper);
		if (link.getClientRects().length > 0) {
			link.focus();
		}
	});
	return item;
};

/** The group that stands for a hidden link that opens a menu: the link's words over that menu's items. */
const groupOf = (link, menu, wrapper) => {
	const group = document.createElement('div');
	const header = Object.assign(document.createElement('div'), {className: 'menu-header', id: 'redz-nav-overflow-group-' + (++made)});
	header.textContent = link.getAttribute('aria-label') || link.textContent.replace(/\s+/g, ' ').trim();
	header.setAttribute('role', 'presentation');
	group.setAttribute('role', 'group');
	group.setAttribute('aria-labelledby', header.id);
	group.append(header, ...[...menu.querySelectorAll('[role="menuitem"]')].map((item) => itemOf(item, wrapper)));
	return group;
};

/** The menu's children for the hidden links in their order, a divider on each side of a group. */
const entriesOf = (moved, wrapper) => {
	const entries = moved.map((link) => {
		const menu = menuOf(link);
		return menu === null ? itemOf(link, wrapper) : groupOf(link, menu, wrapper);
	});
	return entries.flatMap((entry, i) => i > 0 && [entry, entries[i - 1]].some((one) => one.getAttribute('role') === 'group') ? [Object.assign(document.createElement('hr'), {className: 'menu-divider'}), entry] : [entry]);
};

/** The wrapper's button and menu: the page's own, else made once after the nav. */
const partsOf = (wrapper) => {
	let toggle = wrapper.querySelector(':scope > .nav-overflow-toggle');
	let menu = wrapper.querySelector(':scope > .nav-overflow-menu');
	if (menu === null) {
		menu = Object.assign(document.createElement('div'), {className: 'menu nav-overflow-menu', id: 'redz-nav-overflow-' + (++made)});
		menu.popover = 'auto';
		menu.setAttribute('role', 'menu');
		wrapper.append(menu);
	}
	if (toggle === null) {
		toggle = Object.assign(document.createElement('button'), {type: 'button', className: 'nav-link nav-overflow-toggle', id: menu.id + '-toggle'});
		toggle.setAttribute('commandfor', menu.id);
		toggle.setAttribute('command', 'toggle-popover');
		toggle.setAttribute('aria-haspopup', 'menu');
		toggle.append(text('more'), Object.assign(document.createElement('i'), {className: 'bi bi-chevron-down'}));
		toggle.lastChild.setAttribute('aria-hidden', 'true');
		menu.before(toggle);
	}
	if (!menu.hasAttribute('aria-label') && !menu.hasAttribute('aria-labelledby') && toggle.id !== '') {
		menu.setAttribute('aria-labelledby', toggle.id);
	}
	return {toggle, menu};
};

/** Shows every link, then hides from the end the ones that may go until the rest fit; the menu holds the hidden. */
const update = (wrapper) => {
	const nav = wrapper.querySelector(':scope > .nav');
	const own = state.get(wrapper);
	if (nav === null || own === undefined) {
		return;
	}
	const links = linksOf(nav);
	for (const link of links) {
		link.hidden = false;
		delete link.dataset.overflow;
	}
	own.toggle.hidden = true;
	const moved = [];
	if (!fits(nav)) {
		own.toggle.hidden = false;
		for (const link of links.filter((one) => !one.classList.contains('nav-overflow-keep') && !isCurrent(one)).reverse()) {
			if (fits(nav)) {
				break;
			}
			link.hidden = true;
			link.dataset.overflow = '';
			moved.unshift(link);
			if (menuOf(link)?.matches(':popover-open')) {
				menuOf(link).hidePopover();
			}
		}
		own.toggle.hidden = moved.length === 0;
	}
	if (own.dirty || moved.length !== own.moved.length || moved.some((link, i) => link !== own.moved[i])) {
		if (moved.length === 0 && own.menu.matches(':popover-open')) {
			own.menu.hidePopover();
		}
		own.menu.replaceChildren(...entriesOf(moved, wrapper));
	}
	own.moved = moved;
	own.dirty = false;
};

/** Runs the updates asked for in the next frame, before it is painted. */
const schedule = (wrapper, dirty = false) => {
	const own = state.get(wrapper);
	if (own !== undefined) {
		own.dirty ||= dirty;
		pending.add(wrapper);
	}
	if (frame === 0) {
		frame = requestAnimationFrame(() => {
			frame = 0;
			for (const one of pending) {
				update(one);
			}
			pending.clear();
		});
	}
};

const sized = new ResizeObserver((entries) => {
	for (const entry of entries) {
		schedule(entry.target);
	}
});

/** Takes up the wrapper once: its button and menu, its first fold, and the watch on its size and its nav. */
const setUp = (wrapper) => {
	const nav = wrapper.querySelector(':scope > .nav');
	if (state.has(wrapper) || nav === null) {
		return;
	}
	state.set(wrapper, {...partsOf(wrapper), moved: [], dirty: true});
	update(wrapper);
	sized.observe(wrapper);
	new MutationObserver(() => schedule(wrapper, true)).observe(nav, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected', 'aria-disabled', 'disabled', 'href']});
};

document.querySelectorAll('.nav-overflow').forEach(setUp);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				if (node.matches('.nav-overflow')) {
					setUp(node);
				}
				node.querySelectorAll('.nav-overflow').forEach(setUp);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});

document.fonts?.ready.then(() => {
	for (const wrapper of document.querySelectorAll('.nav-overflow')) {
		schedule(wrapper);
	}
});
