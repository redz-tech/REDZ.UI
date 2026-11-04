// REDZ.UI, views: a button with command="--view", aria-controls naming a list and a value - grid, list - puts its value in
// the list's data-view, says in aria-pressed which of the list's view buttons shows, and tells the page in redz:view
// (detail.view), which keeps the choice - the library stores nothing; the page that remembers it writes data-view on the
// list, at load or later, and the buttons follow. Like --toggle, the button has no commandfor.
const COMMAND = '--view';

/** The list the --view button names in aria-controls, or null. */
const listOf = (button) => document.getElementById((button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0]);

/** Presses the list's view button whose value is the list's data-view, and lets go of the others. */
const mark = (list) => {
	for (const button of document.querySelectorAll('button[command="' + COMMAND + '"][aria-controls~="' + CSS.escape(list.id) + '"]')) {
		button.setAttribute('aria-pressed', String(button.value === list.dataset.view));
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="' + COMMAND + '"][aria-controls]') : null;
	const target = button === null || event.defaultPrevented || button.disabled || button.hasAttribute('commandfor') ? null : listOf(button);
	if (target !== null) {
		const signal = new Event('command', {cancelable: true});
		Object.defineProperties(signal, {command: {value: COMMAND}, source: {value: button}});
		target.dispatchEvent(signal);
	}
});

document.addEventListener('command', (event) => {
	const list = event.target;
	const view = event.source?.value ?? '';
	if (event.command !== COMMAND || !(list instanceof HTMLElement) || view === '' || list.dataset.view === view) {
		return;
	}
	list.dataset.view = view;
	list.dispatchEvent(new CustomEvent('redz:view', {bubbles: true, detail: {view}}));
}, true);

for (const button of document.querySelectorAll('button[command="' + COMMAND + '"][aria-controls]')) {
	const list = listOf(button);
	if (list !== null) {
		mark(list);
	}
}

new MutationObserver((records) => {
	for (const record of records) {
		if (record.target instanceof HTMLElement && record.target.id !== '') {
			mark(record.target);
		}
	}
}).observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['data-view']});
