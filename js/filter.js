// REDZ.UI, filters: a search field with data-filter naming a region hides, as the person types, the region's items
// whose words - their text, or their data-search - lack one of the typed words, case and accents aside: list items,
// items with a data-value, media tiles, tree items, table rows. A tree keeps the ancestors of a match and opens their
// groups; a table's group band and subtotal stay while a row of their group does. An element with data-filter-empty in the region shows when nothing matches; the count is said once the
// typing pauses, in the page's text "found"; Escape in the field clears it. A hidden item carries data-filtered.
import {textCount} from './text.js';
import {announce} from './say.js';
import {mark} from './toggle.js';

const ITEMS = '.list-group-item, [data-value], .media-tile, .tree-item, tbody > tr:not(.table-group, .table-subtotal)';
const PAUSE = 600;
const said = new WeakMap();

/** Words for matching: lower case, without accents. */
const fold = (words) => words.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The items of the region: the outermost ones, or every tree item of a tree. */
const itemsOf = (region) => {
	const all = [...region.querySelectorAll(ITEMS)].filter((item) => !item.hasAttribute('data-filter-empty'));
	return all.filter((item) => item.matches('.tree-item') || !all.some((other) => other !== item && other.contains(item)));
};

/** Hides each group band and subtotal of the table body whose rows are all hidden, while a search runs. */
const bands = (body, searching) => {
	let heads = [];
	let shown = false;
	const close = () => {
		heads.forEach((head) => head.toggleAttribute('data-filtered', searching && !shown));
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

/** Hides the region's items that lack a word of the field's value; answers how many match. */
const filter = (field) => {
	const region = document.getElementById(field.dataset.filter ?? '');
	if (region === null) {
		return 0;
	}
	const words = fold(field.value).split(/\s+/).filter(Boolean);
	const items = itemsOf(region);
	const own = (item) => {
		const copy = item.cloneNode(true);
		copy.querySelectorAll('.tree-group').forEach((group) => group.remove());
		return fold(item.dataset.search ?? copy.textContent);
	};
	const hits = new Set(items.filter((item) => words.every((word) => own(item).includes(word))));
	for (const item of items) {
		const kept = words.length === 0 || hits.has(item) || (item.matches('.tree-item') && [...hits].some((hit) => hit !== item && item.contains(hit)));
		item.toggleAttribute('data-filtered', !kept);
		const group = item.querySelector(':scope > .tree-group');
		if (kept && words.length > 0 && group !== null && group.hidden && [...hits].some((hit) => group.contains(hit))) {
			group.hidden = false;
			mark(group, true);
		}
	}
	for (const body of region.matches('tbody') ? [region] : region.querySelectorAll('tbody')) {
		bands(body, words.length > 0);
	}
	const count = words.length === 0 ? items.length : items.filter((item) => !item.hasAttribute('data-filtered') && (!item.matches('.tree-item') || hits.has(item))).length;
	region.querySelectorAll('[data-filter-empty]').forEach((empty) => {
		empty.hidden = count > 0;
	});
	return count;
};

document.addEventListener('input', (event) => {
	const field = event.target instanceof HTMLInputElement && event.target.hasAttribute('data-filter') ? event.target : null;
	if (field === null) {
		return;
	}
	const count = filter(field);
	clearTimeout(said.get(field));
	said.set(field, setTimeout(() => {
		if (field.value.trim() !== '') {
			announce(textCount('found', count));
		}
	}, PAUSE));
});

document.addEventListener('keydown', (event) => {
	const field = event.target instanceof HTMLInputElement && event.target.hasAttribute('data-filter') ? event.target : null;
	if (field !== null && event.key === 'Escape' && field.value !== '') {
		event.preventDefault();
		field.value = '';
		field.dispatchEvent(new Event('input', {bubbles: true}));
	}
});

document.querySelectorAll('input[data-filter]').forEach((field) => {
	if (field.value !== '') {
		filter(field);
	}
});
