// REDZ.UI, tracked forms: a form with data-track keeps what it held one task after DOMContentLoaded - after the page's
// own scripts, a mask's formatting too - or one task after it lands later, and compares every field with it: a radio
// group, checkboxes of one name, a select multiple and a combobox's list count as one field, disabled ones too, and a
// value typed back is no change. A changed field wears data-changed - the control, a check's .form-check row, a
// combobox's face - and so do its form and the tab of every pane that holds it. The page's tracked forms outside a
// dialog share one save bar, the page's .save-bar[data-track] or one made at the end of .app-main, which names the
// changes in the page's words and stays at rest while such a form is in view; Save and Discard are never disabled and
// say when there is nothing to do, Save takes Control+S and Meta+S. Save fires the cancelable redz:save on each changed
// form in turn - {form, changed: [{name, label, was, now}], data, submitter, signal} - and, answered with a promise,
// what was sent becomes the saved state once it resolves, then redz:saved {form, value}; a refusal {message, fields}
// marks each named field under its control - {text, stored} offers Keep mine and Take saved - and reveals the first.
// Left alone, a lone changed form is submitted as usual. A form in a dialog saves by its own button (js/wait.js).
// Discard puts the saved values back, each with input and change, fires redz:discard and offers Undo until the next
// edit or ten seconds. While anything is changed, a link that leaves the page, a tab whose pane holds a changed form
// and a dialog's cancel or close ask first - Save and go, Discard, Stay - and the browser's own question guards the
// rest. An input[type=password][data-secret] keeps the stored value while it is empty; a button with command="--clear"
// for it and data-clear empties and disables it, and the form then sends that name as 1.
import {ask} from './answer.js';
import {busy} from './busy.js';
import {setList} from './combobox.js';
import {confirm} from './confirm.js';
import {announce} from './say.js';
import {selectTab} from './tabs.js';
import {text, textCount} from './text.js';
import {wait} from './wait.js';

const FORM = 'form[data-track]';
const KEYS = 'Control+S Meta+S';
const CLEAR = '--clear';
const CLEARED = '\u0000';
const PLAIN = /^(button|submit|reset|image|file)$/;
const SHOWN = 10000;
const NOTE = 3000;

const saved = new WeakMap();
const undos = new WeakMap();
const flags = new WeakMap();
const kept = new WeakSet();
const sent = new WeakSet();
const told = new Set();
let bar = null;
let saving = null;
let refusal = null;
let note = '';
let savedAt = '';
let undoing = false;
let quiet = false;
let revealing = false;
let leaving = false;
let guarded = false;
let made = 0;
const timers = {note: 0, saved: 0, undo: 0};

const lang = () => document.documentElement.lang || 'en';
const textOf = (node) => node === null || node === undefined ? '' : node.textContent.replace(/\s+/g, ' ').trim();
const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);
const tag = (name, className = '') => Object.assign(document.createElement(name), className === '' ? {} : {className});
const glyph = (name) => {
	const icon = tag('i', 'bi ' + name);
	icon.setAttribute('aria-hidden', 'true');
	return icon;
};

/** The button that clears a secret field, or null. */
const clearOf = (field) => field.id === '' ? null : document.querySelector('[command="' + CLEAR + '"][commandfor="' + CSS.escape(field.id) + '"]');

/** What shows a control's change and its refusal: a combobox's face for its list, a check's row for a check. */
const faceOf = (control) => {
	if (control.getAttribute('role') === 'listbox') {
		const panel = control.closest('[popover]');
		return panel === null ? control : document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]') ?? control;
	}
	return control.type === 'checkbox' || control.type === 'radio' ? control.closest('.form-check') ?? control : control;
};

/** What a refusal marks and focuses: a combobox's face for its list, else the control itself. */
const targetOf = (control) => control.getAttribute('role') === 'listbox' ? faceOf(control) : control;

/** The fields of a form by name: their kind and controls, a combobox's list standing for the hidden fields it writes. */
const fieldsOf = (form) => {
	const fields = new Map();
	for (const control of form.elements) {
		const usable = control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement;
		if (!usable || control.name === '' || PLAIN.test(control.type) || kept.has(control) || control.closest('.combobox-menu, [data-track="off"], [data-apply]') !== null) {
			continue;
		}
		const kind = control.type === 'radio' || control.type === 'checkbox' ? control.type : control instanceof HTMLSelectElement && control.multiple ? 'many' : control.type === 'password' && 'secret' in control.dataset ? 'secret' : 'one';
		const field = fields.get(control.name) ?? {name: control.name, kind, controls: []};
		field.controls.push(control);
		fields.set(control.name, field);
	}
	for (const list of form.querySelectorAll('[role="listbox"][data-name]')) {
		if (list.closest('[data-track="off"]') === null) {
			fields.set(list.dataset.name, {name: list.dataset.name, kind: 'list', controls: [list]});
		}
	}
	return fields;
};

/** What a field sends: a string, a list for a kind that sends several, null for nothing. */
const valueOf = (field) => {
	const [first] = field.controls;
	if (field.kind === 'list') {
		const scope = first.closest('[popover], dialog') ?? first.parentElement;
		const held = [...scope.querySelectorAll('input[type="hidden"]')].filter((one) => one.name === first.dataset.name || ('create' in first.dataset && one.name === first.dataset.create)).map((one) => one.value);
		return first.getAttribute('aria-multiselectable') === 'true' ? held : held[0] ?? null;
	}
	if (field.kind === 'radio') {
		return field.controls.find((one) => one.checked)?.value ?? null;
	}
	if (field.kind === 'checkbox') {
		const on = field.controls.filter((one) => one.checked).map((one) => one.value);
		return field.controls.length > 1 || field.name.endsWith('[]') ? on : on[0] ?? null;
	}
	if (field.kind === 'many') {
		return [...first.selectedOptions].map((option) => option.value);
	}
	if (field.kind === 'secret') {
		return clearOf(first)?.getAttribute('aria-pressed') === 'true' ? CLEARED : first.value;
	}
	return first.value;
};

/** The accessible name of a control or a group: aria-labelledby, aria-label, its label or legend. */
const nameOf = (element) => {
	const by = element.getAttribute('aria-labelledby');
	if (by !== null) {
		return by.split(/\s+/).map((id) => textOf(document.getElementById(id))).filter((words) => words !== '').join(' ');
	}
	if (element.hasAttribute('aria-label')) {
		return element.getAttribute('aria-label').trim();
	}
	return element instanceof HTMLFieldSetElement ? textOf(element.querySelector(':scope > legend')) : textOf(element.labels?.[0]);
};

/** A field's words for the bar: data-track-label, else the name of its control, its group or its combobox's face. */
const labelOf = (field) => {
	const [first] = field.controls;
	const group = field.kind === 'radio' || field.controls.length > 1 ? first.closest('fieldset, [role="radiogroup"], [role="group"]') : null;
	const named = [first, group, field.kind === 'list' ? faceOf(first) : null].find((one) => one?.dataset.trackLabel !== undefined);
	if (named !== undefined) {
		return named.dataset.trackLabel;
	}
	const words = group !== null ? nameOf(group) : nameOf(field.kind === 'list' ? faceOf(first) : first);
	return words || first.getAttribute('aria-label') || field.name;
};

/** What every field of a form sends now, by name. */
const valuesOf = (form) => new Map([...fieldsOf(form)].map(([name, field]) => [name, valueOf(field)]));

/** The changes of a form against its saved state: [{name, label, was, now}], a secret's with secret and cleared. */
const changesOf = (form) => {
	const before = saved.get(form);
	if (before === undefined) {
		return [];
	}
	const fields = fieldsOf(form);
	const changes = [];
	for (const [name, field] of fields) {
		const now = valueOf(field);
		const had = before.get(name);
		if (had !== undefined && same(had.value, now)) {
			continue;
		}
		if (field.kind === 'secret') {
			changes.push({name, label: labelOf(field), secret: true, ...(now === CLEARED ? {cleared: true} : {}), was: null, now: now === CLEARED ? null : now});
		} else {
			changes.push({name, label: labelOf(field), was: had === undefined ? null : had.value, now});
		}
	}
	for (const [name, had] of before) {
		if (!fields.has(name)) {
			changes.push({name, label: had.label, was: had.value, now: null});
		}
	}
	return changes;
};

/** Takes what the form holds now as its saved state: a secret and every password as empty. */
const baseline = (form, values = valuesOf(form)) => {
	const fields = fieldsOf(form);
	saved.set(form, new Map([...values].filter(([name]) => fields.has(name)).map(([name, value]) => {
		const field = fields.get(name);
		return [name, {value: field.kind === 'secret' || field.controls[0].type === 'password' ? '' : value, label: labelOf(field)}];
	})));
	undos.delete(form);
	if (form.closest('dialog') !== null) {
		const submits = [...form.elements].filter((one) => one.type === 'submit');
		if (submits.length === 1 && !submits[0].hasAttribute('aria-keyshortcuts')) {
			submits[0].setAttribute('aria-keyshortcuts', KEYS);
		}
	}
};

const tracked = () => [...document.querySelectorAll(FORM)].filter((form) => saved.has(form));
const pageForms = () => tracked().filter((form) => form.closest('dialog') === null);
const dirtyForms = (forms = tracked()) => forms.filter((form) => changesOf(form).length > 0);

/** Presses a secret field's Clear or releases it: the field disabled and emptied, its flag sent as 1 meanwhile. */
const press = (field, on) => {
	const button = clearOf(field);
	if (button === null || field.form === null) {
		return;
	}
	let flag = flags.get(button);
	if (flag === undefined && button.dataset.clear) {
		flag = Object.assign(tag('input'), {type: 'hidden', name: button.dataset.clear, value: '1'});
		kept.add(flag);
		flags.set(button, flag);
	}
	if (flag !== undefined) {
		flag.disabled = !on;
		field.form.append(flag);
	}
	button.setAttribute('aria-pressed', String(on));
	field.disabled = on;
	if (on) {
		field.value = '';
	}
};

/** Gives a field a value as a person would, then its input and change. */
const put = (field, value) => {
	const [first] = field.controls;
	if (field.kind === 'list') {
		setList(first, value ?? []);
		return;
	}
	let touched = first;
	if (field.kind === 'radio' || field.kind === 'checkbox') {
		const on = [value].flat();
		for (const control of field.controls) {
			control.checked = on.includes(control.value);
		}
		touched = field.controls.find((control) => control.checked) ?? first;
	} else if (field.kind === 'many') {
		const on = [value].flat();
		for (const option of first.options) {
			option.selected = on.includes(option.value);
		}
	} else if (field.kind === 'secret') {
		press(first, value === CLEARED);
		if (value !== CLEARED) {
			first.value = value ?? '';
		}
	} else {
		first.value = value ?? '';
	}
	touched.dispatchEvent(new Event('input', {bubbles: true}));
	touched.dispatchEvent(new Event('change', {bubbles: true}));
};

/** Puts values back into a form's fields that differ, without ending an Undo or a refusal by it. */
const restore = (form, values) => {
	quiet = true;
	try {
		for (const [name, field] of fieldsOf(form)) {
			if (values.has(name) && !same(valueOf(field), values.get(name))) {
				put(field, values.get(name));
			}
		}
	} finally {
		quiet = false;
	}
};

const savedValues = (form) => new Map([...(saved.get(form) ?? [])].map(([name, had]) => [name, had.value]));

/** Adds or takes an id from an element's aria-describedby, the first when added. */
const describe = (element, id, on) => {
	const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((one) => one !== '' && one !== id);
	if (on) {
		ids.unshift(id);
	}
	if (ids.length > 0) {
		element.setAttribute('aria-describedby', ids.join(' '));
	} else {
		element.removeAttribute('aria-describedby');
	}
};

/** Takes a field's refusal away: its mark, its words; a conflict too when asked. */
const unmark = (form, name, conflicts = false) => {
	const field = fieldsOf(form).get(name);
	for (const box of form.querySelectorAll('[data-track-error], [data-track-conflict]')) {
		const owner = box.dataset.trackError ?? box.dataset.trackConflict;
		if (owner === name && (conflicts || box.dataset.trackConflict === undefined)) {
			document.querySelectorAll('[aria-describedby~="' + CSS.escape(box.id) + '"]').forEach((element) => describe(element, box.id, false));
			box.remove();
		}
	}
	if (field !== undefined && form.querySelector('[data-track-conflict="' + CSS.escape(name) + '"]') === null) {
		field.controls.map(targetOf).forEach((element) => element.removeAttribute('aria-invalid'));
	}
};

const unmarkAll = (form) => {
	for (const box of form.querySelectorAll('[data-track-error], [data-track-conflict]')) {
		unmark(form, box.dataset.trackError ?? box.dataset.trackConflict, true);
	}
};

const marked = (forms) => forms.reduce((count, form) => count + new Set([...form.querySelectorAll('[aria-invalid="true"]')].map((element) => element.name || element.getAttribute('commandfor') || element.id)).size, 0);

/** Places a field's words under its control, above its hints: in its .form-field, after its group or wrapper. */
const place = (field, box) => {
	const first = targetOf(field.controls[0]);
	const group = field.controls.length > 1 ? first.closest('fieldset, [role="radiogroup"], [role="group"]') : null;
	if (group !== null) {
		group.append(box);
		return;
	}
	const anchor = first.closest('.input-group, .form-floating, .form-check') ?? first;
	const host = anchor.closest('.form-field');
	let top = anchor;
	while (host !== null && top.parentElement !== host) {
		top = top.parentElement;
	}
	top.after(box);
};

/** A conflict under a field: the page's words, then Keep mine - its saved state becomes the stored value - and Take saved. */
const conflictOf = (form, field, {text: words, stored}) => {
	const box = tag('div', 'alert alert-warning align-items-start');
	box.dataset.trackConflict = field.name;
	const body = tag('div', 'vstack gap-8');
	const row = tag('div', 'hstack gap-8');
	const choose = (action, label, take) => {
		const button = Object.assign(tag('button', 'btn btn-sm'), {type: 'button', textContent: label});
		button.dataset.trackAction = action;
		button.addEventListener('click', () => {
			saved.get(form)?.set(field.name, {value: stored, label: labelOf(field)});
			unmark(form, field.name, true);
			if (take) {
				restore(form, new Map([[field.name, stored]]));
			}
			paint();
			targetOf(field.controls[0]).focus();
		});
		return button;
	};
	row.append(choose('keep', text('changes.keep'), false), choose('take', text('changes.take'), true));
	body.append(Object.assign(tag('p'), {textContent: words}), row);
	box.append(glyph('bi-exclamation-triangle'), body);
	return box;
};

/** Marks a refused field: aria-invalid, and its sentence or its conflict joined by aria-describedby; what to reveal. */
const mark = (form, name, why) => {
	const fields = fieldsOf(form);
	const field = fields.get(name) ?? fields.get(name + '[]');
	const targets = field === undefined ? [] : field.controls.filter((control) => control.type !== 'hidden').map(targetOf);
	if (targets.length === 0) {
		return null;
	}
	for (const element of targets) {
		element.setAttribute('aria-invalid', 'true');
	}
	let box = null;
	if (why !== null && typeof why === 'object' && 'stored' in why) {
		box = conflictOf(form, field, why);
	} else if (typeof why === 'string' && why !== '') {
		box = tag('div', 'invalid-feedback');
		box.dataset.trackError = field.name;
		box.append(glyph('bi-exclamation-triangle-fill'), why);
	}
	if (box !== null) {
		box.id = 'redz-track-' + ++made;
		place(field, box);
		targets.forEach((element) => describe(element, box.id, true));
	}
	return targets[0];
};

/** Brings a refused field into view: its tabs selected, its folds opened, scrolled to and focused. */
const reveal = async (target) => {
	const panes = [];
	for (let pane = target.closest('[role="tabpanel"]'); pane !== null; pane = pane.parentElement?.closest('[role="tabpanel"]') ?? null) {
		panes.unshift(pane);
	}
	revealing = true;
	try {
		for (const pane of panes.filter((one) => one.hidden && one.id !== '')) {
			const tab = document.querySelector('[role="tab"][aria-controls="' + CSS.escape(pane.id) + '"]');
			if (tab !== null) {
				await selectTab(tab);
			}
		}
	} finally {
		revealing = false;
	}
	for (let fold = target.closest('details:not([open])'); fold !== null; fold = fold.parentElement?.closest('details:not([open])') ?? null) {
		fold.open = true;
	}
	target.scrollIntoView({block: 'center'});
	target.focus({preventScroll: true});
};

/** Reads a refusal: marks the fields it names and reveals the first; its message and how many fields it named. */
const refused = (form, reason, later = false) => {
	const fields = reason !== null && typeof reason === 'object' && reason.fields !== null && typeof reason.fields === 'object' ? reason.fields : {};
	const message = typeof reason === 'string' ? reason : typeof reason?.message === 'string' ? reason.message : '';
	let first = null;
	for (const [name, why] of Object.entries(fields)) {
		const target = mark(form, name, why);
		first ??= target;
	}
	if (first !== null) {
		if (later) {
			setTimeout(() => reveal(first));
		} else {
			reveal(first);
		}
	}
	return {message, named: Object.keys(fields).length > 0};
};

/** The bar's words for changes: the labels, the first three and how many more, and the forms' names. */
const wordsOf = (changes, forms) => {
	const labels = [...new Set(changes.map((change) => change.label))];
	const shown = labels.slice(0, 3);
	if (labels.length > 3) {
		shown.push(textCount('changes.more', labels.length - 3));
	}
	const list = new Intl.ListFormat(lang(), {type: 'conjunction'});
	return {fields: list.format(shown), forms: list.format([...new Set(forms.map((form) => form.dataset.track).filter((name) => name !== ''))])};
};

/** The words a refusal stands on: how many marked fields are left with the page's message, or the message alone. */
const refusalWords = (forms) => {
	if (refusal === null) {
		return '';
	}
	const count = marked(forms);
	return count > 0 ? textCount('changes.refused', count, {message: refusal.message}).trim() : refusal.named ? '' : refusal.message;
};

/** The bar of the page's forms, built once from the page's texts in its placeholder or at the end of the main column. */
const barOf = () => {
	if (bar !== null && bar.host.isConnected) {
		return bar;
	}
	const host = document.querySelector('.save-bar[data-track]') ?? (document.querySelector('.app-main') ?? document.body).appendChild(tag('div', 'save-bar'));
	host.setAttribute('role', 'region');
	host.setAttribute('aria-label', text('changes.bar'));
	const icon = glyph('bi-check2-circle');
	const words = tag('span', 'save-bar-text');
	const button = (action, label, icon = '', tone = '') => {
		const one = Object.assign(tag('button', 'btn btn-sm' + tone), {type: 'button'});
		one.dataset.trackAction = action;
		one.append(...(icon === '' ? [] : [glyph(icon)]), label);
		return one;
	};
	const undo = button('undo', text('changes.undo'), 'bi-arrow-counterclockwise');
	const discard = button('discard', text('changes.discard'));
	const save = button('save', text('changes.save'), 'bi-floppy', ' btn-primary');
	save.setAttribute('aria-keyshortcuts', KEYS);
	undo.addEventListener('click', undoAll);
	discard.addEventListener('click', discardPage);
	save.addEventListener('click', () => savePage(pageForms()));
	host.replaceChildren(icon, words, undo, discard, save);
	bar = {host, icon, words, undo, discard, save};
	return bar;
};

/** Says a short note in the bar, and to a screen reader. */
const tell = (words) => {
	note = words;
	clearTimeout(timers.note);
	timers.note = setTimeout(() => {
		note = '';
		paint();
	}, NOTE);
	paint();
	announce(words);
};

/** The bar's state and words for the page's forms. */
const paintBar = (forms, changes) => {
	if (forms.length === 0) {
		if (bar !== null) {
			bar.host.hidden = true;
		}
		return;
	}
	const {host, icon, words, undo} = barOf();
	const dirty = forms.filter((form) => changes.get(form).length > 0);
	const all = dirty.flatMap((form) => changes.get(form));
	const refusing = dirty.length > 0 ? refusalWords(forms) : '';
	let [state, shape, said] = ['clean', 'bi-check2-circle', text('changes.none')];
	if (saving !== null) {
		[state, shape, said] = ['saving', 'bi-pencil', words.textContent];
	} else if (refusing !== '') {
		[state, shape, said] = ['error', 'bi-exclamation-triangle', refusing];
	} else if (dirty.length > 0) {
		const {fields, forms: names} = wordsOf(all, dirty);
		[state, shape, said] = ['dirty', 'bi-pencil', textCount('changes.count', all.length, {fields, forms: names})];
	} else if (undoing) {
		[shape, said] = ['bi-arrow-counterclockwise', text('changes.discarded')];
	} else if (savedAt !== '') {
		[state, said] = ['saved', text('changes.saved', {time: savedAt})];
	}
	host.dataset.state = state;
	host.classList.toggle('save-bar-dirty', state === 'dirty' || state === 'saving');
	icon.className = 'bi ' + shape;
	words.textContent = note === '' || state === 'saving' ? said : note;
	undo.hidden = !undoing || dirty.length > 0;
	host.hidden = state === 'clean' && !undoing && note === '' && !forms.some((form) => form.checkVisibility());
};

/** Marks every tab whose pane holds a changed field, described as not saved. */
const paintTabs = (changed) => {
	const on = new Set();
	for (const node of changed) {
		for (let pane = node.closest('[role="tabpanel"]'); pane !== null; pane = pane.parentElement?.closest('[role="tabpanel"]') ?? null) {
			if (pane.id !== '') {
				document.querySelectorAll('[role="tab"][aria-controls="' + CSS.escape(pane.id) + '"]').forEach((tab) => on.add(tab));
			}
		}
	}
	let words = document.getElementById('redz-track-tab');
	if (words === null && on.size > 0) {
		words = Object.assign(tag('span'), {id: 'redz-track-tab', hidden: true, textContent: text('changes.tab')});
		document.body.append(words);
	}
	for (const tab of new Set([...told, ...on])) {
		tab.toggleAttribute('data-changed', on.has(tab));
		describe(tab, 'redz-track-tab', on.has(tab));
		if (on.has(tab)) {
			told.add(tab);
		} else {
			told.delete(tab);
		}
	}
};

const hold = (event) => {
	event.preventDefault();
	event.returnValue = '';
};

/** Draws every tracked form's marks, its tabs, the bar, and asks the browser to guard the page while anything changed. */
const paint = () => {
	const forms = tracked();
	const changes = new Map(forms.map((form) => [form, changesOf(form)]));
	const changed = [];
	for (const [form, list] of changes) {
		const names = new Set(list.map((change) => change.name));
		form.toggleAttribute('data-changed', list.length > 0);
		for (const field of fieldsOf(form).values()) {
			for (const control of field.controls.filter((one) => one.type !== 'hidden')) {
				const on = names.has(field.name) && (control.type !== 'radio' || control.checked);
				faceOf(control).toggleAttribute('data-changed', on);
				if (on) {
					changed.push(control);
				}
			}
		}
		if (list.some((change) => !fieldsOf(form).has(change.name) || fieldsOf(form).get(change.name).controls.every((control) => control.type === 'hidden'))) {
			changed.push(form);
		}
	}
	paintTabs(changed);
	paintBar(forms.filter((form) => form.closest('dialog') === null), changes);
	const guard = !leaving && [...changes.values()].some((list) => list.length > 0);
	if (guard !== guarded) {
		guarded = guard;
		if (guard) {
			addEventListener('beforeunload', hold);
		} else {
			removeEventListener('beforeunload', hold);
		}
	}
};

/** Lets the page go: no question from the browser after the person answered one. */
const leave = () => {
	leaving = true;
	paint();
	setTimeout(() => {
		leaving = false;
		paint();
	}, SHOWN);
};

/** What was sent is the saved state: every password emptied, every Clear released, redz:saved told. */
const keep = (form, values, value) => {
	for (const control of form.elements) {
		if (control instanceof HTMLInputElement && control.type === 'password') {
			press(control, false);
			control.value = '';
		}
	}
	baseline(form, values);
	unmarkAll(form);
	paint();
	form.dispatchEvent(new CustomEvent('redz:saved', {bubbles: true, detail: {form, value}}));
};

/** Asks the page to save a form: redz:save with what changed; [taken, its answer, what was sent, its controller]. */
const request = (form, submitter, own) => {
	unmarkAll(form);
	const values = valuesOf(form);
	let data;
	try {
		data = new FormData(form, own ? submitter : null);
	} catch {
		data = new FormData(form);
	}
	const controller = new AbortController();
	return [...ask(form, 'redz:save', {form, changed: changesOf(form), data, submitter, signal: controller.signal}), values, controller];
};

/** Submits a form the usual way, its guard lifted - unless the browser's checks hold it. */
const submitPlain = (form, submitter) => {
	let held = false;
	const stop = () => {
		held = true;
	};
	form.addEventListener('invalid', stop, true);
	sent.add(form);
	leaving = true;
	paint();
	form.requestSubmit(submitter !== null && submitter.form === form ? submitter : undefined);
	form.removeEventListener('invalid', stop, true);
	sent.delete(form);
	if (held) {
		leaving = false;
		paint();
	}
};

/** Saves one of the page's forms by the bar's Save; a promise of whether it was saved. */
const saveOne = (form, submitter, alone) => {
	const own = submitter !== null && submitter.form === form;
	const [taken, answer, values] = request(form, own ? submitter : barOf().save, own);
	if (answer === null) {
		if (!taken && alone) {
			submitPlain(form, own ? submitter : null);
		} else if (!taken) {
			console.error('REDZ.UI: several tracked forms changed and no redz:save answered - nothing saved');
		}
		return Promise.resolve(taken);
	}
	busy(barOf().save, answer).catch(() => {});
	return answer.then((value) => {
		keep(form, values, value);
		return true;
	}, (reason) => {
		if (reason?.name !== 'AbortError') {
			refusal = refused(form, reason);
			paint();
			const words = refusalWords(pageForms());
			if (words !== '') {
				announce(words, true);
			}
		}
		return false;
	});
};

/** Whether the forms pass the browser's own checks, as Enter would ask them; the first field that fails is brought into
 *  view and the browser says why. */
const checked = (forms) => {
	const form = forms.find((one) => !one.noValidate && !one.checkValidity());
	if (form === undefined) {
		return true;
	}
	const field = [...form.elements].find((one) => one.willValidate && !one.validity.valid);
	(field === undefined ? Promise.resolve() : reveal(field)).then(() => form.reportValidity());
	return false;
};

/** Saves the page's changed forms one after another, stopping at the first refusal; a promise of whether all were saved. */
const savePage = (forms, submitter = null) => {
	if (saving !== null) {
		return saving;
	}
	const dirty = dirtyForms(forms);
	if (dirty.length === 0) {
		tell(text('changes.nothing'));
		return Promise.resolve(true);
	}
	if (!checked(dirty)) {
		return Promise.resolve(false);
	}
	refusal = null;
	savedAt = '';
	undoing = false;
	const all = dirtyForms(pageForms()).length === 1;
	saving = (async () => {
		for (const form of dirty) {
			if (!await saveOne(form, submitter, all)) {
				return false;
			}
		}
		return true;
	})().then((done) => {
		saving = null;
		if (done) {
			savedAt = new Intl.DateTimeFormat(lang(), {hour: 'numeric', minute: '2-digit'}).format(new Date());
			clearTimeout(timers.saved);
			timers.saved = setTimeout(() => {
				savedAt = '';
				paint();
			}, NOTE);
			announce(text('changes.saved', {time: savedAt}));
		}
		paint();
		return done;
	});
	paint();
	return saving;
};

/** Saves a form of a dialog by its own button, the dialog waiting while it holds it; a promise of whether it was saved. */
const saveOwn = (form, submitter, controller, answer, values) => {
	const dialog = form.closest('dialog');
	const carried = answer.then((value) => {
		keep(form, values, value);
		return value;
	}, (reason) => {
		if (reason?.name === 'AbortError') {
			throw reason;
		}
		const {message} = refused(form, reason, true);
		paint();
		const count = marked([form]);
		throw new Error(count > 0 ? textCount('changes.refused', count, {message}).trim() : message);
	});
	if (dialog !== null && dialog.open && submitter !== null) {
		return wait(dialog, submitter, carried, controller);
	}
	if (submitter !== null) {
		busy(submitter, carried).catch(() => {});
	}
	return carried.then(() => true, () => false);
};

/** Saves the forms a question holds: the page's by the bar, a dialog's by its own button. */
const saveForms = async (forms) => {
	const page = forms.filter((form) => form.closest('dialog') === null);
	if (page.length > 0 && !await savePage(page)) {
		return false;
	}
	for (const form of forms.filter((one) => one.closest('dialog') !== null)) {
		if (!checked([form])) {
			return false;
		}
		const submitter = [...form.elements].find((one) => one.type === 'submit') ?? null;
		const [taken, answer, values, controller] = request(form, submitter, true);
		if (answer === null) {
			if (!taken) {
				submitPlain(form, submitter);
			}
			continue;
		}
		if (!await saveOwn(form, submitter, controller, answer, values)) {
			return false;
		}
	}
	return true;
};

/** Puts a form back to its saved state, its refusals taken away; redz:discard told. */
const discard = (form, undoable) => {
	if (undoable) {
		undos.set(form, valuesOf(form));
	}
	unmarkAll(form);
	restore(form, savedValues(form));
	form.dispatchEvent(new CustomEvent('redz:discard', {bubbles: true, detail: {form}}));
};

/** The bar's Discard: the page's changed forms back to their saved state, Undo offered until the next edit or ten seconds. */
const discardPage = () => {
	const dirty = dirtyForms(pageForms());
	if (dirty.length === 0) {
		tell(text('changes.nothing'));
		return;
	}
	dirty.forEach((form) => discard(form, true));
	refusal = null;
	savedAt = '';
	undoing = true;
	clearTimeout(timers.undo);
	timers.undo = setTimeout(endUndo, SHOWN);
	paint();
	announce(text('changes.discarded'));
};

const endUndo = () => {
	undoing = false;
	clearTimeout(timers.undo);
	pageForms().forEach((form) => undos.delete(form));
	paint();
};

/** The bar's Undo: the discarded values back, the focus on Save. */
function undoAll() {
	for (const form of pageForms()) {
		const values = undos.get(form);
		if (values !== undefined) {
			restore(form, values);
		}
	}
	endUndo();
	barOf().save.focus();
}

/** Asks before the forms' changes are left: Save and go, Discard, Stay; a promise of whether to go on. */
const decide = (forms) => {
	const changes = forms.flatMap(changesOf);
	const {fields, forms: names} = wordsOf(changes, forms);
	return confirm({title: text('leave.title'), text: textCount('leave.text', changes.length, {fields, forms: names}), ok: text('leave.save'), cancel: text('leave.stay'), alt: {text: text('leave.discard'), tone: 'danger', value: 'drop'}, focus: 'ok'}).then((answer) => {
		if (answer === 'drop') {
			forms.forEach((form) => discard(form, false));
			refusal = null;
			paint();
			return true;
		}
		return answer === true ? saveForms(forms) : false;
	});
};

/** Tracks the forms in a part of the page not tracked yet. */
const scan = (root) => {
	const forms = [...(root instanceof Element && root.matches(FORM) ? [root] : []), ...root.querySelectorAll(FORM)];
	for (const form of forms.filter((one) => !saved.has(one))) {
		baseline(form);
	}
};

/** One task after the page's own scripts, the forms there are tracked; one task after a form lands later, it is too. */
const start = () => setTimeout(() => {
	scan(document);
	paint();
	new MutationObserver((records) => {
		const touched = records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches('form') || node.querySelector('form') !== null)) || record.type === 'attributes');
		if (touched) {
			setTimeout(() => {
				scan(document);
				paint();
			});
		}
	}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-track']});
});

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', start, {once: true});
} else {
	start();
}

/** An edit: that field's refusal goes, an Undo and the saved words end, everything is drawn again. */
const edited = (event) => {
	const target = event.target;
	const form = target instanceof Element ? target.form ?? target.closest('form') : null;
	if (quiet || form === null || !saved.has(form)) {
		return;
	}
	const name = target.getAttribute('role') === 'listbox' ? target.dataset.name : target.name;
	if (name) {
		unmark(form, name);
	}
	if (refusal !== null && !refusal.named) {
		refusal = null;
	}
	if (undoing && form.closest('dialog') === null) {
		endUndo();
	}
	savedAt = '';
	note = '';
	paint();
};
document.addEventListener('input', edited);
document.addEventListener('change', edited);

document.addEventListener('submit', (event) => {
	const form = event.target;
	if (!(form instanceof HTMLFormElement) || !form.matches(FORM) || sent.has(form)) {
		return;
	}
	if (!saved.has(form)) {
		baseline(form);
	}
	const submitter = event.submitter ?? null;
	const dialog = form.closest('dialog');
	if (dialog === null) {
		event.preventDefault();
		if (changesOf(form).length === 0) {
			tell(text('changes.nothing'));
		} else {
			savePage([form], submitter);
		}
		return;
	}
	const own = submitter ?? [...form.elements].find((one) => one.type === 'submit') ?? null;
	const [taken, answer, values, controller] = request(form, own, true);
	if (taken || answer !== null) {
		event.preventDefault();
	} else {
		leave();
	}
	if (answer !== null) {
		saveOwn(form, own, controller, answer, values);
	}
});

document.addEventListener('command', (event) => {
	const field = event.target;
	if (event.command === CLEAR && field instanceof HTMLInputElement && field.type === 'password') {
		press(field, clearOf(field)?.getAttribute('aria-pressed') !== 'true');
		field.dispatchEvent(new Event('change', {bubbles: true}));
	}
}, true);

document.addEventListener('click', (event) => {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || leaving) {
		return;
	}
	const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
	if (link === null || link.hasAttribute('download') || link.hasAttribute('commandfor') || link.getAttribute('role') === 'tab' || !['', '_self'].includes(link.target)) {
		return;
	}
	const to = new URL(link.href);
	if (!['http:', 'https:'].includes(to.protocol) || (to.hash !== '' && to.href.split('#')[0] === location.href.split('#')[0])) {
		return;
	}
	const forms = dirtyForms();
	if (forms.length === 0) {
		return;
	}
	event.preventDefault();
	decide(forms).then((go) => {
		if (go) {
			leave();
			location.assign(link.href);
		}
	});
});

document.addEventListener('redz:select', (event) => {
	const from = event.detail?.from;
	const pane = revealing || from === null || from === undefined ? null : document.getElementById(from.getAttribute('aria-controls') ?? '');
	const forms = pane === null ? [] : dirtyForms().filter((form) => pane.contains(form));
	if (forms.length > 0 && !event.defaultPrevented) {
		event.preventDefault();
		event.detail.respondWith(decide(forms));
	}
});

/** A dialog that holds a changed form asks before it closes by its cancel or a close command; where the browser lets a
 *  second Escape close it anyway, it asks once it has closed, and Stay opens it again. */
const closing = (event) => {
	const dialog = event.target;
	const closes = event.type === 'cancel' || event.command === 'close' || event.command === 'request-close';
	if (!(dialog instanceof HTMLDialogElement) || !closes || leaving || !dialog.open) {
		return;
	}
	const forms = dirtyForms().filter((form) => dialog.contains(form));
	if (forms.length === 0) {
		return;
	}
	if (event.cancelable) {
		event.preventDefault();
		decide(forms).then((go) => {
			if (go && dialog.open) {
				dialog.close();
			}
		});
		return;
	}
	const modal = dialog.matches(':modal');
	dialog.addEventListener('close', () => decide(forms).then((go) => {
		if (!go && !dialog.open) {
			if (modal) {
				dialog.showModal();
			} else {
				dialog.show();
			}
		}
	}), {once: true});
};
document.addEventListener('cancel', closing, true);
document.addEventListener('command', closing, true);

addEventListener('pageshow', (event) => {
	if (event.persisted) {
		leaving = false;
		paint();
	}
});

/** Whether the browser's own question guards the page now: a navigation then may still be refused. */
export const guarding = () => guarded;

/** The tracked forms for code: refresh, baseline, reset, dirty, changed and save. */
export const track = {
	refresh: () => paint(),
	baseline: (form) => {
		baseline(form);
		unmarkAll(form);
		paint();
	},
	reset: (form) => {
		discard(form, false);
		paint();
	},
	dirty: (form) => form === undefined ? dirtyForms() : changesOf(form).length > 0,
	changed: (form) => changesOf(form),
	save: (form) => saveForms(form === undefined ? dirtyForms() : dirtyForms([form])),
};
