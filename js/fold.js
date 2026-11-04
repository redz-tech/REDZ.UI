// REDZ.UI, the folded side navigation: a button with command="--fold" and aria-controls naming the app shell's
// app-sidebar folds it into a rail of icons above 1024 px and back, says which in aria-pressed, and tells the page in
// redz:fold (detail.folded), which keeps the choice - the library stores nothing; the page that remembers it writes
// data-folded on the sidebar, at load or later, and the buttons follow. Folded, each link's words become its title, shown as the library's tooltip, and its name
// stays its words. Like --toggle, the button has no commandfor: WebKit would expose it as collapsed.
const COMMAND = '--fold';
const titled = new WeakSet();
const opted = new WeakSet();

/** The sidebar the --fold button names in aria-controls, or null. */
const sidebarOf = (button) => document.getElementById((button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0]);

/** Brings the sidebar's buttons, its links' titles and its tooltips in line with its data-folded. */
const mark = (sidebar) => {
	const folded = sidebar.hasAttribute('data-folded');
	for (const button of document.querySelectorAll('button[command="' + COMMAND + '"][aria-controls~="' + CSS.escape(sidebar.id) + '"]')) {
		button.setAttribute('aria-pressed', String(folded));
	}
	for (const link of sidebar.querySelectorAll('.app-link')) {
		if (folded && !link.hasAttribute('title')) {
			link.title = link.textContent.replace(/\s+/g, ' ').trim();
			titled.add(link);
		} else if (!folded && titled.has(link)) {
			link.removeAttribute('title');
			titled.delete(link);
		}
	}
	if (folded && sidebar.closest('[data-tooltips]') === null) {
		sidebar.dataset.tooltips = '';
		opted.add(sidebar);
	} else if (!folded && opted.has(sidebar)) {
		delete sidebar.dataset.tooltips;
		opted.delete(sidebar);
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="' + COMMAND + '"][aria-controls]') : null;
	const target = button === null || event.defaultPrevented || button.disabled || button.hasAttribute('commandfor') ? null : sidebarOf(button);
	if (target !== null) {
		const signal = new Event('command', {cancelable: true});
		Object.defineProperties(signal, {command: {value: COMMAND}, source: {value: button}});
		target.dispatchEvent(signal);
	}
});

document.addEventListener('command', (event) => {
	const sidebar = event.target;
	if (event.command !== COMMAND || !(sidebar instanceof HTMLElement)) {
		return;
	}
	sidebar.toggleAttribute('data-folded');
	mark(sidebar);
	sidebar.dispatchEvent(new CustomEvent('redz:fold', {bubbles: true, detail: {folded: sidebar.hasAttribute('data-folded')}}));
}, true);

for (const button of document.querySelectorAll('button[command="' + COMMAND + '"][aria-controls]')) {
	const sidebar = sidebarOf(button);
	if (sidebar !== null) {
		mark(sidebar);
	}
}

new MutationObserver((records) => {
	for (const record of records) {
		if (record.target instanceof HTMLElement && record.target.classList.contains('app-sidebar')) {
			mark(record.target);
		}
	}
}).observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['data-folded']});
