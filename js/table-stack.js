// REDZ.UI, a table that stacks: on a phone each row of a table-stack is a card, and each of its cells shows its column
// head's words, copied here from the head into the cell's data-label; a label the page wrote stays, and a cell across
// several columns, such as a row's form, takes none. A head's select all, standing in the bar above the cards, shows
// the words of its check - its label or aria-label - copied into its cell's data-label.
const TABLES = 'table.table-stack';

/** A head's words as a person sees them: no hidden text and no layer it holds. */
const words = (cell) => {
	const copy = cell.cloneNode(true);
	copy.querySelectorAll('.visually-hidden, [aria-hidden="true"], [popover], dialog, template').forEach((part) => part.remove());
	return copy.textContent.replace(/\s+/g, ' ').trim();
};

/** Gives each cell of the bodies and the foot its column head's words. */
const label = (table) => {
	const head = table.tHead?.rows[table.tHead.rows.length - 1];
	if (head === undefined) {
		return;
	}
	const columns = [];
	for (const cell of head.cells) {
		const check = cell.matches('.table-check') ? cell.querySelector('input[type="checkbox"]') : null;
		const named = check === null ? '' : check.labels?.[0]?.textContent.trim() || check.getAttribute('aria-label') || '';
		if (named !== '' && !cell.hasAttribute('data-label')) {
			cell.setAttribute('data-label', named);
		}
		const text = words(cell);
		for (let span = 0; span < cell.colSpan; span++) {
			columns.push(text);
		}
	}
	for (const section of [...table.tBodies, table.tFoot]) {
		for (const row of section?.rows ?? []) {
			if (row.matches('.table-group, .table-detail')) {
				continue;
			}
			let column = 0;
			for (const cell of row.cells) {
				const text = columns[column] ?? '';
				column += cell.colSpan;
				if (cell.localName === 'td' && cell.colSpan === 1 && text !== '' && !cell.hasAttribute('data-label')) {
					cell.setAttribute('data-label', text);
				}
			}
		}
	}
};

document.querySelectorAll(TABLES).forEach(label);

new MutationObserver((records) => {
	const tables = new Set();
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				const own = node.closest(TABLES);
				if (own !== null) {
					tables.add(own);
				}
				node.querySelectorAll(TABLES).forEach((table) => tables.add(table));
			}
		}
	}
	tables.forEach(label);
}).observe(document.documentElement, {childList: true, subtree: true});
