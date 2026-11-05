// REDZ.UI editor, the parts of a block: rows and columns of a table, items of a list, cards of a grid. Whatever repeats beside its like
// can be added, copied, moved and removed, and a tab goes with its panel.
import {FIELDS, blockId} from './marks.js';

const panelOf = (tab) => tab.matches('[role="tab"]') ? tab.ownerDocument.getElementById(tab.getAttribute('aria-controls') || '') : null;

/** Empties the words of a copy, so a new part starts blank but keeps its form. */
const blank = (copy) => {
	for (const one of copy.matches(FIELDS) ? [copy] : copy.querySelectorAll(FIELDS)) {
		for (const node of [...one.childNodes]) {
			if (node.nodeType !== Node.ELEMENT_NODE || !node.matches('i.bi')) {
				node.remove();
			}
		}
	}
	return copy;
};

const renewIds = (copy) => {
	for (const one of [copy, ...copy.querySelectorAll('[id]')]) {
		if (one.id !== '') {
			one.id = one.id + '-' + blockId().slice(0, 4);
		}
	}
	return copy;
};

/** A copy of a part after it, its panel with it; blank when asked. */
const copyPart = (part, empty) => {
	const copy = renewIds(part.cloneNode(true));
	part.after(empty ? blank(copy) : copy);
	const panel = panelOf(part);
	if (panel !== null) {
		const twin = renewIds(panel.cloneNode(true));
		panel.after(empty ? blank(twin) : twin);
		copy.setAttribute('aria-controls', twin.id);
		twin.setAttribute('aria-labelledby', copy.id);
	}
	return copy;
};

/** Does one thing to a part; what it answers is the part to stay on, or null. */
export const partDo = (part, act) => {
	if (act === 'add') {
		return copyPart(part, true);
	}
	if (act === 'copy') {
		return copyPart(part, false);
	}
	if (act === 'up' && part.previousElementSibling !== null) {
		part.previousElementSibling.before(part);
		return part;
	}
	if (act === 'down' && part.nextElementSibling !== null) {
		part.nextElementSibling.after(part);
		return part;
	}
	if (act === 'drop') {
		const near = part.nextElementSibling ?? part.previousElementSibling;
		panelOf(part)?.remove();
		part.remove();
		return near;
	}
	return part;
};

/** The rows of a table, head and foot too. */
export const rowsOf = (table) => [...table.rows];

/** How many columns a table has. */
export const columnsOf = (table) => Math.max(0, ...rowsOf(table).map((row) => row.cells.length));

/** Adds a row after a row, its cells blank; a head's row gives a body's. */
export const rowAdd = (table, at) => {
	const rows = rowsOf(table);
	const near = rows[at] ?? rows.at(-1);
	const copy = near.cloneNode(true);
	for (const cell of copy.cells) {
		cell.replaceChildren();
	}
	if (near.parentElement.tagName === 'THEAD') {
		const body = table.tBodies[0] ?? table.createTBody();
		for (const [index, cell] of [...copy.cells].entries()) {
			const plain = table.ownerDocument.createElement(index === 0 && table.tBodies[0]?.rows[0]?.cells[0]?.tagName === 'TH' ? 'th' : 'td');
			if (plain.tagName === 'TH') {
				plain.scope = 'row';
			}
			cell.replaceWith(plain);
		}
		body.prepend(copy);
	} else {
		near.after(copy);
	}
	return copy;
};

/** Removes a row; answers whether the table still has a row of its body. */
export const rowDrop = (table, at) => {
	rowsOf(table)[at]?.remove();
	return [...table.tBodies].some((body) => body.rows.length > 0);
};

/** Adds a column after a column. */
export const columnAdd = (table, at) => {
	for (const row of rowsOf(table)) {
		const near = row.cells[at] ?? row.cells[row.cells.length - 1];
		const cell = near.cloneNode(false);
		cell.removeAttribute('id');
		near.after(cell);
	}
};

/** Removes a column; answers whether the table still has one. */
export const columnDrop = (table, at) => {
	for (const row of rowsOf(table)) {
		row.cells[at]?.remove();
	}
	return columnsOf(table) > 0;
};

/** Turns a table's first row into its head, or its head into a first row. */
export const headToggle = (table, on) => {
	const doc = table.ownerDocument;
	if (on && table.tHead === null) {
		const first = table.rows[0];
		if (first === undefined) {
			return;
		}
		const head = doc.createElement('thead');
		for (const cell of [...first.cells]) {
			const th = doc.createElement('th');
			th.scope = 'col';
			th.append(...cell.childNodes);
			cell.replaceWith(th);
		}
		head.append(first);
		table.prepend(head);
	} else if (!on && table.tHead !== null) {
		const head = table.tHead;
		const body = table.tBodies[0] ?? table.createTBody();
		for (const cell of [...head.rows[0].cells]) {
			const td = doc.createElement('td');
			td.append(...cell.childNodes);
			cell.replaceWith(td);
		}
		body.prepend(...head.rows);
		head.remove();
	}
};
