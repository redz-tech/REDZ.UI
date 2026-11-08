// REDZ.UI, selection: an element with data-select holds a selection - its checks, the boxes of its rows or items. A
// check with data-select-all heads them: checked when all are, mixed when some are, and pressed it checks or clears
// them all; it heads the scope it stands in, or the scopes its aria-controls names. A data-select inside another is a
// group: its own head heads its checks and the outer head all of them. Only the checks a person can use count -
// enabled, and not in an item a filter hides (js/filter.js) or code hides in the selection: a checked one hidden leaves
// the count until it is shown again, checked again. A selection-bar in the scope hides at zero; a data-select-count
// says "selected" in the page's words; the scope fires redz:selection {count, total, values}, the values of its checked
// checks, and a head that changes them all says the count too. data-select="rows" on a table also checks a row clicked
// anywhere but on its controls or its text being selected. A button with command="--select-all" or "--select-none" and
// aria-controls naming a scope does the same as its head. Scopes put in later or given data-select later are watched
// the same; a check's disabled, checked or hidden and an item's hidden set by code are seen. A check's checked property
// set by code is not: the page fires change on it, or calls REDZ.ui.selection(scope), which reads the scope again.
import {textCount} from './text.js';
import {announce} from './say.js';

const CONTROLS = 'a[href], button, input, select, textarea, label, summary, [contenteditable], [tabindex]';

/** Whether a filter hid the check's item, or code hid the check or an element around it inside its selection. */
const unseen = (check) => {
	const hidden = check.closest('[hidden]');
	const scope = hidden === null ? null : outermost(check);
	return check.closest('[data-filtered]') !== null || (scope !== null && hidden !== scope && scope.contains(hidden));
};

/** The checks of the scope a person can choose: not heads, enabled, not hidden. */
const checksOf = (scope) => [...scope.querySelectorAll('input[type="checkbox"]:not([data-select-all])')].filter((check) => !check.disabled && !unseen(check));

/** The scopes the head heads. */
const headed = (head) => {
	const named = (head.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter((scope) => scope !== null);
	return named.length > 0 ? named : [head.closest('[data-select]')].filter((scope) => scope !== null);
};

/** The outermost scope the element is in. */
const outermost = (element) => {
	let scope = element.closest('[data-select]');
	while (scope?.parentElement?.closest('[data-select]')) {
		scope = scope.parentElement.closest('[data-select]');
	}
	return scope;
};

/** Writes the scope's state - checks hidden or shown again, heads, bars, counts - and fires redz:selection when it changed. */
const sync = (scope) => {
	for (const check of scope.querySelectorAll('input[type="checkbox"]:not([data-select-all])')) {
		const hidden = unseen(check);
		if (hidden && check.checked) {
			check.checked = false;
			check.dataset.selectKept = '';
		} else if (!hidden && 'selectKept' in check.dataset) {
			check.checked = true;
			delete check.dataset.selectKept;
		}
	}
	for (const head of document.querySelectorAll('input[type="checkbox"][data-select-all]')) {
		const checks = headed(head).flatMap(checksOf);
		if (checks.length > 0 || headed(head).some((one) => scope.contains(one))) {
			const count = checks.filter((check) => check.checked).length;
			head.checked = count > 0 && count === checks.length;
			head.indeterminate = count > 0 && count < checks.length;
		}
	}
	const scopes = [scope, ...scope.querySelectorAll('[data-select]')];
	for (const one of scopes) {
		const count = checksOf(one).filter((check) => check.checked).length;
		one.querySelectorAll(':scope .selection-bar').forEach((bar) => {
			if (bar.parentElement.closest('[data-select]') === one && bar.hidden !== (count === 0)) {
				bar.hidden = count === 0;
			}
		});
		one.querySelectorAll('[data-select-count]').forEach((element) => {
			const words = textCount('selected', count);
			if (element.parentElement.closest('[data-select]') === one && element.textContent !== words) {
				element.textContent = words;
			}
		});
	}
	const checks = checksOf(scope);
	const values = checks.filter((check) => check.checked).map((check) => check.value);
	const state = JSON.stringify([checks.length, values]);
	if (fired.get(scope) !== state) {
		fired.set(scope, state);
		scope.dispatchEvent(new CustomEvent('redz:selection', {bubbles: true, detail: {count: values.length, total: checks.length, values}}));
	}
};

// The state each scope last told the page.
const fired = new WeakMap();

/** Checks or clears every check of the scopes, then says how many are chosen. */
const all = (scopes, checked) => {
	const checks = scopes.flatMap(checksOf);
	checks.forEach((check) => {
		check.checked = checked;
	});
	new Set(scopes.map(outermost).filter((scope) => scope !== null)).forEach(sync);
	announce(textCount('selected', checks.filter((check) => check.checked).length));
};

document.addEventListener('change', (event) => {
	const check = event.target instanceof HTMLInputElement && event.target.type === 'checkbox' ? event.target : null;
	const scope = check === null ? null : outermost(check);
	if (check === null || (scope === null && !check.hasAttribute('data-select-all'))) {
		return;
	}
	if (check.hasAttribute('data-select-all')) {
		all(headed(check), check.checked);
	} else {
		sync(scope);
	}
});

document.addEventListener('click', (event) => {
	const target = event.target instanceof Element ? event.target : null;
	const button = target?.closest('button[command="--select-all"][aria-controls], button[command="--select-none"][aria-controls]');
	if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
		all(headed(button), button.getAttribute('command') === '--select-all');
		return;
	}
	const row = target?.closest('[data-select="rows"] tbody > tr');
	if (!row || target.closest(CONTROLS) !== null || !getSelection()?.isCollapsed) {
		return;
	}
	row.querySelector('input[type="checkbox"]:not([data-select-all])')?.click();
});

document.addEventListener('redz:filter', (event) => {
	const scopes = [...document.querySelectorAll('[data-select]')].filter((scope) => scope.contains(event.target) || event.target.contains(scope));
	new Set(scopes.map(outermost)).forEach(sync);
});

/** Reads the selections in or around the element again - its checks changed by code - and fires redz:selection where one changed. */
export const selection = (element) => {
	const scopes = [element.closest('[data-select]'), ...element.querySelectorAll('[data-select]')].filter((scope) => scope !== null);
	new Set(scopes.map(outermost)).forEach(sync);
};

new MutationObserver((records) => {
	const scopes = new Set();
	for (const record of records) {
		if (record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE)) {
			scopes.add(outermost(record.target));
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				[...(node.matches('[data-select]') ? [node] : []), ...node.querySelectorAll('[data-select]')].forEach((scope) => scopes.add(outermost(scope)));
			}
		}
	}
	scopes.forEach((scope) => scope?.isConnected && sync(scope));
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-select', 'disabled', 'checked', 'hidden']});

for (const scope of document.querySelectorAll('[data-select]')) {
	if (outermost(scope) === scope) {
		sync(scope);
	}
}
