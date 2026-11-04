// REDZ.UI, tabs (the WAI-ARIA tabs pattern, automatic activation): the arrow keys select the next or the previous tab
// and show its panel (mirrored right to left, up and down in a vertical list), Home and End the first and the last,
// passing over a tab hidden as js/nav-overflow.js hides one; only the selected tab takes Tab, and only its panel shows.
// A tablist with data-activation="manual" (panels that load from the server) moves only the focus by those keys; Enter
// or Space selects. Before a person's choice selects a tab, the tablist fires the cancelable redz:select (detail: tab,
// the one asked for, and from, the one being left): a page that takes it and answers with a promise - a form with
// unsaved edits asking first - has the tab selected when the promise gives true; otherwise the tab being left stays,
// with the focus.
import {ask} from './answer.js';

const asking = new WeakSet();

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

/** Selects the tab a person chose, unless the page refuses it in redz:select. */
const choose = (tab) => {
	const list = tab.closest('[role="tablist"]');
	const from = tabsOf(list).find((one) => one.getAttribute('aria-selected') === 'true') ?? null;
	if (from === tab || asking.has(list)) {
		return;
	}
	const [taken, answer] = ask(list, 'redz:select', {tab, from});
	if (!taken) {
		select(tab);
		return;
	}
	if (answer === null) {
		return;
	}
	asking.add(list);
	answer.then((yes) => yes === true).catch(() => false).then((yes) => {
		asking.delete(list);
		if (yes) {
			select(tab);
		} else if (from !== null && list.contains(document.activeElement)) {
			from.focus();
		}
	});
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
		choose(tab);
	}
});

document.addEventListener('keydown', (event) => {
	const tab = event.target instanceof Element && !event.altKey && !event.ctrlKey && !event.metaKey ? event.target.closest('[role="tab"]') : null;
	const list = tab?.closest('[role="tablist"]');
	if (!list) {
		return;
	}
	const tabs = tabsOf(list).filter((one) => !one.hidden);
	const at = tabs.indexOf(tab);
	const vertical = list.getAttribute('aria-orientation') === 'vertical';
	const rtl = getComputedStyle(list).direction === 'rtl';
	const next = vertical ? 'ArrowDown' : (rtl ? 'ArrowLeft' : 'ArrowRight');
	const previous = vertical ? 'ArrowUp' : (rtl ? 'ArrowRight' : 'ArrowLeft');
	const to = {[next]: tabs[(at + 1) % tabs.length], [previous]: tabs[(at - 1 + tabs.length) % tabs.length], Home: tabs[0], End: tabs.at(-1)}[event.key];
	if (to !== undefined && at !== -1) {
		event.preventDefault();
		to.focus();
		if (list.dataset.activation !== 'manual') {
			choose(to);
		}
	}
});
