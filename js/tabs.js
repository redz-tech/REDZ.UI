// REDZ.UI, tabs (the WAI-ARIA tabs pattern, automatic activation): the arrow keys select the next or the previous tab
// and show its panel — mirrored right to left, up and down in a vertical list — Home and End the first and the last;
// only the selected tab takes Tab, and only its panel shows. A tablist with data-activation="manual" (panels that load
// from the server) moves only the focus by those keys; Enter or Space selects.
const tabsOf = (list) => [...list.querySelectorAll('[role="tab"]')].filter((tab) => tab.closest('[role="tablist"]') === list && !tab.disabled && tab.getAttribute('aria-disabled') !== 'true');

/** Selects the tab: its panel shown, the others' hidden, it alone in the tab order. */
const select = (tab) => {
	for (const other of tabsOf(tab.closest('[role="tablist"]'))) {
		const selected = other === tab;
		other.setAttribute('aria-selected', String(selected));
		other.tabIndex = selected ? 0 : -1;
		const panel = document.getElementById(other.getAttribute('aria-controls') || '');
		if (panel !== null) {
			panel.hidden = !selected;
		}
	}
};

for (const list of document.querySelectorAll('[role="tablist"]')) {
	const tabs = tabsOf(list);
	const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
	if (selected !== undefined) {
		select(selected);
	}
}

document.addEventListener('click', (event) => {
	const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
	if (tab?.closest('[role="tablist"]') && tabsOf(tab.closest('[role="tablist"]')).includes(tab)) {
		select(tab);
	}
});

document.addEventListener('keydown', (event) => {
	const tab = event.target instanceof Element && !event.altKey && !event.ctrlKey && !event.metaKey ? event.target.closest('[role="tab"]') : null;
	const list = tab?.closest('[role="tablist"]');
	if (!list) {
		return;
	}
	const tabs = tabsOf(list);
	const at = tabs.indexOf(tab);
	const vertical = list.getAttribute('aria-orientation') === 'vertical';
	const rtl = getComputedStyle(list).direction === 'rtl';
	const next = vertical ? 'ArrowDown' : (rtl ? 'ArrowLeft' : 'ArrowRight');
	const previous = vertical ? 'ArrowUp' : (rtl ? 'ArrowRight' : 'ArrowLeft');
	const to = {[next]: tabs[(at + 1) % tabs.length], [previous]: tabs[(at - 1 + tabs.length) % tabs.length], Home: tabs[0], End: tabs.at(-1)}[event.key];
	if (to !== undefined && at !== -1) {
		event.preventDefault();
		if (list.dataset.activation !== 'manual') {
			select(to);
		}
		to.focus();
	}
});
