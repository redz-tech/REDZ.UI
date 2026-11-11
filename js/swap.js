// REDZ.UI, swaps: REDZ.ui.swap(region, source, {signal}) puts new content into a region the page draws again - a list
// it polls, a card after a change - and keeps what the person was doing there. source is a DocumentFragment, a
// Document, an Element or a TrustedHTML, never a string of markup: when it holds an element with the region's id, that
// element's children are taken, else all of it; its scripts are dropped; its nodes are taken, not copied. Elements with
// an id are parts: a part whose new copy equals the one the last swap brought - or the live part itself, the first time
// - stays as it is, moved alive where the browser can (moveBefore), else moved as any node is. The swap waits until what
// it takes out or moves is calm - no menu, popover or dialog open in it or opened from it, no tracked form with changes
// (js/track.js), no words being composed - and tries again as those end, never on a timer; a newer swap of the region
// overtakes a waiting one, which answers false, as an aborted signal does; a swap done answers true. What the person
// set is carried to the new parts by id: a filter's choice and a search's words (js/filter.js), a table's sort
// (js/sort.js), the checks of a selection (js/select.js), the selected tab, an open details, a --toggle region or tree
// group, the scroll of the region, of its scroll boxes - by id, else by place among its .table-scroll - and of the
// window, and the focus with a field's words and caret: by id, else the button with the same commandfor, or the same
// aria-controls and command, else a field of the same name and value, else the first control of its nearest part,
// else the region. A field of a tracked form is never written. The region then fires redz:swap.
// REDZ.ui.swap(source, {signal}) puts each top element of the source with an id into its namesake on the page.
import {filterRegion} from './filter.js';
import {sort} from './sort.js';
import {selection} from './select.js';
import {selectTab} from './tabs.js';
import {openerOf} from './commands.js';
import {track} from './track.js';

const CONTROLS = 'a[href], button, input, select, textarea, summary, [tabindex]';
const TOGGLES = 'button[command="--toggle"][aria-controls]';
// The copy of each live part the last swap brought.
const copies = new WeakMap();
// The swap each region waits with: its next try and its answer.
const waiting = new Map();
let composing = null;

/** The elements with an id in the node, itself first. */
const keyed = (node) => [...(node.id ? [node] : []), ...(node.querySelectorAll?.('[id]') ?? [])];

/** Whether the field is one a tracked form holds. */
const tracked = (field) => field.closest('form[data-track]') !== null && field.closest('[data-track="off"]') === null;

/** The live part of the region that stays for the new part: its namesake, unchanged since the server last sent it. */
const liveOf = (region, next) => {
	const live = document.getElementById(next.id);
	return live !== null && live !== region && region.contains(live) && live.localName === next.localName && (copies.get(live) ?? live).isEqualNode(next) ? live : null;
};

/** The new parts mapped to the live parts that stay for them, none inside another. */
const plan = (region, box) => {
	const kept = new Map();
	for (const next of keyed(box)) {
		const live = [...kept.keys()].some((part) => part.contains(next)) ? null : liveOf(region, next);
		if (live !== null && ![...kept.values()].includes(live)) {
			kept.set(next, live);
		}
	}
	return kept;
};

/** Whether something the swap takes out of the region - or moves, where the browser cannot move a node alive - is in use. */
const inUse = (region, kept) => {
	const alive = typeof region.moveBefore === 'function' ? [...kept.values()] : [];
	const within = (element) => element !== null && region.contains(element) && !alive.some((part) => part.contains(element));
	const layers = [...document.querySelectorAll(':popover-open, dialog[open]')];
	const outer = region.parentElement?.closest('form[data-track]');
	return layers.some((layer) => within(layer) || within(layer.matches('[popover]') ? openerOf(layer) : null) || (layer.id !== '' && within(document.querySelector('[commandfor="' + CSS.escape(layer.id) + '"]'))))
		|| [...region.querySelectorAll('form[data-track]')].some((form) => within(form) && track.dirty(form))
		|| (outer instanceof HTMLFormElement && track.dirty(outer) && region.querySelector('input, select, textarea, [data-name]') !== null)
		|| within(composing);
};

/** What the person set in the region, to carry to the new parts. */
const note = (region) => {
	const all = (selector) => [region, ...region.querySelectorAll(selector)].filter((element) => element.matches(selector));
	const filters = new Map();
	for (const button of document.querySelectorAll('button[command="--filter"][aria-controls]')) {
		const target = document.getElementById(button.getAttribute('aria-controls'));
		if (target !== null && (region.contains(target) || region.contains(button))) {
			const values = filters.get(target.id) ?? {};
			values[button.name || 'state'] = button.getAttribute('aria-pressed') === 'true' ? button.value : values[button.name || 'state'] ?? '';
			filters.set(target.id, values);
		}
	}
	const at = document.activeElement;
	const focus = at !== null && at !== region && region.contains(at) ? at : null;
	const typed = all('input[id], textarea[id]').filter((field) => (field.matches('[data-filter]') || field === focus) && !tracked(field));
	const top = region.getBoundingClientRect().top;
	const anchor = top < 0 ? all('[id]').find((element) => element.getBoundingClientRect().top >= 0) : undefined;
	let caret = null;
	try {
		caret = focus === null ? null : [focus.selectionStart, focus.selectionEnd];
	} catch {}
	return {
		filters,
		typed: typed.map((field) => [field.id, field.value, field.dataset.filter]),
		sorts: all('table[id]').map((table) => [table.id, table.querySelector(':scope > thead > tr > th:is([aria-sort="ascending"], [aria-sort="descending"])')]).filter(([, head]) => head !== null).map(([id, head]) => [id, head.cellIndex, head.querySelector('.table-sort')?.value, head.getAttribute('aria-sort')]),
		chosen: all('[data-select][id]').map((scope) => [scope.id, [...scope.querySelectorAll('input[type="checkbox"]:checked:not([data-select-all])')].map((check) => check.value)]),
		tabs: all('[role="tablist"][id]').map((list) => [list.id, list.querySelector('[role="tab"][aria-selected="true"]')?.id]),
		opens: [...all('details[id]').map((details) => [details.id, details.open]), ...[...region.querySelectorAll(TOGGLES)].map((button) => document.getElementById(button.getAttribute('aria-controls').trim().split(/\s+/)[0])).filter((target) => target !== null && target.id !== '' && region.contains(target)).map((target) => [target.id, !target.hidden])],
		scrolls: all('[id], .table-scroll').filter((box) => box.scrollTop !== 0 || box.scrollLeft !== 0).map((box) => [box === region ? '' : box.id || [...region.querySelectorAll('.table-scroll')].indexOf(box), box.scrollTop, box.scrollLeft]),
		anchor: anchor === undefined ? null : [anchor.id, anchor.getBoundingClientRect().top],
		focus: focus === null ? null : {id: focus.id, commandfor: focus.getAttribute('commandfor'), controls: focus.getAttribute('aria-controls'), command: focus.getAttribute('command') ?? '', name: focus.getAttribute('name'), value: focus.getAttribute('value') ?? '', part: focus.parentElement.closest('[id]'), caret},
	};
};

/** Whether the element is new to the page, not a live part that stayed. */
const fresh = (element, kept) => element !== null && ![...kept.values()].some((part) => part.contains(element));

/** Gives the new parts what the person set in the old ones. */
const carry = (region, notes, kept) => {
	const byId = (id) => id === '' ? region : document.getElementById(id);
	const targets = new Map(notes.filters);
	for (const [id, value, filter] of notes.typed) {
		const field = byId(id);
		if (fresh(field, kept) && !tracked(field)) {
			field.value = value;
		}
		if (filter !== undefined && !targets.has(filter)) {
			targets.set(filter, {});
		}
	}
	targets.forEach((values, id) => byId(id) && filterRegion(byId(id), values));
	for (const [id, index, key, direction] of notes.sorts) {
		const table = byId(id);
		const heads = table === null ? [] : [...table.querySelectorAll(':scope > thead > tr > th')];
		const head = heads.find((cell) => key !== undefined && cell.querySelector('.table-sort')?.value === key) ?? heads.find((cell) => cell.cellIndex === index);
		if (fresh(table, kept) && head !== undefined) {
			heads.forEach((cell) => cell.removeAttribute('aria-sort'));
			head.setAttribute('aria-sort', direction);
			sort(table);
		}
	}
	for (const [id, values] of notes.chosen) {
		const scope = byId(id);
		if (fresh(scope, kept)) {
			scope.querySelectorAll('input[type="checkbox"]:not([data-select-all])').forEach((check) => {
				check.checked = values.includes(check.value);
			});
			selection(scope);
		}
	}
	for (const [, id] of notes.tabs) {
		const tab = id === undefined ? null : byId(id);
		if (tab !== null && tab.getAttribute('aria-selected') !== 'true') {
			selectTab(tab);
		}
	}
	for (const [id, open] of notes.opens) {
		const target = byId(id);
		if (target instanceof HTMLDetailsElement) {
			target.open = open;
		} else if (target !== null && target.hidden === open) {
			const signal = new Event('command', {cancelable: true});
			Object.defineProperties(signal, {command: {value: '--toggle'}, source: {value: document.querySelector('button[command="--toggle"][aria-controls~="' + CSS.escape(id) + '"]')}});
			target.dispatchEvent(signal);
		}
	}
	for (const [key, top, left] of notes.scrolls) {
		const box = typeof key === 'number' ? region.querySelectorAll('.table-scroll')[key] : byId(key);
		box?.scrollTo(left, top);
	}
	const anchor = notes.anchor === null ? null : byId(notes.anchor[0]);
	if (anchor !== null) {
		scrollBy(0, anchor.getBoundingClientRect().top - notes.anchor[1]);
	}
	const was = notes.focus;
	if (was === null || (document.activeElement !== null && document.activeElement !== document.body)) {
		return;
	}
	const find = (selector) => region.querySelector(selector);
	const named = (attribute, value) => value === null || value === '' ? null : '[' + attribute + '="' + CSS.escape(value) + '"]';
	let target = (was.id !== '' ? byId(was.id) : null)
		?? (named('commandfor', was.commandfor) && find(named('commandfor', was.commandfor)))
		?? (named('aria-controls', was.controls) && find(named('aria-controls', was.controls) + '[command="' + CSS.escape(was.command) + '"]'))
		?? (named('name', was.name) && find(named('name', was.name) + '[value="' + CSS.escape(was.value) + '"]'))
		?? (was.part !== null && was.part !== region && region.contains(was.part) ? byId(was.part.id)?.querySelector(CONTROLS) : null)
		?? null;
	if (target === null || !region.contains(target)) {
		target = region;
		if (!region.hasAttribute('tabindex')) {
			region.tabIndex = -1;
		}
	}
	target.focus({preventScroll: true});
	try {
		if (target.id === was.id && was.caret !== null) {
			target.setSelectionRange(...was.caret);
		}
	} catch {}
};

/** Puts the new nodes into the region, the live parts that stay moved into their places; answers false while it must wait. */
const put = (region, box) => {
	const kept = plan(region, box);
	if (inUse(region, kept)) {
		return false;
	}
	const notes = note(region);
	for (const next of keyed(box)) {
		if (!kept.has(next) && ![...kept.keys()].some((part) => part.contains(next))) {
			copies.set(next, next.cloneNode(true));
		}
	}
	const places = [...kept].map(([next, live]) => {
		const place = document.createComment('');
		next.replaceWith(place);
		copies.set(live, copies.get(live) ?? next);
		return [place, live];
	});
	const old = [...region.childNodes];
	region.prepend(box);
	for (const [place, live] of places) {
		const parent = place.parentNode;
		try {
			if (typeof parent.moveBefore === 'function') {
				parent.moveBefore(live, place);
			} else {
				parent.insertBefore(live, place);
			}
		} catch {
			parent.insertBefore(live, place);
		}
		place.remove();
	}
	const stay = new Set(places.map(([, live]) => live));
	old.filter((node) => !stay.has(node)).forEach((node) => node.remove());
	carry(region, notes, kept);
	region.dispatchEvent(new CustomEvent('redz:swap', {bubbles: true}));
	return true;
};

/** The source as a node: a TrustedHTML is parsed, anything else not a node is refused. */
const nodeOf = (source) => {
	const node = globalThis.TrustedHTML && source instanceof TrustedHTML ? new DOMParser().parseFromString(source, 'text/html') : source;
	if (node instanceof Node) {
		return node;
	}
	console.error('REDZ.UI: swap() takes a DocumentFragment, a Document, an Element or a TrustedHTML, not ' + typeof source + ' - a string of markup is what Trusted Types refuses');
	return null;
};

/** Swaps the region's content for the source's, once the region is calm; answers whether it was swapped. */
const swapRegion = (region, source, {signal} = {}) => {
	const root = nodeOf(source);
	if (root === null || signal?.aborted) {
		return Promise.resolve(false);
	}
	const own = region.id === '' ? null : root.id === region.id ? root : root.querySelector?.('#' + CSS.escape(region.id));
	const box = document.createDocumentFragment();
	box.append(...(own ? own.childNodes : root instanceof Document ? (root.body ?? root.documentElement).childNodes : root instanceof Element ? [root] : root.childNodes));
	box.querySelectorAll('script').forEach((script) => script.remove());
	waiting.get(region)?.(false);
	return new Promise((answer) => {
		const done = (swapped) => {
			if (waiting.get(region) === done) {
				waiting.delete(region);
			}
			answer(swapped);
		};
		const tried = () => {
			if (!region.isConnected || put(region, box)) {
				done(region.isConnected);
				return true;
			}
			return false;
		};
		done.retry = tried;
		signal?.addEventListener('abort', () => done(false), {once: true});
		if (!tried()) {
			waiting.set(region, done);
		}
	});
};

/** Swaps the region's content, or each top part of the source into its namesake when no region is given. */
export const swap = (region, source, options) => {
	if (region instanceof Element && region.isConnected) {
		return swapRegion(region, source, options);
	}
	const root = nodeOf(region);
	const parts = root === null ? [] : [...(root instanceof Document ? root.body ?? root.documentElement : root).children].filter((part) => part.id !== '');
	return Promise.all((root instanceof Element && root.id !== '' ? [root] : parts).map((part) => document.getElementById(part.id) ? swapRegion(document.getElementById(part.id), part, source) : false)).then((all) => all.every(Boolean));
};

/** Tries every waiting swap again. */
const again = () => waiting.size > 0 && setTimeout(() => waiting.forEach((done) => done.retry()));

['toggle', 'close', 'redz:saved', 'redz:discard', 'input', 'change'].forEach((type) => document.addEventListener(type, again, true));
document.addEventListener('compositionstart', (event) => {
	composing = event.target;
});
document.addEventListener('compositionend', () => {
	composing = null;
	again();
});
