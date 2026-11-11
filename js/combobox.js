// REDZ.UI, comboboxes (the WAI-ARIA combobox with a listbox): a search field role="combobox" filters the listbox it
// controls as one types - case and accents aside, every word found, the best first - and the arrow keys move the active
// option while the focus stays in the field; Enter takes it. A choice in a form: a face button shows the value and opens
// a panel with the search, the value lives in hidden fields named by the list's data-name; the palette: the same search
// in a dialog, its options links and buttons. A page that finds options itself cancels redz:search and puts them in. A
// list with data-create offers "Create …" for a search no option's label equals: the page may make the value through
// redz:create (js/answer.js), else the new label goes into a hidden field data-create names. In such a list a comma
// takes the words as Enter does, and a search with a pattern or inputmode="email" - type="email" too, though
// role="combobox" belongs on type="text" - refuses words it does not hold. Options in levels (data-level: an option has
// no aria-level) keep the page's order, a match shown with its parents.
import {ask} from './answer.js';
import {text, textCount} from './text.js';

const OPTION = '[role="option"]';
const MARKS = /[\u{300}-\u{36f}\u{640}\u{64b}-\u{65f}\u{670}]/gu;
const PAGE = 10;
const PAUSE = 700;
const index = new WeakMap();
const places = new WeakMap();
const firsts = new WeakMap();
const aborts = new WeakMap();
const timers = new WeakMap();
const watchers = new WeakMap();
const waiting = new WeakSet();
const kept = new WeakSet();
const marks = new Map();
let pending = '';
let made = 0;

const langOf = () => document.documentElement.lang || 'en';

/** Folds the text for matching - case, accents and Arabic vowel marks aside - with each folded unit's offset in it. */
const fold = (source) => {
	let folded = '';
	const at = [];
	let offset = 0;
	for (const char of source) {
		const part = char.toLocaleLowerCase(langOf()).normalize('NFD').replace(MARKS, '');
		for (let i = 0; i < part.length; i++) {
			at.push(offset);
		}
		folded += part;
		offset += char.length;
	}
	at.push(offset);
	return {folded, at};
};

/** The option's label: its text without its description. */
const labelOf = (option) => {
	if (option.dataset.label) {
		return option.dataset.label;
	}
	let label = '';
	const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		if (walker.currentNode.parentElement.closest('.menu-item-description, [aria-hidden="true"]') === null) {
			label += walker.currentNode.data;
		}
	}
	return label.trim().replace(/\s+/g, ' ');
};

/** What the filter knows of an option, kept while its text stays. */
const indexOf = (option) => {
	const source = option.textContent;
	let entry = index.get(option);
	if (entry === undefined || entry.source !== source) {
		const {folded, at} = fold(source);
		const words = new Intl.Segmenter(langOf(), {granularity: 'word'}).segment(folded);
		entry = {source, folded, at, starts: new Set([...words].filter((word) => word.isWordLike).map((word) => word.index)), keys: fold(option.dataset.keywords || '').folded};
		index.set(option, entry);
	}
	return entry;
};

/** How well the option answers the words: 0 its text is the query, 1 starts with it, 2 a word does, 3 holds it, 4 its keywords do; -1 not at all. */
const rankOf = (option, words, query) => {
	const {folded, starts, keys} = indexOf(option);
	if (!words.every((word) => folded.includes(word) || keys.includes(word))) {
		return -1;
	}
	if (folded.trim().replace(/\s+/g, ' ') === query) {
		return 0;
	}
	const first = folded.indexOf(words[0]);
	if (first < 0) {
		return 4;
	}
	if (first === folded.length - folded.trimStart().length) {
		return 1;
	}
	for (let at = first; at >= 0; at = folded.indexOf(words[0], at + 1)) {
		if (starts.has(at)) {
			return 2;
		}
	}
	return 3;
};

const listOf = (input) => document.getElementById(input.getAttribute('aria-controls') || '');
const searchOf = (list) => document.querySelector('input[role="combobox"][aria-controls="' + CSS.escape(list.id) + '"]');
const scopeOf = (list) => list.closest('[popover], dialog') ?? list.parentElement;
const faceOf = (list) => {
	const panel = list.closest('[popover]');
	return panel === null ? null : document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]');
};
const optionsOf = (list) => [...list.querySelectorAll(OPTION)];
const shownOf = (list) => optionsOf(list).filter((option) => !option.hidden && option.closest('[role="group"]')?.hidden !== true);
const holdersOf = (list) => [...scopeOf(list).querySelectorAll('input[type="hidden"]')].filter((holder) => holder.name === list.dataset.name || ('create' in list.dataset && holder.name === list.dataset.create));
const pairsOf = (list) => holdersOf(list).map((holder) => [holder.value, holder.dataset.label ?? '', holder.name !== list.dataset.name]);
const isValue = (option) => 'value' in option.dataset;
const usable = (option) => option.getAttribute('aria-disabled') !== 'true';

/** Makes the option the active one: marked, named by the search's aria-activedescendant, scrolled into the list's view. */
const activate = (input, option) => {
	const list = listOf(input);
	for (const other of list.querySelectorAll('[data-active]')) {
		other.removeAttribute('data-active');
	}
	if (option === null || option === undefined) {
		input.removeAttribute('aria-activedescendant');
		return;
	}
	if (option.id === '') {
		option.id = (list.id || 'redz-list') + '-option-' + (++made);
	}
	option.setAttribute('data-active', '');
	input.setAttribute('aria-activedescendant', option.id);
	option.scrollIntoView({block: 'nearest'});
};

/** Paints the matches of the words in the shown options, where the browser has highlights. */
const highlight = (list, words) => {
	if (!('highlights' in CSS)) {
		return;
	}
	const ranges = [];
	for (const option of words.length === 0 ? [] : shownOf(list)) {
		const {folded, at} = indexOf(option);
		for (const word of words) {
			const found = folded.indexOf(word);
			if (found < 0) {
				continue;
			}
			const start = at[found];
			const end = at[found + word.length];
			const range = new Range();
			let seen = 0;
			const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode;
				if (seen + node.length > start && range.startContainer === document) {
					range.setStart(node, start - seen);
				}
				if (seen + node.length >= end) {
					range.setEnd(node, end - seen);
					break;
				}
				seen += node.length;
			}
			ranges.push(range);
		}
	}
	marks.set(list, ranges);
	for (const known of marks.keys()) {
		if (!known.isConnected) {
			marks.delete(known);
		}
	}
	CSS.highlights.set('redz-match', new Highlight(...[...marks.values()].flat()));
};

/** Keeps the list's link and button options out of the Tab order: the arrow keys reach them. */
const untab = (list) => {
	for (const option of list.querySelectorAll('a[href][role="option"], button[role="option"]')) {
		option.tabIndex = -1;
	}
};

/** Keeps the list's own last option, "Create “…”", while the search's words are no option's label nor a chosen one. */
const offer = (input) => {
	const list = listOf(input);
	if (!('create' in list.dataset)) {
		return;
	}
	const label = input.value.trim().replace(/\s+/g, ' ');
	const folded = fold(label).folded;
	let option = list.querySelector(':scope > .combobox-create');
	const taken = label === '' || list.getAttribute('aria-busy') === 'true' || optionsOf(list).some((other) => other !== option && fold(labelOf(other)).folded === folded) || labelsOf(list).some((held) => fold(held).folded === folded);
	if (taken) {
		option?.remove();
		return;
	}
	if (option === null) {
		option = Object.assign(document.createElement('div'), {className: 'menu-item combobox-create', id: (list.id || 'redz-list') + '-create'});
		option.setAttribute('role', 'option');
		list.append(option);
	}
	const icon = Object.assign(document.createElement('i'), {className: 'bi bi-plus-lg'});
	icon.setAttribute('aria-hidden', 'true');
	option.dataset.label = label;
	option.replaceChildren(icon, text('create', {label}));
};

/** After the options changed: "Create …" offered or not, the first shown active while a query stands, the empty state,
 *  the matches. */
const settle = (input) => {
	offer(input);
	const list = listOf(input);
	const words = fold(input.value.trim()).folded.split(/\s+/).filter(Boolean);
	const shown = shownOf(list);
	untab(list);
	const empty = scopeOf(list).querySelector('.combobox-no-results');
	if (empty !== null) {
		empty.hidden = shown.length > 0 || list.getAttribute('aria-busy') === 'true';
	}
	const active = list.querySelector('[data-active]');
	activate(input, words.length > 0 ? shown.find((option) => usable(option) && !kept.has(option)) : (shown.includes(active) ? active : null));
	highlight(list, words);
};

/** Shows the parents of each shown option of a list in levels - the nearest option before it of a lower data-level, up
 *  to the first level - so a match keeps its place in the tree. */
const keepAncestors = (options) => {
	const levelOf = (option) => Number.parseInt(option.dataset.level ?? '1', 10) || 1;
	const matched = options.filter((option) => !option.hidden);
	for (const option of options) {
		kept.delete(option);
	}
	for (const option of matched) {
		let need = levelOf(option) - 1;
		for (let i = options.indexOf(option) - 1; i >= 0 && need > 0; i--) {
			if (levelOf(options[i]) <= need) {
				if (options[i].hidden) {
					options[i].hidden = false;
					kept.add(options[i]);
				}
				need = levelOf(options[i]) - 1;
			}
		}
	}
};

/** Filters the list by the search: shows what holds every word, best first within each group, the page's order back
 *  when the search is empty; a list in levels keeps the page's order, each match with its parents. */
const filter = (input) => {
	const list = listOf(input);
	const query = fold(input.value.trim()).folded.replace(/\s+/g, ' ');
	const words = query.split(' ').filter(Boolean);
	for (const box of [list, ...list.querySelectorAll('[role="group"]')]) {
		const options = [...box.querySelectorAll(':scope > ' + OPTION + ':not(.combobox-create)')];
		options.forEach((option, i) => places.has(option) || places.set(option, i));
		const ranked = options.map((option) => [option, words.length === 0 ? 0 : rankOf(option, words, query)]);
		for (const [option, rank] of ranked) {
			option.hidden = rank < 0;
		}
		const levelled = options.some((option) => option.hasAttribute('data-level'));
		if (levelled) {
			keepAncestors(options);
		}
		const ordered = levelled ? options : ranked.toSorted((a, b) => (words.length === 0 ? 0 : a[1] - b[1]) || places.get(a[0]) - places.get(b[0])).map(([option]) => option);
		if (ordered.some((option, i) => option !== options[i])) {
			const before = options[0].previousSibling;
			if (before === null) {
				box.prepend(...ordered);
			} else {
				before.after(...ordered);
			}
		}
		if (box !== list) {
			box.hidden = ranked.every(([, rank]) => rank < 0);
		}
	}
	settle(input);
};

/** The polite status of the list's scope, made on first need - when its search takes the focus, before anything is
 *  said: a region made with its words says nothing. */
const statusOf = (list) => {
	const scope = scopeOf(list);
	let status = scope.querySelector(':scope > .combobox-status');
	if (status === null) {
		status = Object.assign(document.createElement('div'), {className: 'combobox-status visually-hidden'});
		status.setAttribute('role', 'status');
		scope.append(status);
	}
	return status;
};

/** Once the typing pauses and the page's options have landed, says politely the option Enter would take - a screen
 *  reader, busy with the typed keys, says nothing of it - or, with none, the count found. */
const announce = (input) => {
	clearTimeout(timers.get(input));
	timers.set(input, setTimeout(() => {
		const list = listOf(input);
		if (list === null) {
			return;
		}
		if (list.getAttribute('aria-busy') === 'true') {
			announce(input);
			return;
		}
		const active = list.querySelector('[data-active]');
		statusOf(list).textContent = input.value.trim() === '' ? '' : (active === null ? textCount('found', shownOf(list).length) : labelOf(active));
	}, PAUSE));
};

/** The chosen options' labels, from the hidden fields. */
const labelsOf = (list) => holdersOf(list).map((holder) => holder.dataset.label || holder.value);

/** Writes the face's value: the label; for many, the language's own list while it fits, else the first ones and +N. */
const fit = (face, list) => {
	const value = face.querySelector('.combobox-value');
	if (value === null) {
		return;
	}
	let more = face.querySelector('.combobox-more');
	const labels = list.dataset.chips ? [] : labelsOf(list);
	if (labels.length < 2) {
		value.textContent = labels[0] ?? '';
		more?.remove();
		return;
	}
	const lang = langOf();
	value.textContent = new Intl.ListFormat(lang, {type: 'conjunction'}).format(labels);
	more?.remove();
	if (value.scrollWidth <= value.clientWidth) {
		return;
	}
	const comma = new Intl.ListFormat(lang, {type: 'conjunction', style: 'narrow'}).formatToParts(['a', 'b', 'c', 'd']).find((part) => part.type === 'literal').value;
	more = Object.assign(document.createElement('span'), {className: 'badge badge-subtle-secondary combobox-more'});
	value.after(more);
	for (let shown = labels.length - 1; shown >= 1; shown--) {
		value.textContent = labels.slice(0, shown).join(comma);
		more.textContent = new Intl.NumberFormat(lang, {signDisplay: 'always'}).format(labels.length - shown);
		if (value.scrollWidth <= value.clientWidth) {
			return;
		}
	}
};

/** A chip of the label with its remove button, which holds the value: a span, or a list's item. */
export const chipOf = (label, value, tag = 'span') => {
	const dismiss = Object.assign(document.createElement('button'), {className: 'chip-dismiss', type: 'button'});
	dismiss.dataset.value = value;
	dismiss.setAttribute('aria-label', text('remove', {label}));
	const icon = Object.assign(document.createElement('i'), {className: 'bi bi-x'});
	icon.setAttribute('aria-hidden', 'true');
	dismiss.append(icon);
	const node = Object.assign(document.createElement(tag), {className: 'chip'});
	node.append(label, dismiss);
	return node;
};

/** Draws the chips of the chosen values, each with its remove button. */
const chip = (container, list) => {
	container.replaceChildren(...holdersOf(list).map((holder) => chipOf(holder.dataset.label || holder.value, holder.value)));
	container.hidden = container.childElementCount === 0;
};

/** Shows the chosen values everywhere: the options' aria-selected, the face, the chips. */
const paint = (list) => {
	const chosen = new Set(holdersOf(list).map((holder) => holder.value));
	for (const option of optionsOf(list)) {
		if (isValue(option)) {
			option.setAttribute('aria-selected', String(chosen.has(option.dataset.value)));
		}
	}
	const face = faceOf(list);
	if (face !== null) {
		fit(face, list);
	}
	const chips = list.dataset.chips ? document.getElementById(list.dataset.chips) : null;
	if (chips !== null) {
		chip(chips, list);
	}
};

/** Keeps the hidden fields as the page sent them, for the form's reset. */
const keepFirst = (list) => {
	if (!firsts.has(list)) {
		firsts.set(list, pairsOf(list));
	}
};

/** Writes the hidden fields: [value, label, made here] - a value made here goes into the field data-create names. */
const hold = (list, pairs) => {
	if (!list.dataset.name) {
		console.error('REDZ.UI: the listbox #' + list.id + ' has no data-name for its value');
		return;
	}
	for (const holder of holdersOf(list)) {
		holder.remove();
	}
	scopeOf(list).append(...pairs.map(([value, label, made]) => {
		const holder = Object.assign(document.createElement('input'), {type: 'hidden', name: made ? list.dataset.create : list.dataset.name, value});
		holder.dataset.label = label;
		return holder;
	}));
	paint(list);
	for (const type of ['input', 'change']) {
		list.dispatchEvent(new Event(type, {bubbles: true}));
	}
};

/** Takes the option: a value is chosen - many toggle; one closes the panel a frame later, so the button's new value
 *  reaches a screen reader before the focus does - a link or a button is pressed. */
const choose = (option) => {
	if (!usable(option)) {
		return;
	}
	if (option.classList.contains('combobox-create')) {
		create(option);
		return;
	}
	if (!isValue(option)) {
		option.click();
		return;
	}
	const list = option.closest('[role="listbox"]');
	const value = option.dataset.value;
	keepFirst(list);
	const pairs = pairsOf(list);
	if (list.getAttribute('aria-multiselectable') === 'true') {
		hold(list, pairs.some(([held, , made]) => held === value && !made) ? pairs.filter(([held, , made]) => held !== value || made) : [...pairs, [value, labelOf(option), false]]);
		return;
	}
	hold(list, [[value, labelOf(option), false]]);
	settled(list);
};

/** A single choice's panel closes a frame after its value is written, so the button's new value reaches a screen
 *  reader before the focus does. */
const settled = (list) => {
	const panel = list.closest('[popover]');
	if (panel?.matches(':popover-open') && list.getAttribute('aria-multiselectable') !== 'true') {
		requestAnimationFrame(() => setTimeout(() => panel.matches(':popover-open') && panel.hidePopover()));
	}
};

/** Says the words in the list's status after the next frame: a status emptied and filled again in one task says
 *  nothing. */
const sayLater = (list, words) => requestAnimationFrame(() => setTimeout(() => {
	statusOf(list).textContent = words;
}));

/** Takes "Create “…”": redz:create asks the page, which may answer {value, label} - an option of the list from then on,
 *  chosen - or reject with words the status says; left alone, the label is held in the field data-create names. The
 *  search empties for the next one, and a list of many, its panel still open, says the new label politely. */
const create = (option) => {
	const list = option.closest('[role="listbox"]');
	const input = searchOf(list);
	const label = option.dataset.label;
	const many = list.getAttribute('aria-multiselectable') === 'true';
	if (input?.validity.patternMismatch || input?.validity.typeMismatch || (input?.inputMode === 'email' && !Object.assign(document.createElement('input'), {type: 'email', value: label}).validity.valid)) {
		input.setAttribute('aria-invalid', 'true');
		sayLater(list, text('chip.invalid', {label}));
		return;
	}
	const [taken, answer] = ask(list, 'redz:create', {label});
	if (taken && answer === null) {
		return;
	}
	keepFirst(list);
	if (!taken) {
		hold(list, [...(many ? pairsOf(list) : []), [label, label, true]]);
		fresh(input);
		settled(list);
		if (many) {
			sayLater(list, label);
		}
		return;
	}
	list.setAttribute('aria-busy', 'true');
	answer.then((answered) => {
		const made = typeof answered === 'object' && answered !== null ? answered : {value: answered};
		list.removeAttribute('aria-busy');
		const added = Object.assign(document.createElement('div'), {className: 'menu-item', textContent: made.label ?? label});
		added.setAttribute('role', 'option');
		added.dataset.value = String(made.value ?? label);
		list.append(added);
		fresh(input);
		choose(added);
		if (many) {
			sayLater(list, added.textContent);
		}
	}, (words) => {
		list.removeAttribute('aria-busy');
		input.setAttribute('aria-invalid', 'true');
		statusOf(list).textContent = String(words ?? '');
	});
};

/** Watches the list while the page fills it: its options landing, or aria-busy="false", end the wait. */
const watch = (list, input) => {
	if (watchers.has(list)) {
		return;
	}
	const watcher = new MutationObserver((records) => {
		if (!waiting.has(list) || !(records.some((record) => record.type === 'childList') || list.getAttribute('aria-busy') === 'false')) {
			return;
		}
		waiting.delete(list);
		list.setAttribute('aria-busy', 'false');
		paint(list);
		settle(input);
	});
	watcher.observe(list, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy']});
	watchers.set(list, watcher);
};

/** Ends the list's wait for the page: the search aborted, the watcher gone, the busy mark off. */
const unwatch = (list, input) => {
	aborts.get(input)?.abort();
	watchers.get(list)?.disconnect();
	watchers.delete(list);
	waiting.delete(list);
	list.removeAttribute('aria-busy');
};

/** Empties the search and shows the list as the page made it, no option active: a screen reader names the search. */
const fresh = (input) => {
	input.value = '';
	filter(input);
	statusOf(listOf(input)).textContent = '';
};

const observer = new ResizeObserver((entries) => {
	for (const entry of entries) {
		const panel = document.getElementById(entry.target.getAttribute('commandfor') || '');
		const list = panel?.querySelector('[role="listbox"]');
		if (list) {
			fit(entry.target, list);
		}
	}
});

const started = new WeakSet();

/** Draws every face and fits it to its width, and takes the options out of the Tab order, once each: at load, and for a
 *  combobox that lands later. */
const start = () => {
	for (const face of document.querySelectorAll('.combobox-toggle')) {
		const list = document.getElementById(face.getAttribute('commandfor') || '')?.querySelector('[role="listbox"]');
		if (list && !started.has(face)) {
			started.add(face);
			paint(list);
			observer.observe(face);
		}
	}
	for (const input of document.querySelectorAll('input[role="combobox"]')) {
		const list = listOf(input);
		if (list !== null && !started.has(input)) {
			started.add(input);
			untab(list);
		}
	}
};
start();
new MutationObserver((records) => {
	const landed = records.some((record) => [...record.addedNodes].some((node) => node instanceof Element && (node.matches('.combobox-toggle, input[role="combobox"], [role="listbox"]') || node.querySelector('.combobox-toggle, input[role="combobox"]') !== null)));
	if (landed) {
		start();
	}
}).observe(document.documentElement, {childList: true, subtree: true});

document.addEventListener('input', (event) => {
	const input = event.target;
	if (!(input instanceof HTMLInputElement) || input.getAttribute('role') !== 'combobox' || listOf(input) === null) {
		return;
	}
	const list = listOf(input);
	input.removeAttribute('aria-invalid');
	aborts.get(input)?.abort();
	const controller = new AbortController();
	aborts.set(input, controller);
	const asked = new CustomEvent('redz:search', {bubbles: true, cancelable: true, detail: {query: input.value.trim(), signal: controller.signal}});
	if (input.dispatchEvent(asked)) {
		waiting.delete(list);
		list.removeAttribute('aria-busy');
		filter(input);
	} else {
		waiting.add(list);
		list.setAttribute('aria-busy', 'true');
		watch(list, input);
		settle(input);
	}
	announce(input);
});

document.addEventListener('keydown', (event) => {
	const target = event.target;
	if (target instanceof HTMLButtonElement && target.classList.contains('combobox-toggle')) {
		const panel = document.getElementById(target.getAttribute('commandfor') || '');
		const opens = event.key === 'ArrowDown' || event.key === 'ArrowUp' || (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey);
		if (panel !== null && opens && !panel.matches(':popover-open')) {
			event.preventDefault();
			pending = event.key.length === 1 ? event.key : '';
			target.click();
		}
		return;
	}
	if (!(target instanceof HTMLInputElement) || target.getAttribute('role') !== 'combobox' || listOf(target) === null) {
		return;
	}
	const list = listOf(target);
	const shown = shownOf(list).filter(usable);
	const at = shown.indexOf(list.querySelector('[data-active]'));
	let to = null;
	const chosen = list.getAttribute('aria-multiselectable') === 'true' ? -1 : shown.indexOf(list.querySelector(OPTION + '[aria-selected="true"]'));
	if (event.key === 'ArrowDown' && !event.altKey) {
		to = shown[at < 0 ? Math.max(0, chosen) : (at + 1) % shown.length];
	} else if (event.key === 'ArrowUp' && !event.altKey) {
		to = shown[at < 0 ? (chosen < 0 ? shown.length - 1 : chosen) : (at - 1 + shown.length) % shown.length];
	} else if (event.key === 'PageDown') {
		to = shown[Math.min(shown.length - 1, Math.max(0, at) + PAGE)];
	} else if (event.key === 'PageUp') {
		to = shown[Math.max(0, at - PAGE)];
	} else if (event.key === 'Enter' && !event.isComposing) {
		event.preventDefault();
		const active = list.querySelector('[data-active]');
		if (active !== null) {
			choose(active);
		}
		return;
	} else if (event.key === ',' && 'create' in list.dataset && !event.isComposing) {
		event.preventDefault();
		const pick = list.querySelector(':scope > .combobox-create') ?? list.querySelector('[data-active]');
		if (pick !== null) {
			choose(pick);
		} else if (target.value.trim() !== '') {
			fresh(target);
		}
		return;
	} else if (event.key === 'Escape') {
		const layer = target.value === '' ? scopeOf(list) : null;
		if (layer !== null && !layer.matches('[popover], dialog')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (layer === null) {
			target.value = '';
			target.dispatchEvent(new Event('input', {bubbles: true}));
		} else if (layer.localName !== 'dialog') {
			layer.hidePopover();
		} else if (typeof layer.requestClose === 'function') {
			layer.requestClose();
		} else if (layer.dispatchEvent(new Event('cancel', {cancelable: true}))) {
			layer.close();
		}
		return;
	}
	if (to !== null && to !== undefined) {
		event.preventDefault();
		clearTimeout(timers.get(target));
		activate(target, to);
	}
}, true);

document.addEventListener('mousedown', (event) => {
	if (event.target instanceof Element && event.target.closest('[role="listbox"] ' + OPTION) && searchOf(event.target.closest('[role="listbox"]')) !== null) {
		event.preventDefault();
	}
});

document.addEventListener('pointermove', (event) => {
	const option = event.target instanceof Element ? event.target.closest(OPTION) : null;
	const list = option?.closest('[role="listbox"]');
	const input = list ? searchOf(list) : null;
	if (input !== null && input !== undefined && usable(option) && !option.hasAttribute('data-active')) {
		activate(input, option);
	}
});

document.addEventListener('click', (event) => {
	const target = event.target instanceof Element ? event.target : null;
	const dismiss = target?.closest('.chip-dismiss[data-value]');
	const box = dismiss?.closest('.combobox-chips');
	if (box) {
		const list = document.querySelector('[role="listbox"][data-chips="' + CSS.escape(box.id) + '"]');
		if (list !== null) {
			const at = [...box.children].indexOf(dismiss.closest('.chip'));
			keepFirst(list);
			hold(list, pairsOf(list).filter((pair, i) => i !== at));
			(box.children[Math.min(at, box.childElementCount - 1)]?.querySelector('.chip-dismiss') ?? faceOf(list))?.focus();
		}
		return;
	}
	const option = target?.closest(OPTION);
	if (option?.closest('[role="listbox"]') && isValue(option)) {
		choose(option);
	}
});

document.addEventListener('click', (event) => {
	const option = event.target instanceof Element ? event.target.closest(OPTION) : null;
	const dialog = option?.closest('[role="listbox"]') ? option.closest('dialog') : null;
	if (dialog?.open && !isValue(option) && usable(option)) {
		dialog.close();
	}
}, true);

/** The button of a combobox's panel says the state the panel goes into before it does: a closing panel hands the focus
 *  back to the button at once, and a screen reader takes the button as it finds it then. */
document.addEventListener('beforetoggle', (event) => {
	const panel = event.target;
	if (!(panel instanceof HTMLElement) || !panel.classList.contains('combobox-menu')) {
		return;
	}
	const face = document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]');
	face?.setAttribute('aria-expanded', String(event.newState === 'open'));
	if (event.newState === 'open') {
		face?.setAttribute('aria-controls', panel.id);
	} else {
		face?.removeAttribute('aria-controls');
	}
}, true);

document.addEventListener('toggle', (event) => {
	const panel = event.target;
	if (!(panel instanceof HTMLElement) || !panel.classList.contains('combobox-menu')) {
		return;
	}
	const face = document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]');
	const input = panel.querySelector('input[role="combobox"]');
	const list = input === null ? null : listOf(input);
	if (list === null) {
		return;
	}
	if (event.newState === 'open') {
		fresh(input);
		if (pending !== '') {
			input.value = pending;
			pending = '';
			input.dispatchEvent(new Event('input', {bubbles: true}));
		}
	} else {
		unwatch(list, input);
		if (face !== null) {
			fit(face, list);
		}
	}
}, true);

document.addEventListener('focusin', (event) => {
	const list = event.target instanceof HTMLInputElement && event.target.matches('[role="combobox"]') ? listOf(event.target) : null;
	if (list !== null) {
		statusOf(list);
	}
});

document.addEventListener('focusout', (event) => {
	const panel = event.target instanceof Element ? event.target.closest('.combobox-menu:popover-open') : null;
	const to = event.relatedTarget;
	if (panel !== null && to instanceof Node && !panel.contains(to) && to !== document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]')) {
		panel.hidePopover();
	}
});

document.addEventListener('close', (event) => {
	const input = event.target instanceof HTMLDialogElement ? event.target.querySelector('input[role="combobox"]') : null;
	if (input !== null && listOf(input) !== null) {
		unwatch(listOf(input), input);
		fresh(input);
	}
}, true);

/** Sets what a list holds from the page, as a choice does: its fields, its face, then input and change. */
export const setList = (target, values) => {
	const list = typeof target === 'string' ? document.querySelector(target) : target;
	if (!(list instanceof HTMLElement)) {
		throw new TypeError('REDZ.ui.combobox.set: no list ' + String(target));
	}
	keepFirst(list);
	const held = pairsOf(list);
	const wanted = [values].flat().map(String).filter((value) => value !== '');
	hold(list, (list.getAttribute('aria-multiselectable') === 'true' ? wanted : wanted.slice(0, 1)).map((value) => {
		const option = [...list.querySelectorAll('[role="option"]')].find((one) => one.dataset.value === value);
		return option === undefined ? held.find(([one]) => one === value) ?? [value, value, 'create' in list.dataset] : [value, labelOf(option), false];
	}));
};

document.addEventListener('reset', (event) => {
	const form = event.target;
	setTimeout(() => {
		for (const list of form.querySelectorAll('[role="listbox"][data-name]')) {
			if (firsts.has(list)) {
				hold(list, firsts.get(list));
			}
		}
	});
});
