// REDZ.UI, picking a date (the calendar package, linked apart): a .date-pick draws a month to pick from - a day for its
// one input type="date", a period for its two, from and to -, and a .date-input draws its one input type="date" as a
// face that opens such a month below the field, on a phone as a sheet; the browser's own date picker never opens. The
// inputs, turned hidden, stay the form's values, ISO dates; every year shown is the Gregorian one, whatever calendar
// the phone is set to, and the names of the months and the days are the page language's. A day reads 18.11.2026, a face
// under data-format="short" 18.11; under data-weekday Today, Tomorrow or Yesterday comes before it, else the day's
// whole name. A week starts on Monday unless data-first-day says, 1 to 7. The month is a WAI-ARIA grid: the arrows move
// by a day and a week, Home and End to the ends of the week, Page Up and Page Down by a month, by a year with Shift;
// Enter or Space picks. In a period the first pick is a period of that one day at once and the second its end; a pick
// before the start, or after a whole period, starts it again. Days outside the first input's min and max are not
// picked. data-counts, {"YYYY-MM-DD": n or {n, tone, text}}, shows a number - or the words of text - under a day, in a
// tone, said with the page's text data-count-text names, date.count unless it says; data-counts-note is a line under
// the month. A button of the page in a date-pick-quick, its value a date or "from/to", picks that. A month shown anew
// fires redz:month with the first and the last day it shows, for the page to bring its counts - a date-input's only
// once its month opens. A script that sets an input's value, a tracked form's Discard and the form's reset draw it
// again; a date-input's face follows its input's disabled.
import {text, textCount} from '../js/text.js';

const DAY = 86400000;
const BOXES = '.date-pick, .date-input';
const states = new WeakMap();
let made = 0;

/** The day of an ISO date as UTC milliseconds, or null. */
const dayOf = (iso) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
	const t = match === null ? NaN : Date.UTC(+match[1], +match[2] - 1, +match[3]);
	return Number.isNaN(t) || isoOf(t) !== iso ? null : t;
};

/** The ISO date of a day. */
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);

/** The first day of the day's month. */
const monthOf = (t) => {
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

/** The same day of the month that many months away, or the last day of a shorter month. */
const monthsAway = (t, months) => {
	const d = new Date(t);
	const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, Math.min(d.getUTCDate(), last));
};

/** Today on this device. */
const today = () => {
	const now = new Date();
	return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/** The page language's names of days, always the Gregorian year. */
const format = (lang, options) => new Intl.DateTimeFormat(lang, {...options, calendar: 'gregory', timeZone: 'UTC'});

/** The words of a day: 18.11.2026, a field's face without the year under data-format="short"; under data-weekday
 *  Today, Tomorrow or Yesterday before it, else the day's whole name. */
const said = (state, t, face = false) => {
	const date = (face && state.box.getAttribute('data-format') === 'short' ? state.names.short : state.names.date).format(t);
	if (!state.box.hasAttribute('data-weekday')) {
		return date;
	}
	const away = Math.round((t - today()) / DAY);
	return (away === 0 ? text('date.today') : away === 1 ? text('date.tomorrow') : away === -1 ? text('date.yesterday') : state.names.weekday.format(t)) + ', ' + date;
};

/** The day the inputs hold, from and to; to is from for one input. */
const chosen = (state) => {
	const from = dayOf(state.inputs[0].value);
	const to = state.inputs.length > 1 ? dayOf(state.inputs[1].value) : from;
	return from === null || to === null || to < from ? [from, from] : [from, to];
};

/** The day a month without a choice opens on: today, held to the first input's min and max. */
const near = (state) => {
	const min = dayOf(state.inputs[0].min);
	const max = dayOf(state.inputs[0].max);
	return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, today()));
};

/** Whether a day is outside the first input's min and max, or the input is disabled. */
const off = (state, t) => {
	const input = state.inputs[0];
	const min = dayOf(input.min);
	const max = dayOf(input.max);
	return input.disabled || (min !== null && t < min) || (max !== null && t > max);
};

/** Writes the days into the inputs, with input and change on each that changed. */
const write = (state, from, to) => {
	state.inputs.forEach((input, i) => {
		const value = isoOf(i === 0 ? from : to);
		if (input.value !== value) {
			input.value = value;
			input.dispatchEvent(new Event('input', {bubbles: true}));
			input.dispatchEvent(new Event('change', {bubbles: true}));
		}
	});
	state.drawn = state.inputs.map((input) => input.value);
	if (state.face !== undefined) {
		drawFace(state);
	}
};

/** The page's counts by day, from the box's data-counts: a number, or {n, tone, text}. */
const countsOf = (state) => {
	try {
		const counts = JSON.parse(state.box.getAttribute('data-counts') || '{}');
		return counts !== null && typeof counts === 'object' ? counts : {};
	} catch {
		return {};
	}
};

/** Draws the month shown: the words of the choice, the title, the quick picks pressed, the days; the focus kept on the
 *  focused day when asked. A month not drawn before fires redz:month. */
const draw = (state, keep = false) => {
	const {box, grid, names} = state;
	const [from, to] = chosen(state);
	const counts = countsOf(state);
	const key = state.box.getAttribute('data-count-text');
	const now = today();
	const first = state.shown - ((new Date(state.shown).getUTCDay() || 7) - state.firstDay + 7) % 7 * DAY;
	state.title.textContent = names.month.format(state.shown);
	state.home.hidden = state.shown === monthOf(now);
	const note = state.box.getAttribute('data-counts-note') ?? '';
	state.note.textContent = note;
	state.note.hidden = note === '';
	const [words, length] = state.chosen.children;
	words.textContent = from === null ? text('date.none') : from === to ? said(state, from) : said(state, from) + ' - ' + said(state, to);
	length.textContent = state.inputs.length > 1 && from !== null ? textCount('date.days', Math.round((to - from) / DAY) + 1) : '';
	for (const quick of state.root.querySelectorAll('.date-pick-quick > button[value]')) {
		const [a, b = a] = quick.value.split('/').map(dayOf);
		quick.setAttribute('aria-pressed', String(a !== null && a === from && b === to));
	}
	grid.querySelectorAll('td').forEach((cell, i) => {
		const t = first + i * DAY;
		const value = counts[isoOf(t)];
		const one = value !== null && typeof value === 'object' ? value : {n: value};
		const n = Number(one.n) || 0;
		const shown = value !== undefined && value !== null && !off(state, t);
		const [number, count] = cell.children;
		cell.dataset.day = isoOf(t);
		cell.tabIndex = t === state.focus ? 0 : -1;
		cell.setAttribute('aria-label', names.long.format(t) + (shown ? ', ' + (key ? textCount(key, n) : textCount('date.count', n)) : ''));
		cell.setAttribute('aria-selected', String(from !== null && t >= from && t <= to));
		cell.toggleAttribute('data-from', t === from && state.inputs.length > 1);
		cell.toggleAttribute('data-to', t === to && state.inputs.length > 1);
		cell.toggleAttribute('data-in', from !== null && t > from && t < to);
		cell.toggleAttribute('data-other', monthOf(t) !== state.shown);
		off(state, t) ? cell.setAttribute('aria-disabled', 'true') : cell.removeAttribute('aria-disabled');
		t === now ? cell.setAttribute('aria-current', 'date') : cell.removeAttribute('aria-current');
		number.textContent = names.day.format(t);
		count.textContent = shown ? String(one.text ?? names.number.format(n)) : '';
		['danger', 'warning', 'success'].includes(one.tone) && shown ? count.setAttribute('data-tone', one.tone) : count.removeAttribute('data-tone');
	});
	if (keep) {
		grid.querySelector('[tabindex="0"]')?.focus();
	}
	if (state.month !== first && !state.quiet) {
		state.month = first;
		box.dispatchEvent(new CustomEvent('redz:month', {bubbles: true, detail: {from: isoOf(first), to: isoOf(first + 41 * DAY)}}));
	}
};

/** Shows the day's month with the focus on the day. */
const focusOn = (state, t, keep) => {
	state.focus = t;
	state.shown = monthOf(t);
	draw(state, keep);
};

/** Picks a day: one, or the start or the end of a period. A date-input closes on it. */
const pick = (state, t) => {
	if (off(state, t)) {
		return;
	}
	const [from, to] = chosen(state);
	const ends = state.inputs.length > 1 && from !== null && from === to && t >= from;
	write(state, ends ? from : t, t);
	state.focus = t;
	draw(state, true);
	state.done?.();
};

/** The keys of the grid: by a day, a week, to the week's ends, by a month or a year; Enter or Space picks. */
const keyed = (state, event) => {
	const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null;
	if (cell === null || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	const t = dayOf(cell.dataset.day);
	const back = getComputedStyle(state.grid).direction === 'rtl' ? 1 : -1;
	const week = ((new Date(t).getUTCDay() || 7) - state.firstDay + 7) % 7;
	const by = {ArrowLeft: back, ArrowRight: -back, ArrowUp: -7, ArrowDown: 7, Home: -week, End: 6 - week}[event.key];
	if (by !== undefined) {
		focusOn(state, t + by * DAY, true);
	} else if (event.key === 'PageUp' || event.key === 'PageDown') {
		focusOn(state, monthsAway(t, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)), true);
	} else if (event.key === 'Enter' || event.key === ' ') {
		pick(state, t);
	} else {
		return;
	}
	event.preventDefault();
};

/** A button of the month's bar: an icon button named by the page's text, or a text button. */
const button = (className, words, icon) => {
	const one = Object.assign(document.createElement('button'), {type: 'button', className});
	if (icon === undefined) {
		one.textContent = words;
	} else {
		one.setAttribute('aria-label', words);
		one.append(Object.assign(document.createElement('i'), {className: 'bi ' + icon}));
		one.firstChild.setAttribute('aria-hidden', 'true');
	}
	return one;
};

/** Builds the month into root for the box's inputs: the words of the choice, the page's quick picks, the bar, the grid. */
const mount = (box, root, inputs, done, quiet = false) => {
	const id = 'redz-date-' + ++made;
	const lang = box.closest('[lang]')?.lang || 'en';
	const firstDay = Math.min(7, Math.max(1, Math.round(+box.getAttribute('data-first-day')) || 1));
	const weekday = format(lang, {weekday: 'short'});
	const names = {
		date: format(lang, {day: '2-digit', month: '2-digit', year: 'numeric'}),
		short: format(lang, {day: '2-digit', month: '2-digit'}),
		weekday: format(lang, {weekday: 'long'}),
		long: format(lang, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}),
		month: format(lang, {month: 'long', year: 'numeric'}),
		day: format(lang, {day: 'numeric'}),
		number: new Intl.NumberFormat(lang),
	};
	const words = Object.assign(document.createElement('output'), {className: 'date-pick-chosen'});
	words.setAttribute('aria-live', 'polite');
	words.append(document.createElement('strong'), document.createElement('span'));
	const bar = Object.assign(document.createElement('div'), {className: 'date-pick-nav'});
	const title = Object.assign(document.createElement('div'), {className: 'date-pick-title', id: id + '-title'});
	title.setAttribute('aria-live', 'polite');
	const home = button('btn btn-sm btn-text', text('date.today'));
	const previous = button('btn btn-icon btn-text', text('date.previous'), 'bi-chevron-left');
	const next = button('btn btn-icon btn-text', text('date.next'), 'bi-chevron-right');
	bar.append(previous, title, home, next);
	const grid = Object.assign(document.createElement('table'), {className: 'date-pick-grid'});
	grid.setAttribute('role', 'grid');
	grid.setAttribute('aria-labelledby', title.id);
	const head = grid.createTHead().insertRow();
	const long = format(lang, {weekday: 'long'});
	for (let d = 0; d < 7; d++) {
		const t = Date.UTC(2026, 10, 15 + firstDay + d);
		const th = Object.assign(document.createElement('th'), {scope: 'col', textContent: weekday.format(t).length > 3 ? format(lang, {weekday: 'narrow'}).format(t) : weekday.format(t)});
		th.setAttribute('aria-label', long.format(t));
		head.append(th);
	}
	const body = grid.createTBody();
	for (let w = 0; w < 6; w++) {
		const row = body.insertRow();
		for (let d = 0; d < 7; d++) {
			row.insertCell().append(document.createElement('span'), Object.assign(document.createElement('span'), {className: 'date-pick-count'}));
		}
	}
	const quick = box.querySelector(':scope > .date-pick-quick');
	const note = Object.assign(document.createElement('p'), {className: 'date-pick-note'});
	root.append(words, ...(quick === null ? [] : [quick]), bar, grid, note);
	const state = {box, root, inputs, done, names, firstDay, grid, title, home, note, quiet, chosen: words, shown: 0, focus: 0, month: null, drawn: []};
	state.focus = chosen(state)[0] ?? near(state);
	state.shown = monthOf(state.focus);
	state.drawn = inputs.map((input) => input.value);
	previous.addEventListener('click', () => focusOn(state, monthsAway(state.focus, -1), false));
	next.addEventListener('click', () => focusOn(state, monthsAway(state.focus, 1), false));
	home.addEventListener('click', () => focusOn(state, today(), false));
	quick?.addEventListener('click', (event) => {
		const one = event.target instanceof Element ? event.target.closest('button[value]') : null;
		const [a, b = a] = one === null ? [null] : one.value.split('/').map(dayOf);
		if (a !== null && b !== null && b >= a) {
			write(state, a, b);
			focusOn(state, a, false);
			state.done?.();
		}
	});
	grid.addEventListener('click', (event) => {
		const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null;
		if (cell !== null) {
			pick(state, dayOf(cell.dataset.day));
		}
	});
	grid.addEventListener('keydown', (event) => keyed(state, event));
	draw(state);
	return state;
};

/** A date-pick: its inputs turned hidden, the month after them. */
const buildPick = (box) => {
	const inputs = [...box.querySelectorAll(':scope > input[type="date"]')].slice(0, 2);
	if (inputs.length === 0) {
		return;
	}
	inputs.forEach((input) => (input.type = 'hidden'));
	const state = mount(box, box, inputs);
	state.first = inputs.map((input) => input.value);
	states.set(box, state);
};

/** A date-input: its input turned hidden, a face named by its label, a panel with the month that the face opens. */
const buildInput = (box) => {
	const input = box.querySelector(':scope > input[type="date"]');
	if (input === null) {
		return;
	}
	const id = 'redz-date-' + ++made;
	const label = input.labels?.[0];
	const face = Object.assign(document.createElement('button'), {type: 'button', className: 'form-select date-input-face', id: id + '-face'});
	const value = Object.assign(document.createElement('span'), {className: 'date-input-value'});
	const panel = Object.assign(document.createElement('div'), {className: 'menu date-input-menu', id: id + '-panel', popover: 'auto'});
	const head = Object.assign(document.createElement('div'), {className: 'date-input-head'});
	const title = Object.assign(document.createElement('span'), {className: 'date-input-title', textContent: label?.textContent.trim() ?? ''});
	const close = button('btn btn-icon btn-text', text('close'), 'bi-x-lg');
	const root = Object.assign(document.createElement('div'), {className: 'date-pick'});
	face.append(value);
	for (const [name, words] of [['role', 'combobox'], ['aria-haspopup', 'dialog'], ['aria-expanded', 'false'], ['commandfor', panel.id], ['command', 'toggle-popover']]) {
		face.setAttribute(name, words);
	}
	close.setAttribute('commandfor', panel.id);
	close.setAttribute('command', 'hide-popover');
	title.setAttribute('aria-hidden', 'true');
	head.append(title, close);
	panel.setAttribute('role', 'dialog');
	if (label !== undefined) {
		label.id ||= id + '-label';
		label.htmlFor = face.id;
		panel.setAttribute('aria-labelledby', label.id);
	} else if (input.hasAttribute('aria-label')) {
		face.setAttribute('aria-label', input.getAttribute('aria-label'));
		panel.setAttribute('aria-label', input.getAttribute('aria-label'));
	}
	for (const name of ['aria-describedby', 'aria-invalid']) {
		if (input.hasAttribute(name)) {
			face.setAttribute(name, input.getAttribute(name));
		}
	}
	input.type = 'hidden';
	input.after(face, panel);
	panel.append(head, root);
	const state = mount(box, root, [input], () => panel.hidePopover(), true);
	Object.assign(state, {face, value, panel, first: [input.value]});
	states.set(box, state);
	face.addEventListener('keydown', (event) => {
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !panel.matches(':popover-open')) {
			event.preventDefault();
			face.click();
		}
	});
	panel.addEventListener('beforetoggle', (event) => {
		if (event.newState === 'open') {
			state.quiet = false;
			state.focus = chosen(state)[0] ?? near(state);
			state.shown = monthOf(state.focus);
			draw(state);
		}
	});
	panel.addEventListener('toggle', (event) => {
		const open = event.newState === 'open';
		face.setAttribute('aria-expanded', String(open));
		state.quiet = !open;
		if (open) {
			state.grid.querySelector('[tabindex="0"]')?.focus();
		} else if (panel.contains(document.activeElement) || document.activeElement === document.body) {
			face.focus();
		}
	});
	drawFace(state);
};

/** Draws a date-input's face from its input: the day's words, the input's disabled and required. */
const drawFace = (state) => {
	const [from] = chosen(state);
	state.value.textContent = from === null ? '' : said(state, from, true);
	state.face.disabled = state.inputs[0].disabled;
	state.inputs[0].required ? state.face.setAttribute('aria-required', 'true') : state.face.removeAttribute('aria-required');
};

/** Draws a box again: on the month of its inputs' day when they hold other values than it drew - a script's, a
 *  Discard's, a reset's -, else where it stands, for other bounds or counts. */
const redraw = (state, moved) => {
	if (moved) {
		state.drawn = state.inputs.map((input) => input.value);
		state.focus = chosen(state)[0] ?? state.focus;
		state.shown = monthOf(state.focus);
	}
	draw(state);
	if (state.face !== undefined) {
		drawFace(state);
	}
};

/** Builds the boxes not built yet, and draws again the ones whose inputs, bounds or counts changed. */
const start = (records = []) => {
	for (const box of document.querySelectorAll(BOXES)) {
		const state = states.get(box);
		if (state === undefined) {
			box.classList.contains('date-input') ? buildInput(box) : buildPick(box);
		} else if (state.inputs.some((input, i) => input.value !== state.drawn[i])) {
			redraw(state, true);
		} else if (records.some((record) => record.attributeName !== 'value' && (record.target === box || state.inputs.includes(record.target)))) {
			redraw(state, false);
		}
	}
};
start();
new MutationObserver(start).observe(document.documentElement, {childList: true, subtree: true, attributeFilter: ['value', 'min', 'max', 'disabled', 'required', 'data-counts', 'data-counts-note', 'data-count-text', 'data-format', 'data-weekday']});

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll(BOXES).forEach((box) => {
		const state = states.get(box);
		if (state !== undefined) {
			state.inputs.forEach((input, i) => (input.value = state.first[i]));
			redraw(state, true);
		}
	}));
});
