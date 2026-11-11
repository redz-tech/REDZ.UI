// REDZ.UI, chips fields for typed values: a .chip-input box holds one input[type=hidden], the field's truth - its
// values joined by data-chips-join, a comma by default - and draws each value as a chip of a role="list" before its
// entry, an input.form-ghost of any type. Enter, the separator typed in the entry, or a button with command="--add" and
// aria-controls naming the entry takes it by the entry's own checks - min, max, step, pattern, type - and refuses a
// value held already and one past data-chips-max: the entry turns aria-invalid and keeps its text, the words stand in
// an error line after the box, joined by aria-describedby, and are said at once. data-chips-order="ascending" or
// "descending" sorts the values - numbers as numbers in a number entry, words in the page's language - else they stay
// as typed. A chip's label is the text of the entry's datalist option of its value, else the value. Its remove button,
// in the Tab order, takes it away by a click, Delete or Backspace - Backspace in the entry never does - and the focus
// goes to the next chip, else to the entry; added and removed are said politely. Each change writes the hidden value
// and fires input and change on it, and the chips are drawn again from it at load, for a box that lands later, on its
// own input or change from outside - a tracked form's Discard - and when a script sets it; the form's reset puts back
// the values the box came with. Enter in the entry never sends the form; the remove buttons and the --add button follow
// the entry's disabled.
import {chipOf} from './combobox.js';
import {announce} from './say.js';
import {text, textCount} from './text.js';

const BOX = '.chip-input';
const ENTRY = BOX + ' > .form-ghost';
const drawn = new WeakMap();
// The value each box's hidden field came with, for the form's reset.
const firsts = new WeakMap();
const lines = new WeakMap();
let made = 0;

const lang = () => document.documentElement.lang || 'en';
const hiddenOf = (box) => box.querySelector(':scope > input[type="hidden"]');
const entryOf = (box) => box.querySelector(':scope > .form-ghost');
const joinOf = (box) => box.dataset.chipsJoin || ',';
const nameOf = (entry) => entry.labels?.[0]?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/** The values the hidden field holds, in its order. */
const valuesOf = (box) => hiddenOf(box).value.split(joinOf(box)).map((value) => value.trim()).filter((value) => value !== '');

/** A value's label: the text of the entry's datalist option of that value, else the option's label, else the value. */
const labelOf = (entry, value) => {
	const option = [...(entry.list?.options ?? [])].find((one) => one.value === value);
	return option?.text || option?.label || value;
};

/** What the box is drawn from: its value and whether its entry is disabled. */
const keyOf = (box) => hiddenOf(box).value + '\n' + entryOf(box).matches(':disabled');

/** Draws the box's chips from its hidden value, named by the entry's label; the remove buttons and the + button follow
 *  the entry's disabled. */
const draw = (box) => {
	const entry = entryOf(box);
	const off = entry.matches(':disabled');
	let list = box.querySelector(':scope > .chip-list');
	if (list === null) {
		list = Object.assign(document.createElement('ul'), {className: 'chip-list'});
		list.setAttribute('role', 'list');
		entry.before(list);
	}
	list.replaceChildren(...valuesOf(box).map((value) => {
		const chip = chipOf(labelOf(entry, value), value, 'li');
		chip.lastChild.disabled = off;
		return chip;
	}));
	list.hidden = list.childElementCount === 0;
	const name = nameOf(entry);
	if (name !== '') {
		list.setAttribute('aria-label', name);
	}
	for (const add of box.querySelectorAll('[command="--add"]')) {
		if (off) {
			add.setAttribute('aria-disabled', 'true');
		} else {
			add.removeAttribute('aria-disabled');
		}
	}
	drawn.set(box, keyOf(box));
};

/** Draws the box again when its value or its entry's disabled changed since it was last drawn. */
const refresh = (box) => {
	if (hiddenOf(box) !== null && entryOf(box) !== null && drawn.get(box) !== keyOf(box)) {
		if (!firsts.has(box)) {
			firsts.set(box, valuesOf(box));
		}
		draw(box);
	}
};

/** Puts the id first in the entry's aria-describedby, or takes it out. */
const describe = (entry, id, on) => {
	const ids = (entry.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((one) => one !== '' && one !== id);
	if (on) {
		ids.unshift(id);
	}
	if (ids.length > 0) {
		entry.setAttribute('aria-describedby', ids.join(' '));
	} else {
		entry.removeAttribute('aria-describedby');
	}
};

/** Refuses the entry: aria-invalid, the words in the error line after the box, said at once. */
const refuse = (box, words) => {
	const entry = entryOf(box);
	let line = lines.get(box);
	if (line === undefined || !line.isConnected) {
		line = Object.assign(document.createElement('div'), {className: 'invalid-feedback', id: 'redz-chips-' + ++made});
		lines.set(box, line);
		box.after(line);
		describe(entry, line.id, true);
	}
	const icon = Object.assign(document.createElement('i'), {className: 'bi bi-exclamation-triangle-fill'});
	icon.setAttribute('aria-hidden', 'true');
	line.replaceChildren(icon, words);
	entry.setAttribute('aria-invalid', 'true');
	announce(words, true);
};

/** Takes the entry's refusal away: its mark and its error line. */
const unrefuse = (box) => {
	const entry = entryOf(box);
	const line = lines.get(box);
	entry.removeAttribute('aria-invalid');
	if (line !== undefined) {
		describe(entry, line.id, false);
		line.remove();
		lines.delete(box);
	}
};

/** Writes the values into the hidden field and draws them, the refusal gone, then input and change on it. */
const write = (box, values) => {
	const hidden = hiddenOf(box);
	hidden.value = values.join(joinOf(box));
	draw(box);
	unrefuse(box);
	for (const type of ['input', 'change']) {
		hidden.dispatchEvent(new Event(type, {bubbles: true}));
	}
};

/** Takes what the entry holds - each part between separators in turn - until one is refused, which stays in the entry
 *  with the parts after it. */
const take = (entry) => {
	const box = entry.closest(BOX);
	const join = joinOf(box);
	const parts = entry.validity.badInput ? [''] : entry.value.split(join).map((part) => part.trim()).filter((part) => part !== '');
	const values = valuesOf(box);
	const max = Number.parseInt(box.dataset.chipsMax, 10);
	const collator = new Intl.Collator(lang(), {numeric: true, sensitivity: 'base'});
	const added = [];
	let words = '';
	let at = 0;
	for (; at < parts.length; at++) {
		if (parts.length > 1) {
			entry.value = parts[at];
		}
		const value = entry.type === 'number' && entry.value !== '' ? String(entry.valueAsNumber) : parts[at];
		const label = labelOf(entry, value);
		words = !entry.validity.valid ? text('chip.invalid', {label: parts[at] || nameOf(entry)}) : values.some((one) => collator.compare(one, value) === 0) ? text('chip.held', {label}) : values.length >= max ? textCount('chip.full', max) : '';
		if (words !== '') {
			break;
		}
		values.push(value);
		added.push(label);
	}
	if (added.length > 0) {
		const way = {ascending: 1, descending: -1}[box.dataset.chipsOrder] ?? 0;
		write(box, way === 0 ? values : values.sort((a, b) => way * (entry.type === 'number' ? a - b : collator.compare(a, b))));
		announce(text('chip.added', {label: new Intl.ListFormat(lang(), {type: 'conjunction'}).format(added)}));
	}
	if (words === '' || parts.length > 1) {
		entry.value = parts.slice(at).join(join);
	}
	if (words !== '') {
		refuse(box, words);
	}
};

/** Takes the remove button's chip away and says so; the focus goes to the next chip's button, else to the entry. */
const remove = (button) => {
	const box = button.closest(BOX);
	const at = [...box.querySelectorAll('.chip-dismiss')].indexOf(button);
	const values = valuesOf(box);
	const gone = values.indexOf(button.dataset.value);
	write(box, values.filter((value, i) => i !== gone));
	(box.querySelectorAll('.chip-dismiss')[at] ?? entryOf(box)).focus();
	announce(text('chip.removed', {label: labelOf(entryOf(box), button.dataset.value)}));
};

const start = () => document.querySelectorAll(BOX).forEach(refresh);
start();
new MutationObserver(start).observe(document.documentElement, {childList: true, subtree: true, attributeFilter: ['disabled', 'value']});

document.addEventListener('keydown', (event) => {
	const target = event.target;
	const box = target instanceof HTMLElement && !event.isComposing ? target.closest(BOX) : null;
	if (box === null) {
		return;
	}
	if (target.matches('.chip-dismiss') && (event.key === 'Delete' || event.key === 'Backspace')) {
		event.preventDefault();
		remove(target);
	} else if (target === entryOf(box) && (event.key === 'Enter' || event.key === joinOf(box))) {
		event.preventDefault();
		take(target);
	}
});

document.addEventListener('click', (event) => {
	const target = event.target instanceof Element ? event.target : null;
	const dismiss = target?.closest(BOX + ' .chip-dismiss');
	const add = target?.closest('button[command="--add"][aria-controls]');
	const entry = add === null || add === undefined || event.defaultPrevented || add.hasAttribute('commandfor') || add.getAttribute('aria-disabled') === 'true' ? null : document.getElementById(add.getAttribute('aria-controls').trim());
	if (dismiss) {
		remove(dismiss);
	} else if (entry?.matches(ENTRY) && !entry.matches(':disabled')) {
		take(entry);
		entry.focus();
	} else if (target?.matches(BOX)) {
		entryOf(target)?.focus();
	}
});

/** A change of the hidden field from outside draws the chips again; typing in the entry takes its refusal away. */
const follow = (event) => {
	const target = event.target;
	const box = target instanceof HTMLInputElement ? target.closest(BOX) : null;
	if (box !== null && target === hiddenOf(box)) {
		refresh(box);
	} else if (box !== null && event.type === 'input' && target === entryOf(box)) {
		unrefuse(box);
	}
};
document.addEventListener('input', follow);
document.addEventListener('change', follow);
document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll(BOX).forEach((box) => firsts.has(box) && write(box, firsts.get(box))));
});
