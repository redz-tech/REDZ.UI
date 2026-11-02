// REDZ.UI, comboboxes (the WAI-ARIA combobox with a listbox): a search field role="combobox" filters the listbox it
// controls as one types — case and accents aside, every word found, the best first — and the arrow keys move the active
// option while the focus stays in the field; Enter takes it. A choice in a form: a face button shows the value and opens
// a panel with the search, the value lives in hidden fields named by the list's data-name; the palette: the same search
// in a dialog, its options links and buttons. A page that finds options itself cancels redz:filter and puts them in.
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
const marks = new Map();
let pending = '';
let made = 0;

const langOf = () => document.documentElement.lang || 'en';

/** Folds the text for matching — case, accents and Arabic vowel marks aside — with each folded unit's offset in it. */
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
const holdersOf = (list) => [...scopeOf(list).querySelectorAll('input[type="hidden"]')].filter((holder) => holder.name === list.dataset.name);
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

/** After the options changed: the first shown is active while a query stands, the empty state, the matches. */
const settle = (input) => {
	const list = listOf(input);
	const words = fold(input.value.trim()).folded.split(/\s+/).filter(Boolean);
	const shown = shownOf(list);
	untab(list);
	const empty = scopeOf(list).querySelector('.combobox-no-results');
	if (empty !== null) {
		empty.hidden = shown.length > 0 || list.getAttribute('aria-busy') === 'true';
	}
	const active = list.querySelector('[data-active]');
	activate(input, words.length > 0 ? shown.find(usable) : (shown.includes(active) ? active : null));
	highlight(list, words);
};

/** Filters the list by the search: shows what holds every word, best first within each group, the page's order back when the search is empty. */
const filter = (input) => {
	const list = listOf(input);
	const query = fold(input.value.trim()).folded.replace(/\s+/g, ' ');
	const words = query.split(' ').filter(Boolean);
	for (const box of [list, ...list.querySelectorAll('[role="group"]')]) {
		const options = [...box.querySelectorAll(':scope > ' + OPTION)];
		options.forEach((option, i) => places.has(option) || places.set(option, i));
		const ranked = options.map((option) => [option, words.length === 0 ? 0 : rankOf(option, words, query)]);
		for (const [option, rank] of ranked) {
			option.hidden = rank < 0;
		}
		const ordered = ranked.toSorted((a, b) => (words.length === 0 ? 0 : a[1] - b[1]) || places.get(a[0]) - places.get(b[0])).map(([option]) => option);
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

/** The polite status of the list's scope, made on first need. */
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

/** Says how many options the search found, once the typing pauses and the page's options have landed. */
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
		statusOf(list).textContent = input.value.trim() === '' ? '' : textCount('found', shownOf(list).length);
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

/** Draws the chips of the chosen values, each with its remove button. */
const chip = (container, list) => {
	container.replaceChildren(...holdersOf(list).map((holder) => {
		const label = holder.dataset.label || holder.value;
		const dismiss = Object.assign(document.createElement('button'), {className: 'chip-dismiss', type: 'button'});
		dismiss.dataset.value = holder.value;
		dismiss.setAttribute('aria-label', text('remove', {label}));
		const icon = Object.assign(document.createElement('i'), {className: 'bi bi-x'});
		icon.setAttribute('aria-hidden', 'true');
		dismiss.append(icon);
		const node = Object.assign(document.createElement('span'), {className: 'chip'});
		node.append(label, dismiss);
		return node;
	}));
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
		firsts.set(list, holdersOf(list).map((holder) => [holder.value, holder.dataset.label ?? '']));
	}
};

/** Writes the hidden fields: [value, label] pairs. */
const hold = (list, pairs) => {
	if (!list.dataset.name) {
		console.error('REDZ.UI: the listbox #' + list.id + ' has no data-name for its value');
		return;
	}
	for (const holder of holdersOf(list)) {
		holder.remove();
	}
	scopeOf(list).append(...pairs.map(([value, label]) => {
		const holder = Object.assign(document.createElement('input'), {type: 'hidden', name: list.dataset.name, value});
		holder.dataset.label = label;
		return holder;
	}));
	paint(list);
	for (const type of ['input', 'change']) {
		list.dispatchEvent(new Event(type, {bubbles: true}));
	}
};

/** Takes the option: a value is chosen (one closes the panel, many toggle), a link or a button is pressed. */
const choose = (option) => {
	if (!usable(option)) {
		return;
	}
	if (!isValue(option)) {
		option.click();
		return;
	}
	const list = option.closest('[role="listbox"]');
	const value = option.dataset.value;
	keepFirst(list);
	const pairs = holdersOf(list).map((holder) => [holder.value, holder.dataset.label ?? '']);
	if (list.getAttribute('aria-multiselectable') === 'true') {
		hold(list, pairs.some(([held]) => held === value) ? pairs.filter(([held]) => held !== value) : [...pairs, [value, labelOf(option)]]);
		return;
	}
	hold(list, [[value, labelOf(option)]]);
	const panel = list.closest('[popover]');
	if (panel?.matches(':popover-open')) {
		panel.hidePopover();
	}
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

/** Empties the search and shows the list as the page made it, the chosen option active. */
const fresh = (input) => {
	input.value = '';
	const list = listOf(input);
	filter(input);
	const chosen = list.querySelector(OPTION + '[aria-selected="true"]');
	if (chosen !== null && list.getAttribute('aria-multiselectable') !== 'true') {
		activate(input, chosen);
	}
	statusOf(list).textContent = '';
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

for (const face of document.querySelectorAll('.combobox-toggle')) {
	const list = document.getElementById(face.getAttribute('commandfor') || '')?.querySelector('[role="listbox"]');
	if (list) {
		paint(list);
		observer.observe(face);
	}
}

for (const input of document.querySelectorAll('input[role="combobox"]')) {
	const list = listOf(input);
	if (list !== null) {
		untab(list);
	}
}

document.addEventListener('input', (event) => {
	const input = event.target;
	if (!(input instanceof HTMLInputElement) || input.getAttribute('role') !== 'combobox' || listOf(input) === null) {
		return;
	}
	const list = listOf(input);
	aborts.get(input)?.abort();
	const controller = new AbortController();
	aborts.set(input, controller);
	const asked = new CustomEvent('redz:filter', {bubbles: true, cancelable: true, detail: {query: input.value.trim(), signal: controller.signal}});
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
	if (event.key === 'ArrowDown' && !event.altKey) {
		to = shown[at < 0 ? 0 : (at + 1) % shown.length];
	} else if (event.key === 'ArrowUp' && !event.altKey) {
		to = shown[at < 0 ? shown.length - 1 : (at - 1 + shown.length) % shown.length];
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
			hold(list, holdersOf(list).filter((holder) => holder.value !== dismiss.dataset.value).map((holder) => [holder.value, holder.dataset.label ?? '']));
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

document.addEventListener('toggle', (event) => {
	const panel = event.target;
	if (!(panel instanceof HTMLElement) || !panel.classList.contains('combobox-menu')) {
		return;
	}
	const face = document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]');
	face?.setAttribute('aria-expanded', String(event.newState === 'open'));
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
