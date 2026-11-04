// REDZ.UI, repeaters: a list with data-repeat holds a <template> of one row. A button with command="--add" and
// aria-controls naming the list adds a row made from it - every {i} in the row's attributes (names, ids, for) turned
// into a running index - and puts the focus in its first field; a row's own command="--remove" button takes the row
// away, the focus on the next row's first field, else the previous row's, else on Add. data-min and data-max on the
// list hold the count: a button that would pass it is aria-disabled. redz:add and redz:remove on the list come first,
// with the row in detail.row; a page that cancels one keeps the list as it is. Rows with a data-value move by
// data-reorder as well. Like --toggle, the buttons take no commandfor: the click sends the command event.
const ADD = '--add';
const REMOVE = '--remove';
const FIELD = 'input:not([type="hidden"]), select, textarea';
const FOCUSABLE = 'input:not([type="hidden"]), select, textarea, button, a[href], [tabindex]';
const next = new WeakMap();

/** The list's rows: its children but the template and an empty state. */
const rowsOf = (list) => [...list.children].filter((child) => child.localName !== 'template' && !child.hasAttribute('data-filter-empty'));

/** The --add buttons of the list. */
const addsOf = (list) => list.id === '' ? [] : [...document.querySelectorAll('button[command="' + ADD + '"][aria-controls~="' + CSS.escape(list.id) + '"]')];

/** Where the focus goes in a row: its first field, else its first control. */
const focusOf = (row) => row.querySelector(FIELD) ?? row.querySelector(FOCUSABLE);

/** Marks aria-disabled the buttons that would take the list past data-max or below data-min. */
const mark = (list) => {
	const count = rowsOf(list).length;
	const min = Number(list.dataset.min ?? 0);
	const max = list.dataset.max === undefined ? Infinity : Number(list.dataset.max);
	const set = (button, off) => {
		if (off) {
			button.setAttribute('aria-disabled', 'true');
		} else {
			button.removeAttribute('aria-disabled');
		}
	};
	addsOf(list).forEach((button) => set(button, count >= max));
	list.querySelectorAll('button[command="' + REMOVE + '"]').forEach((button) => set(button, count <= min));
};

/** Adds a row to the list from its template, unless the page cancels redz:add. */
const add = (list) => {
	const template = list.querySelector(':scope > template');
	if (template === null) {
		return;
	}
	const index = next.get(list) ?? rowsOf(list).length;
	const row = template.content.firstElementChild?.cloneNode(true);
	if (!(row instanceof Element)) {
		return;
	}
	for (const element of [row, ...row.querySelectorAll('*')]) {
		for (const attribute of element.attributes) {
			if (attribute.value.includes('{i}')) {
				attribute.value = attribute.value.replaceAll('{i}', String(index));
			}
		}
	}
	if (!list.dispatchEvent(new CustomEvent('redz:add', {bubbles: true, cancelable: true, detail: {row}}))) {
		return;
	}
	next.set(list, index + 1);
	const last = rowsOf(list).at(-1);
	if (last === undefined) {
		template.after(row);
	} else {
		last.after(row);
	}
	mark(list);
	focusOf(row)?.focus();
};

/** Takes the row away, unless the page cancels redz:remove; the focus to its neighbour or to Add. */
const remove = (list, row) => {
	if (!list.dispatchEvent(new CustomEvent('redz:remove', {bubbles: true, cancelable: true, detail: {row}}))) {
		return;
	}
	const rows = rowsOf(list);
	const at = rows.indexOf(row);
	const neighbour = rows[at + 1] ?? rows[at - 1] ?? null;
	next.set(list, next.get(list) ?? rows.length);
	row.remove();
	mark(list);
	(neighbour === null ? addsOf(list)[0] : focusOf(neighbour))?.focus();
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="' + ADD + '"][aria-controls], [data-repeat] button[command="' + REMOVE + '"]') : null;
	if (button === null || event.defaultPrevented || button.disabled || button.hasAttribute('commandfor')) {
		return;
	}
	const adding = button.getAttribute('command') === ADD;
	const list = adding ? document.getElementById((button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0]) : button.closest('[data-repeat]');
	const target = adding ? list : rowsOf(list).find((row) => row.contains(button));
	if (list?.hasAttribute('data-repeat') && target !== undefined) {
		const signal = new Event('command', {cancelable: true});
		Object.defineProperties(signal, {command: {value: adding ? ADD : REMOVE}, source: {value: button}});
		target.dispatchEvent(signal);
	}
});

document.addEventListener('command', (event) => {
	if (event.command === ADD && event.target instanceof HTMLElement && event.target.hasAttribute('data-repeat')) {
		add(event.target);
	} else if (event.command === REMOVE && event.target instanceof HTMLElement && event.target.parentElement?.hasAttribute('data-repeat')) {
		remove(event.target.parentElement, event.target);
	}
}, true);

document.querySelectorAll('[data-repeat]').forEach(mark);

new MutationObserver((records) => {
	for (const record of records) {
		if (record.target instanceof HTMLElement && record.target.hasAttribute('data-repeat')) {
			mark(record.target);
		}
	}
}).observe(document.documentElement, {subtree: true, childList: true});
