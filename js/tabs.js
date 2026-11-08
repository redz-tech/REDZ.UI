// REDZ.UI, tabs (the WAI-ARIA tabs pattern, automatic activation): the arrow keys select the next or the previous tab
// and show its panel (mirrored right to left, up and down in a vertical list), Home and End the first and the last,
// passing over a tab hidden as js/nav-overflow.js hides one; only the selected tab takes Tab, and only its panel shows.
// A tablist with data-activation="manual" (panels that load from the server) moves only the focus by those keys; Enter
// or Space selects. Before a person's choice selects a tab, the tablist fires the cancelable redz:select (detail: tab,
// the one asked for, and from, the one being left): a page that takes it and answers with a promise - a form with
// unsaved edits asking first - has the tab selected when the promise gives true; otherwise the tab being left stays,
// with the focus. After every selection, the first one too, the tablist fires redz:selected (detail: tab).
// REDZ.ui.select(tab) chooses a tab from code as a person would, and answers a promise of whether it was selected. A
// tablist with data-hash follows the address: location.hash naming a panel, or anything inside one, selects its tab -
// at load, and when the hash changes as a person's choice that redz:select may refuse, which puts the address back;
// nested tablists too -, and a choice writes the panel's id into the address.
import {ask} from './answer.js';

const asking = new WeakSet();

const tabsOf = (list) => [...list.querySelectorAll('[role="tab"]')].filter((tab) => tab.closest('[role="tablist"]') === list && !tab.disabled && tab.getAttribute('aria-disabled') !== 'true');

/** Tells the page the tab is selected - once its scripts listen, when the library starts before they do. */
const told = (tab) => {
	const tell = () => tab.closest('[role="tablist"]')?.dispatchEvent(new CustomEvent('redz:selected', {bubbles: true, detail: {tab}}));
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', tell, {once: true});
	} else {
		tell();
	}
};

/** Selects the tab: its panel shown, the others' hidden, it alone in the tab order; a person's choice in a tablist
 *  with data-hash goes into the address. */
const select = (tab, chosen = false) => {
	const list = tab.closest('[role="tablist"]');
	for (const other of tabsOf(list)) {
		const selected = other === tab;
		other.setAttribute('aria-selected', String(selected));
		other.tabIndex = selected ? 0 : -1;
		const panel = document.getElementById(other.getAttribute('aria-controls') || '');
		if (panel !== null) {
			panel.hidden = !selected;
		}
	}
	const panel = tab.getAttribute('aria-controls') || '';
	if (chosen && list.hasAttribute('data-hash') && panel !== '') {
		history.replaceState(history.state, '', '#' + panel);
	}
	told(tab);
};

/** Selects the tab a person chose, unless the page refuses it in redz:select; a promise of whether it is selected. With
 *  write false the address stays as it is. */
const choose = (tab, write = true) => {
	const list = tab.closest('[role="tablist"]');
	const from = tabsOf(list).find((one) => one.getAttribute('aria-selected') === 'true') ?? null;
	if (from === tab || asking.has(list)) {
		return Promise.resolve(from === tab);
	}
	const [taken, answer] = ask(list, 'redz:select', {tab, from});
	if (!taken) {
		select(tab, write);
		return Promise.resolve(true);
	}
	if (answer === null) {
		return Promise.resolve(false);
	}
	asking.add(list);
	return answer.then((yes) => yes === true).catch(() => false).then((yes) => {
		asking.delete(list);
		if (yes) {
			select(tab, write);
		} else if (from !== null && list.contains(document.activeElement)) {
			from.focus();
		}
		return yes;
	});
};

/** Chooses a tab from code, as a person would: a promise of whether it is selected. */
export const selectTab = (tab) => tab?.closest('[role="tablist"]') ? choose(tab) : Promise.resolve(false);

/** The element the address names, or null. */
const named = () => {
	try {
		return location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
	} catch {
		return null;
	}
};

/** The tab of every panel of a tablist with data-hash that holds the element the address names, outermost first. */
const tabsNamed = () => {
	const tabs = [];
	for (let at = named(); at !== null; at = at.parentElement) {
		const tab = at.id === '' ? null : document.querySelector('[role="tab"][aria-controls="' + CSS.escape(at.id) + '"]');
		if (tab?.closest('[role="tablist"][data-hash]')) {
			tabs.unshift(tab);
		}
	}
	return tabs;
};

/** Selects the tabs the address names at load; answers whether it named one. */
const follow = () => {
	const tabs = tabsNamed();
	tabs.filter((tab) => tab.getAttribute('aria-selected') !== 'true').forEach((tab) => select(tab));
	return tabs.length > 0;
};

/** A new address chooses its tabs as a person would: one the page refuses puts the address back. */
const moved = async (event) => {
	let changed = false;
	for (const tab of tabsNamed()) {
		if (tab.getAttribute('aria-selected') === 'true') {
			continue;
		}
		if (!(await choose(tab, false))) {
			history.replaceState(history.state, '', event.oldURL);
			return;
		}
		changed = true;
	}
	if (changed) {
		named()?.scrollIntoView();
	}
};

for (const list of document.querySelectorAll('[role="tablist"]')) {
	const tabs = tabsOf(list);
	const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
	if (selected !== undefined) {
		select(selected);
	}
}

if (follow()) {
	named()?.scrollIntoView();
}

addEventListener('hashchange', moved);

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
	const tabs = tabsOf(list).filter((one) => !one.hidden && !('overflow' in one.dataset));
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
