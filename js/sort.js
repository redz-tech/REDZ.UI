// REDZ.UI, sorting: a table-sort button with a value sorts its table's rows in place - by each row's data-sort-VALUE,
// else its cell's data-sort-value, else the cell's text: numbers as numbers, words in the page's language with their
// digits as numbers, an empty value last both ways, ties in the order the rows were drawn. A band's rows stay under it,
// its subtotal last. The first press sorts ascending, or as the button's data-sort-first says; the next turns it; on a
// table with data-sort-reset a third press brings back the drawn order. The header's aria-sort says the order, the
// page's text "sort.ascending", "sort.descending" or "sort.none" says it aloud. The table fires the cancelable
// redz:sort {key, direction} first (js/answer.js): a page that sorts itself takes it - answered with a promise, the
// button is busy and a refusal puts the order back. Rows the page puts in are sorted the same; REDZ.ui.sort(table)
// sorts again.
import {ask} from './answer.js';
import {busy} from './busy.js';
import {text} from './text.js';
import {announce} from './say.js';

// The order each row was drawn in.
const drawn = new WeakMap();
let next = 0;

/** The table's header cell that is sorted by its button, or null. */
const sortedOf = (table) => [...table.querySelectorAll(':scope > thead > tr > th[aria-sort]')].find((head) => ['ascending', 'descending'].includes(head.getAttribute('aria-sort')) && head.querySelector('button.table-sort[value]') !== null) ?? null;

/** The value a row is sorted by for the header cell's button. */
const valueOf = (row, head) => {
	const key = head.querySelector('button.table-sort').value;
	const own = key === '' ? null : row.getAttribute('data-sort-' + key);
	const cell = row.cells[head.cellIndex];
	return (own ?? cell?.dataset.sortValue ?? cell?.textContent ?? '').trim();
};

/** Puts the rows of each body - each band's rows apart - in the order of the header cell, or in the drawn order. */
const order = (table, head, direction) => {
	const collator = new Intl.Collator(document.documentElement.lang || 'en', {numeric: true, sensitivity: 'base'});
	const sign = direction === 'descending' ? -1 : 1;
	const compare = (one, two) => {
		const [a, b] = [one, two].map((row) => head === null ? '' : valueOf(row, head));
		if (a === '' || b === '') {
			return a === b ? drawn.get(one) - drawn.get(two) : (a === '' ? 1 : -1);
		}
		const [x, y] = [Number(a), Number(b)];
		const by = Number.isFinite(x) && Number.isFinite(y) ? x - y : collator.compare(a, b);
		return by === 0 ? drawn.get(one) - drawn.get(two) : sign * by;
	};
	for (const body of table.tBodies) {
		for (const row of body.rows) {
			if (!drawn.has(row)) {
				drawn.set(row, next++);
			}
		}
		let run = [];
		const place = (before) => {
			run.sort(compare).forEach((row) => body.insertBefore(row, before));
			run = [];
		};
		for (const row of [...body.rows]) {
			if (row.matches('.table-group, .table-subtotal')) {
				place(row);
			} else {
				run.push(row);
			}
		}
		place(null);
	}
	redrawn.takeRecords();
};

/** Sorts the table again by the order its header says. */
export const sort = (table) => {
	const head = sortedOf(table);
	order(table, head, head?.getAttribute('aria-sort') ?? 'ascending');
};

// The tables whose page sorts them itself.
const own = new WeakSet();

const redrawn = new MutationObserver((records) => {
	const tables = new Set(records.filter((record) => [...record.addedNodes].some((node) => ['TR', 'TBODY'].includes(node.nodeName))).map((record) => record.target.closest('table')));
	tables.forEach((table) => table !== null && !own.has(table) && sortedOf(table) !== null && sort(table));
});

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('th > button.table-sort[value]') : null;
	const table = button === null || button.getAttribute('aria-disabled') === 'true' ? null : button.closest('table');
	if (table === null) {
		return;
	}
	const head = button.parentElement;
	const was = sortedOf(table);
	const first = button.dataset.sortFirst === 'descending' ? 'descending' : 'ascending';
	const current = was === head ? head.getAttribute('aria-sort') : 'none';
	const turned = first === 'ascending' ? 'descending' : 'ascending';
	const now = current === 'none' ? first : (current === first ? turned : (table.hasAttribute('data-sort-reset') ? 'none' : first));
	const before = [was, was?.getAttribute('aria-sort')];
	const write = (cell, direction) => {
		table.querySelectorAll(':scope > thead > tr > th[aria-sort]').forEach((one) => one.removeAttribute('aria-sort'));
		if (cell !== null && direction !== 'none') {
			cell.setAttribute('aria-sort', direction);
		}
	};
	write(head, now);
	const label = button.textContent.trim();
	announce(now === 'none' ? text('sort.none', {label}) : (now === 'ascending' ? text('sort.ascending', {label}) : text('sort.descending', {label})));
	const [taken, answer] = ask(table, 'redz:sort', {key: button.value, direction: now});
	if (taken) {
		own.add(table);
	} else {
		own.delete(table);
		order(table, now === 'none' ? null : head, now);
	}
	if (answer !== null) {
		busy(button, answer).catch(() => write(...before));
	}
	redrawn.observe(table, {childList: true, subtree: true});
});

for (const table of document.querySelectorAll('table')) {
	if (sortedOf(table) !== null) {
		redrawn.observe(table, {childList: true, subtree: true});
		sort(table);
	}
}
