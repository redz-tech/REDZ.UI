// REDZ.UI, time inputs: a .time-input draws its one input type="time" - with its name, value, min, max, step, required
// and list - as two fields in one frame, the hours and the minutes, each with a numeric keyboard; the input, turned
// hidden, stays the form's value, HH:MM, and the face shows 9:15. A part taken - by a tap, a click or Tab - is taken
// whole: its first digit replaces it. Two digits of the hours, or one above 2, a separator or Enter go on to the
// minutes; a first minute digit above 5 is 0X; hours stop at 23 and minutes at 59; "915", "9.15" or "09:15" typed or
// pasted fills both. Backspace clears a part, in empty minutes it goes back to the hours; the up and down arrows step
// the hours by one and the minutes by the input's step, else by one. Leaving with the hours alone sets :00. The input's
// own checks - required, min, max, step - hold the hours part in the browser's words, and its aria-describedby goes
// there too. The times of the input's datalist, each with its option's words, open as a list when the field takes the
// focus - above it under a finger, as the keyboard holds the bottom of the screen - narrowed to the hour typed; one
// picked sets the time. A script that sets the input's value, a tracked form's Discard and the form's reset draw it
// again; the parts follow its disabled and readonly.
import {follow} from './menu-place.js';
import {text} from './text.js';

const BOX = '.time-input';
const states = new WeakMap();
// The browser's own checks of a time, run on a field no form holds.
const proxy = Object.assign(document.createElement('input'), {type: 'time'});
let made = 0;

const pad = (n) => String(n).padStart(2, '0');

/** "915", "9.15", "09:15" or "9 15" as [hours, minutes], held to 23 and 59; null for anything else. */
const parse = (words) => {
	let time = String(words).trim().replace(/\D+/g, ':');
	if (/^\d{3,4}$/.test(time)) {
		time = time.slice(0, -2) + ':' + time.slice(-2);
	}
	const match = /^(\d{1,2}):(\d{1,2})$/.exec(time);
	return match === null ? null : [Math.min(23, +match[1]), Math.min(59, +match[2])];
};

/** The time the parts hold as HH:MM, minutes left empty counting as 00; '' without hours. */
const valueOf = (state) => state.hours.value === '' ? '' : pad(+state.hours.value) + ':' + pad(+state.minutes.value);

/** Holds the hours part to the input's own checks, in the browser's words. */
const check = (state) => {
	for (const name of ['min', 'max', 'step', 'required']) {
		const value = state.input.getAttribute(name);
		value === null ? proxy.removeAttribute(name) : proxy.setAttribute(name, value);
	}
	proxy.value = state.input.value;
	state.hours.setCustomValidity(proxy.validationMessage);
};

/** Writes the parts' time into the input, with input and change on it when it changed. */
const write = (state) => {
	const value = valueOf(state);
	if (state.input.value !== value) {
		state.input.value = value;
		state.input.dispatchEvent(new Event('input', {bubbles: true}));
		state.input.dispatchEvent(new Event('change', {bubbles: true}));
	}
	check(state);
};

/** Draws the input's time in the parts, and their disabled and read-only from it. */
const draw = (state) => {
	const time = parse(state.input.value);
	state.hours.value = time === null ? '' : String(time[0]);
	state.minutes.value = time === null ? '' : pad(time[1]);
	state.input.value = valueOf(state);
	for (const part of [state.hours, state.minutes]) {
		part.disabled = state.input.disabled;
		part.readOnly = state.input.readOnly;
	}
	check(state);
};

/** Puts a whole time into the parts and the input. */
const fill = (state, time) => {
	state.hours.value = String(time[0]);
	state.minutes.value = pad(time[1]);
	write(state);
};

/** Takes a part whole: the focus, and its next digit replaces it. */
const take = (state, part) => {
	part.focus();
	state.fresh = part;
};

/** What the last input put into the part: the characters before the caret it added, else all it holds. */
const typedIn = (state, part) => {
	const added = part.value.length - state.before.length;
	const end = part.selectionEnd ?? part.value.length;
	return added > 0 ? part.value.slice(end - added, end) : part.value;
};

/** Opens the datalist's times beside the field, narrowed to the hour typed, or closes the list when none is left. */
const open = (state) => {
	const {list, hours} = state;
	const source = document.getElementById(state.input.getAttribute('list') ?? '');
	if (list === null || !(source instanceof HTMLDataListElement) || hours.disabled || hours.readOnly) {
		return;
	}
	const times = [...source.options].map((option) => ({time: parse(option.value), note: option.label === option.value ? '' : option.label.trim()})).filter((one) => one.time !== null);
	const hour = state.typed && hours.value !== '' ? times.filter((one) => one.time[0] === +hours.value) : [];
	list.replaceChildren(...(hour.length > 0 ? hour : times).map(({time, note}) => {
		const item = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item'});
		item.dataset.time = pad(time[0]) + ':' + pad(time[1]);
		item.append(Object.assign(document.createElement('span'), {className: 'time-input-time', textContent: time[0] + ':' + pad(time[1])}));
		if (note !== '') {
			item.append(Object.assign(document.createElement('span'), {className: 'menu-item-description', textContent: note}));
		}
		return item;
	}));
	if (times.length === 0) {
		list.hidePopover();
	} else if (!list.matches(':popover-open')) {
		list.showPopover({source: state.face});
		follow(list, state.face);
	}
};

/** The hours as typed: a whole time fills both parts, two digits, one above 2 or a separator after one go on. */
const hoursTyped = (state) => {
	const {hours, minutes} = state;
	const raw = state.fresh === hours ? typedIn(state, hours) : hours.value;
	const digits = raw.replace(/\D/g, '');
	const time = digits.length > 2 || /\d\D+\d/.test(raw) ? parse(raw) : null;
	state.fresh = null;
	state.typed = true;
	if (time !== null) {
		fill(state, time);
		take(state, minutes);
		return;
	}
	const hour = +digits.slice(0, 2) > 23 ? '23' : digits.slice(0, 2);
	hours.value = hour;
	write(state);
	open(state);
	if (hour.length === 2 || +hour > 2 || (hour !== '' && /\D$/.test(raw))) {
		take(state, minutes);
	}
};

/** The minutes as typed: a first digit above 5 is 0X, two digits stop at 59 and the next digit starts them again. */
const minutesTyped = (state) => {
	const {hours, minutes} = state;
	let minute = (state.fresh === minutes ? typedIn(state, minutes) : minutes.value).replace(/\D/g, '').slice(0, 2);
	if (minute.length === 1 && +minute > 5) {
		minute = '0' + minute;
	}
	minutes.value = +minute > 59 ? '59' : minute;
	if (minute !== '' && hours.value === '') {
		hours.value = '0';
	}
	state.fresh = minute.length === 2 ? minutes : null;
	write(state);
};

/** Steps the part by one hour, or by the input's step in minutes, round the clock. */
const step = (state, part, way) => {
	const {hours, minutes} = state;
	if (part === hours) {
		hours.value = String(((+hours.value || 0) + way + 24) % 24);
	} else {
		const by = Math.max(1, Math.round((parseFloat(state.input.getAttribute('step') ?? '') || 60) / 60));
		const now = +minutes.value || 0;
		minutes.value = pad(way > 0 ? (Math.floor(now / by) * by + by) % 60 : (Math.ceil(now / by) * by - by + 60) % 60);
		hours.value ||= '0';
	}
	state.fresh = part;
	write(state);
};

/** The keys of a part: the arrows, Backspace and Delete, Enter in the hours and Escape for the list. */
const keyed = (state, part, event) => {
	const {hours, minutes, list} = state;
	const key = event.key;
	if (part.readOnly || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	if (key === 'ArrowUp' || key === 'ArrowDown') {
		step(state, part, key === 'ArrowUp' ? 1 : -1);
	} else if (key === 'Backspace' && part === minutes && minutes.value === '') {
		take(state, hours);
	} else if (key === 'Backspace' || key === 'Delete') {
		part.value = '';
		state.fresh = part;
		write(state);
	} else if (part === hours && (key === 'Enter' || key === 'ArrowRight')) {
		take(state, minutes);
	} else if (part === minutes && key === 'ArrowLeft') {
		take(state, hours);
	} else if (key === 'Escape' && list?.matches(':popover-open')) {
		list.hidePopover();
	} else {
		return;
	}
	event.preventDefault();
};

/** Settles the field as the focus leaves it: hours alone take :00, minutes alone go. */
const leave = (state) => {
	const {hours, minutes} = state;
	if (hours.value === '') {
		minutes.value = '';
	} else {
		hours.value = String(+hours.value);
		minutes.value = pad(+minutes.value);
	}
	state.fresh = null;
	state.typed = false;
	state.list?.hidePopover();
	write(state);
};

/** Builds the face over the box's input once: the two parts in a frame, the label naming the frame, the list. */
const build = (box) => {
	const input = box.querySelector(':scope > input[type="time"]');
	if (input === null) {
		return;
	}
	const id = 'redz-time-' + ++made;
	const label = input.labels?.[0];
	const part = (name, hint, words) => {
		const field = Object.assign(document.createElement('input'), {type: 'text', id: id + '-' + name, className: 'time-input-part', inputMode: 'numeric', autocomplete: 'off', placeholder: '--', enterKeyHint: hint});
		field.setAttribute('aria-label', words);
		return field;
	};
	const hours = part('hours', 'next', text('time.hours'));
	const minutes = part('minutes', 'done', text('time.minutes'));
	const colon = Object.assign(document.createElement('span'), {className: 'time-input-colon', textContent: ':'});
	const face = Object.assign(document.createElement('div'), {className: 'form-control time-input-face'});
	colon.setAttribute('aria-hidden', 'true');
	face.setAttribute('role', 'group');
	face.append(hours, colon, minutes);
	if (label !== undefined) {
		label.id ||= id + '-label';
		label.htmlFor = hours.id;
		face.setAttribute('aria-labelledby', label.id);
	} else if (input.hasAttribute('aria-label')) {
		face.setAttribute('aria-label', input.getAttribute('aria-label'));
	}
	if (input.hasAttribute('aria-describedby')) {
		hours.setAttribute('aria-describedby', input.getAttribute('aria-describedby'));
	}
	input.type = 'hidden';
	input.after(face);
	const list = input.hasAttribute('list') ? Object.assign(document.createElement('div'), {className: 'menu time-input-list', popover: 'manual'}) : null;
	if (list !== null) {
		face.after(list);
	}
	const state = {input, face, hours, minutes, list, fresh: null, typed: false, before: '', first: ''};
	states.set(box, state);
	draw(state);
	state.first = input.value;
	for (const one of [hours, minutes]) {
		one.addEventListener('focus', () => {
			state.fresh = one;
			open(state);
		});
		one.addEventListener('pointerdown', () => {
			state.fresh = one;
		});
		one.addEventListener('beforeinput', () => {
			state.before = one.value;
		});
		one.addEventListener('input', () => one === hours ? hoursTyped(state) : minutesTyped(state));
		one.addEventListener('keydown', (event) => keyed(state, one, event));
		one.addEventListener('paste', (event) => {
			const time = parse(event.clipboardData?.getData('text') ?? '');
			event.preventDefault();
			if (time !== null && !one.readOnly) {
				fill(state, time);
				take(state, minutes);
			}
		});
	}
	face.addEventListener('pointerdown', (event) => {
		if (event.target === face || event.target === colon) {
			event.preventDefault();
			if (!hours.disabled) {
				take(state, event.clientX > colon.getBoundingClientRect().right ? minutes : hours);
			}
		}
	});
	list?.addEventListener('pointerdown', (event) => event.preventDefault());
	list?.addEventListener('click', (event) => {
		const item = event.target instanceof Element ? event.target.closest('[data-time]') : null;
		if (item !== null) {
			const back = list.contains(document.activeElement);
			fill(state, parse(item.dataset.time));
			list.hidePopover();
			if (back) {
				take(state, minutes);
			}
		}
	});
	box.addEventListener('focusout', (event) => {
		if (!box.contains(event.relatedTarget)) {
			leave(state);
		}
	});
};

/** Builds the boxes not built yet and draws again the ones whose input a script, a Discard or a reset changed. */
const start = () => {
	for (const box of document.querySelectorAll(BOX)) {
		const state = states.get(box);
		if (state === undefined) {
			build(box);
		} else if (state.input.value !== valueOf(state) || state.hours.disabled !== state.input.disabled || state.hours.readOnly !== state.input.readOnly) {
			draw(state);
		}
	}
};
start();
new MutationObserver(start).observe(document.documentElement, {childList: true, subtree: true, attributeFilter: ['disabled', 'readonly', 'value']});

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll(BOX).forEach((box) => {
		const state = states.get(box);
		if (state !== undefined) {
			state.input.value = state.first;
			draw(state);
		}
	}));
});
