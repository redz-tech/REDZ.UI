// REDZ.UI, filters: what narrows a region's items - list items, items with a data-value, media tiles, tree items, table
// rows, any element with a data-search or with the attribute a filter button reads. A search field with data-filter
// naming the region hides, as the person types, the items whose words - their text or data-search, a table row's with
// its band's - lack one of the typed words, case and accents aside; the count is said once the typing pauses, in the
// page's text "found", and Escape clears the field. A button with command="--filter" and aria-controls naming the
// region shows only the items whose data-NAME - NAME is the button's name, "state" without one - holds a word of its
// value; the buttons of one name are one choice, a value "" shows all, and pressing the pressed one again shows all.
// Names and the search narrow together. A tree keeps the ancestors of a match and opens their groups; a table's band
// and subtotal, and a data-filter-group, stay while one of their items does. data-filter-count shows a count: in a
// button, its items; in a group, the group's; elsewhere, with the region's id, the page's text "filter.count". A
// hidden item carries data-filtered, the region fires redz:filter {count, total}, and a region redrawn is filtered
// again. REDZ.ui.filter(region, {name: value}) chooses from code, null clears. A field with data-filter-server filters
// nothing itself: it asks the page by redz:search {query, form, signal} (js/answer.js) after a pause, at once on Enter
// or Escape and when another control of its search changes, and drops an answer a newer question overtook.
import {ask} from './answer.js';
import {text, textCount} from './text.js';
import {announce} from './say.js';
import {mark} from './toggle.js';
import {restart} from './more.js';

const ITEMS = '.list-group-item, [data-value], .media-tile, .tree-item, tbody > tr, [data-search]';
const PARTS = '.table-group, .table-subtotal, [data-filter-empty], [data-filter-group], [data-filter-count]';
const PAUSE = 600;
const NAME = 'state';
const said = new WeakMap();
// The value each name of a region is filtered by, '' for all.
const chosen = new WeakMap();
// The question each server field has out.
const asked = new WeakMap();
const pending = new Set();

/** Words for matching: lower case, without accents. */
const fold = (words) => words.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of an attribute's value. */
const tokens = (value) => (value ?? '').split(/\s+/).filter(Boolean);

/** A number in the page's digits. */
const digits = (count) => new Intl.NumberFormat(document.documentElement.lang || 'en').format(count);

/** The elements naming the region by its id: SELECTOR is completed with the id's attribute value. */
const naming = (region, selector) => region.id === '' ? [] : [...document.querySelectorAll(selector.replace('?', CSS.escape(region.id)))];

/** The name a filter button chooses. */
const nameOf = (button) => button.name || NAME;

/** The region's choice per name, read from its pressed buttons the first time. */
const valuesOf = (region) => {
	const values = chosen.get(region) ?? new Map();
	for (const button of naming(region, 'button[command="--filter"][aria-controls="?"]')) {
		if (!values.has(nameOf(button)) || (!chosen.has(region) && button.getAttribute('aria-pressed') === 'true')) {
			values.set(nameOf(button), button.getAttribute('aria-pressed') === 'true' ? button.value : '');
		}
	}
	chosen.set(region, values);
	return values;
};

/** Chooses the value of the name, its buttons saying which is pressed. */
const choose = (region, name, value) => {
	valuesOf(region).set(name, value);
	for (const button of naming(region, 'button[command="--filter"][aria-controls="?"]')) {
		if (nameOf(button) === name) {
			button.setAttribute('aria-pressed', String(button.value === value));
		}
	}
};

/** The items of the region: the outermost ones, or every tree item of a tree. */
const itemsOf = (region, names = []) => {
	const all = [...region.querySelectorAll([ITEMS, ...names.map((name) => '[data-' + name + ']')].join(', '))].filter((item) => !item.matches(PARTS));
	return all.filter((item) => item.matches('.tree-item') || !all.some((other) => other !== item && other.contains(item)));
};

/** Hides each group band and subtotal of the table body whose rows are all hidden, while a filter runs. */
const bands = (body, filtering) => {
	let heads = [];
	let shown = false;
	const close = () => {
		heads.forEach((head) => head.toggleAttribute('data-filtered', filtering && !shown));
		heads = [];
		shown = false;
	};
	for (const row of body.rows) {
		if (row.matches('.table-group')) {
			close();
			heads.push(row);
		} else if (row.matches('.table-subtotal')) {
			heads.push(row);
		} else if (!row.hasAttribute('data-filtered')) {
			shown = true;
		}
	}
	close();
};

/** The table bodies of the region. */
const bodiesOf = (region) => region.matches('tbody') ? [region] : [...region.querySelectorAll('tbody')];

/** The words of each item: its data-search or its own text, after its table band's label. */
const wordsOf = (region, items) => {
	const labels = new Map();
	for (const body of bodiesOf(region)) {
		let label = '';
		for (const row of body.rows) {
			if (row.matches('.table-group') && row.cells.length > 0) {
				const head = row.cells[0].cloneNode(true);
				head.querySelector('.table-group-end')?.remove();
				label = head.textContent;
			}
			labels.set(row, label);
		}
	}
	const words = new Map();
	for (const item of items) {
		const copy = item.cloneNode(true);
		copy.querySelectorAll('.tree-group').forEach((group) => group.remove());
		words.set(item, fold((labels.get(item) ?? '') + ' ' + (item.dataset.search ?? copy.textContent)));
	}
	return words;
};

/** Filters the region by its fields and its chosen values; answers how many items it shows. */
const filter = (region) => {
	const values = valuesOf(region);
	const names = [...values.keys()];
	const narrowing = [...values].filter(([, value]) => value !== '');
	const typed = naming(region, 'input[data-filter="?"]:not([data-filter-server])').flatMap((field) => fold(field.value).split(/\s+/)).filter(Boolean);
	const filtering = typed.length > 0 || narrowing.length > 0;
	const items = itemsOf(region, names);
	const words = wordsOf(region, items);
	const holds = (item, name, value) => tokens(item.getAttribute('data-' + name)).some((token) => tokens(value).includes(token));
	const fits = (item, skipped = '') => typed.every((word) => words.get(item).includes(word)) && narrowing.every(([name, value]) => name === skipped || holds(item, name, value));
	const hits = new Set(items.filter((item) => fits(item)));
	for (const item of items) {
		const kept = !filtering || hits.has(item) || (item.matches('.tree-item') && [...hits].some((hit) => hit !== item && item.contains(hit)));
		item.toggleAttribute('data-filtered', !kept);
		const group = item.querySelector(':scope > .tree-group');
		if (kept && filtering && group !== null && group.hidden && [...hits].some((hit) => group.contains(hit))) {
			group.hidden = false;
			mark(group, true);
		}
	}
	bodiesOf(region).forEach((body) => bands(body, filtering));
	const shown = items.filter((item) => !item.hasAttribute('data-filtered') && (!filtering || !item.matches('.tree-item') || hits.has(item)));
	for (const group of region.querySelectorAll('[data-filter-group]')) {
		group.toggleAttribute('data-filtered', filtering && !shown.some((item) => group.contains(item)));
	}
	region.querySelectorAll('[data-filter-empty]').forEach((empty) => {
		empty.hidden = !filtering || shown.length > 0;
	});
	for (const button of naming(region, 'button[command="--filter"][aria-controls="?"]')) {
		const count = button.querySelector('[data-filter-count]');
		if (count !== null) {
			count.textContent = digits(items.filter((item) => fits(item, nameOf(button)) && (button.value === '' || holds(item, nameOf(button), button.value))).length);
		}
	}
	for (const count of region.querySelectorAll('[data-filter-group] [data-filter-count]')) {
		count.textContent = digits(shown.filter((item) => count.closest('[data-filter-group]').contains(item)).length);
	}
	for (const count of naming(region, '[data-filter-count="?"]')) {
		count.textContent = text('filter.count', {count: digits(shown.length), total: digits(items.length)});
	}
	watch(region, names);
	region.dispatchEvent(new CustomEvent('redz:filter', {bubbles: true, detail: {count: shown.length, total: items.length}}));
	return shown.length;
};

const watching = new Set();

/** Whether the change redraws items: an attribute filtered on, or elements put in or taken out. */
const redraws = (record) => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE);

const redrawn = new MutationObserver((records) => {
	for (const record of records.filter(redraws)) {
		const region = [...watching].find((one) => one.contains(record.target));
		if (region !== undefined) {
			pending.add(region);
		}
	}
	queueMicrotask(() => {
		pending.forEach((region) => region.isConnected && filter(region));
		pending.clear();
	});
});

/** Filters the region again whenever its items change. */
const watch = (region, names) => {
	watching.forEach((one) => one.isConnected || watching.delete(one));
	watching.add(region);
	redrawn.observe(region, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-search', ...names.map((name) => 'data-' + name)]});
};

/** Chooses the region's values from code - {name: value}, null clears every name and search field; answers its count. */
export const filterRegion = (region, values) => {
	if (values === null) {
		valuesOf(region).forEach((value, name) => choose(region, name, ''));
		naming(region, 'input[data-filter="?"]:not([data-filter-server])').forEach((field) => {
			field.value = '';
		});
	} else {
		Object.entries(values).forEach(([name, value]) => choose(region, name, String(value ?? '')));
	}
	return filter(region);
};

/** The search's named controls as a form would send them. */
const formOf = (search) => {
	if (search?.localName === 'form') {
		return new FormData(search);
	}
	const form = new FormData();
	for (const control of search?.querySelectorAll('input[name], select[name], textarea[name]') ?? []) {
		if (!control.disabled && (!['checkbox', 'radio'].includes(control.type) || control.checked)) {
			(control.localName === 'select' ? [...control.selectedOptions].map((option) => option.value) : [control.value]).forEach((value) => form.append(control.name, value));
		}
	}
	return form;
};

/** Asks the page for the server field's results, the question before it dropped. */
const query = (field) => {
	clearTimeout(said.get(field));
	asked.get(field)?.abort();
	const controller = new AbortController();
	const region = document.getElementById(field.dataset.filter ?? '');
	const words = field.value.trim();
	const [, answer] = ask(field, 'redz:search', {query: words, form: formOf(field.closest('search, form')), signal: controller.signal});
	if (answer === null) {
		return;
	}
	asked.set(field, controller);
	field.setAttribute('aria-busy', 'true');
	region?.setAttribute('aria-busy', 'true');
	answer.then((result) => {
		if (!controller.signal.aborted && region !== null) {
			restart(region, result);
			if (words !== '') {
				announce(textCount('found', typeof result?.count === 'number' ? result.count : itemsOf(region).length));
			}
		}
	}, () => {}).finally(() => {
		if (asked.get(field) === controller) {
			asked.delete(field);
			field.removeAttribute('aria-busy');
			region?.removeAttribute('aria-busy');
		}
	});
};

/** The filter field the event is on, or null. */
const fieldOf = (event) => event.target instanceof HTMLInputElement && event.target.hasAttribute('data-filter') ? event.target : null;

document.addEventListener('input', (event) => {
	const field = fieldOf(event);
	const region = field === null ? null : document.getElementById(field.dataset.filter);
	if (region === null) {
		return;
	}
	clearTimeout(said.get(field));
	if (field.hasAttribute('data-filter-server')) {
		said.set(field, setTimeout(() => query(field), PAUSE));
		return;
	}
	const count = filter(region);
	said.set(field, setTimeout(() => {
		if (field.value.trim() !== '') {
			announce(textCount('found', count));
		}
	}, PAUSE));
});

document.addEventListener('keydown', (event) => {
	const field = fieldOf(event);
	if (field === null || event.isComposing || !(event.key === 'Escape' && field.value !== '') && !(event.key === 'Enter' && field.hasAttribute('data-filter-server'))) {
		return;
	}
	event.preventDefault();
	if (event.key === 'Escape') {
		field.value = '';
	}
	if (field.hasAttribute('data-filter-server')) {
		query(field);
	} else {
		field.dispatchEvent(new Event('input', {bubbles: true}));
	}
});

document.addEventListener('change', (event) => {
	const search = event.target instanceof Element && !event.target.hasAttribute('data-filter') ? event.target.closest('search, form') : null;
	search?.querySelectorAll('input[data-filter][data-filter-server]').forEach(query);
});

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--filter"][aria-controls]') : null;
	const region = button === null || button.disabled || button.getAttribute('aria-disabled') === 'true' ? null : document.getElementById(button.getAttribute('aria-controls'));
	if (region === null) {
		return;
	}
	choose(region, nameOf(button), valuesOf(region).get(nameOf(button)) === button.value ? '' : button.value);
	announce(textCount('found', filter(region)));
});

const named = [
	...[...document.querySelectorAll('button[command="--filter"][aria-controls]')].map((button) => button.getAttribute('aria-controls')),
	...[...document.querySelectorAll('[data-filter-count]:not([data-filter-count=""])')].map((count) => count.dataset.filterCount),
	...[...document.querySelectorAll('input[data-filter]:not([data-filter-server])')].filter((field) => field.value !== '').map((field) => field.dataset.filter),
];
new Set(named.map((id) => document.getElementById(id)).filter((region) => region !== null)).forEach(filter);
