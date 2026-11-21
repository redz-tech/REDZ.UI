// REDZ.UI, time inputs: a .time-input draws its one input type="time" - with its name, value, min, max, step, required
// and list - as fields in one frame, the hours and the minutes, each with a numeric keyboard; the input, turned hidden,
// stays the form's value, HH:MM, 24-hour, and the face shows it in the page's pattern: data-time-format, PHP's letters
// G H g h i A a, by the nearest element that has it, G:i unless it says - 9:15, 09:15 under H. Under g or h the hours
// run 1 to 12 and a third part says AM or PM, as PHP prints A (am and pm for a), before the hours when the pattern
// puts it there: a tap, a click, Space, the arrows, a and p set it; an empty field has none, and hours left without it
// are refused in the page's words. A part taken - by a tap, a click or Tab - is taken whole: its first digit replaces
// it. Two digits of the hours, or one above 2 (above 1 under 12 hours), a separator or Enter go on to the minutes;
// under 12 hours 13 to 23 typed are their PM hour and 00 is 12 AM; a first minute digit above 5 is 0X; hours stop at 23
// and minutes at 59; "915", "9.15", "09:15", "3:30 pm" or "330p" typed or pasted fills them. Backspace clears a part,
// in empty minutes it goes back to the hours; the up and down arrows step the hours by one and the minutes by the
// input's step, else by one. Leaving with the hours alone sets :00. The input's own checks - required, min, max, step -
// hold the hours part in the browser's words, and its aria-describedby goes there too. The times of the input's
// datalist, each with its option's words, open as a list when the field takes the focus - above it under a finger, as
// the keyboard holds the bottom of the screen - narrowed to the hour typed; one picked sets the time. Input fires on
// each change of the time; change once per completed choice - a time picked from the list, the focus leaving the
// field. A script that sets the input's value, a tracked form's Discard and the form's reset draw it again; the parts
// follow its disabled and readonly.
import {follow} from './menu-place.js';
import {text} from './text.js';

const BOX = '.time-input';
const states = new WeakMap();
// The browser's own checks of a time, run on a field no form holds.
const proxy = Object.assign(document.createElement('input'), {type: 'time'});
let made = 0;

const pad = (n) => String(n).padStart(2, '0');

/** The page's pattern of a time by the nearest data-time-format: 12 hours or 24, the hours padded, AM and PM as PHP
 *  prints A or a, and whether they come first. */
const formatOf = (box) => {
	const pattern = box.closest('[data-time-format]')?.getAttribute('data-time-format') ?? 'G:i';
	const at = pattern.search(/[Aa]/);
	return {pattern, twelve: /[gh]/.test(pattern), padded: /[Hh]/.test(pattern), words: pattern[at] === 'a' ? ['am', 'pm'] : ['AM', 'PM'], first: at >= 0 && at < pattern.search(/[gh]/)};
};

/** "915", "9.15", "09:15", "9 15", "3:30 pm" or "330p" as [hours 0-23, minutes, PM: true, false or null when not
 *  said], held to 23 and 59; null for anything else. */
const parse = (words) => {
	const said = /([ap])\.?\s*m?\.?\s*$/i.exec(String(words).trim());
	let time = String(words).trim().slice(0, said?.index).trim().replace(/\D+/g, ':');
	if (/^\d{3,4}$/.test(time)) {
		time = time.slice(0, -2) + ':' + time.slice(-2);
	} else if (said !== null && /^\d{1,2}$/.test(time)) {
		time += ':00';
	}
	const match = /^(\d{1,2}):(\d{1,2})$/.exec(time);
	const pm = said === null ? null : said[1].toLowerCase() === 'p';
	if (match === null || (pm !== null && (+match[1] < 1 || +match[1] > 12))) {
		return null;
	}
	return [pm === null ? Math.min(23, +match[1]) : +match[1] % 12 + (pm ? 12 : 0), Math.min(59, +match[2]), pm];
};

/** The hours of a time as the pattern shows them. */
const shown = (state, hours) => {
	const h = state.f.twelve ? hours % 12 || 12 : hours;
	return state.f.padded ? pad(h) : String(h);
};

/** A time [hours, minutes] in the pattern's words. */
const said = (state, [hours, minutes]) => {
	const clock = shown(state, hours) + ':' + pad(minutes);
	const word = state.f.words[+(hours >= 12)];
	return !state.f.twelve ? clock : state.f.first ? word + ' ' + clock : clock + ' ' + word;
};

/** The time the parts hold as HH:MM, minutes left empty counting as 00; '' without hours, or under 12 hours without AM
 *  or PM. */
const valueOf = (state) => {
	if (state.hours.value === '' || (state.f.twelve && state.pm === null)) {
		return '';
	}
	return pad(state.f.twelve ? +state.hours.value % 12 + (state.pm ? 12 : 0) : +state.hours.value) + ':' + pad(+state.minutes.value);
};

/** Holds the hours part to the input's own checks, in the browser's words, and to AM or PM once the focus has left. */
const check = (state) => {
	for (const name of ['min', 'max', 'step', 'required']) {
		const value = state.input.getAttribute(name);
		value === null ? proxy.removeAttribute(name) : proxy.setAttribute(name, value);
	}
	proxy.value = state.input.value;
	const unsaid = state.f.twelve && state.hours.value !== '' && state.pm === null && !state.face.contains(document.activeElement);
	state.hours.setCustomValidity(unsaid ? text('time.period_missing') : proxy.validationMessage);
};

/** Writes the parts' time into the input, with input on it when it changed. */
const write = (state) => {
	const value = valueOf(state);
	if (state.input.value !== value) {
		state.input.value = value;
		state.input.dispatchEvent(new Event('input', {bubbles: true}));
	}
	check(state);
};

/** A completed choice: change once, when the time differs from the last one completed. */
const commit = (state) => {
	if (state.input.value !== state.committed) {
		state.committed = state.input.value;
		state.input.dispatchEvent(new Event('change', {bubbles: true}));
	}
};

/** Draws AM or PM - built the first time a pattern of 12 hours asks for it - before or after the hours. */
const drawPeriod = (state) => {
	const {f, face} = state;
	if (state.period === null && f.twelve) {
		state.period = Object.assign(document.createElement('span'), {className: 'time-input-part time-input-period', tabIndex: 0});
		for (const [name, value] of [['role', 'spinbutton'], ['aria-label', text('time.period')], ['aria-valuemin', '0'], ['aria-valuemax', '1']]) {
			state.period.setAttribute(name, value);
		}
		state.period.addEventListener('keydown', (event) => periodKeyed(state, event));
		state.period.addEventListener('click', () => state.input.disabled || state.input.readOnly || half(state, state.pm === false));
	}
	const {period} = state;
	if (period === null) {
		return;
	}
	const word = state.pm === null ? f.words.join('/') : f.words[+state.pm];
	period.hidden = !f.twelve;
	period.textContent = word;
	period.toggleAttribute('data-empty', state.pm === null);
	state.pm === null ? period.removeAttribute('aria-valuenow') : period.setAttribute('aria-valuenow', String(+state.pm));
	state.pm === null ? period.removeAttribute('aria-valuetext') : period.setAttribute('aria-valuetext', word);
	period.tabIndex = state.input.disabled ? -1 : 0;
	period.toggleAttribute('aria-disabled', state.input.disabled);
	period.toggleAttribute('aria-readonly', state.input.readOnly);
	if (f.first ? face.firstChild !== period : face.lastChild !== period) {
		f.first ? face.prepend(period) : face.append(period);
	}
};

/** The input's own bounds, as one text. */
const limitsOf = (state) => state.input.getAttribute('min') + '/' + state.input.getAttribute('max') + '/' + state.input.hasAttribute('required');

/** Draws the input's time in the parts in the page's pattern, and their disabled and read-only from it. */
const draw = (state) => {
	state.f = formatOf(state.box);
	const time = parse(state.input.value);
	state.hours.value = time === null ? '' : shown(state, time[0]);
	state.minutes.value = time === null ? '' : pad(time[1]);
	state.pm = time === null || !state.f.twelve ? null : time[0] >= 12;
	state.input.value = valueOf(state);
	state.limits = limitsOf(state);
	for (const part of [state.hours, state.minutes]) {
		part.disabled = state.input.disabled;
		part.readOnly = state.input.readOnly;
	}
	drawPeriod(state);
	check(state);
};

/** Puts a whole time into the parts and the input; under 12 hours a time typed from 1 to 11 without AM or PM keeps the
 *  one chosen, a time of the list or 0 or 12 to 23 says it. */
const fill = (state, time, exact = false) => {
	state.hours.value = shown(state, time[0]);
	state.minutes.value = pad(time[1]);
	if (state.f.twelve) {
		state.pm = time[2] ?? (exact || time[0] === 0 || time[0] >= 12 ? time[0] >= 12 : state.pm);
	}
	write(state);
	drawPeriod(state);
};

/** Sets AM or PM. */
const half = (state, pm) => {
	state.pm = pm;
	write(state);
	drawPeriod(state);
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
	const typed = (h) => state.f.twelve ? (h % 12 || 12) === +hours.value && (state.pm === null || h >= 12 === state.pm) : h === +hours.value;
	const hour = state.typed && hours.value !== '' ? times.filter((one) => typed(one.time[0])) : [];
	list.replaceChildren(...(hour.length > 0 ? hour : times).map(({time, note}) => {
		const item = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item'});
		item.dataset.time = pad(time[0]) + ':' + pad(time[1]);
		item.append(Object.assign(document.createElement('span'), {className: 'time-input-time', textContent: said(state, time)}));
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

/** The hours as typed: a whole time fills the parts; two digits, one above 2 (above 1 under 12 hours) or a separator
 *  after one go on; under 12 hours 13 to 23 are their PM hour and 00 is 12 AM. */
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
	let hour = digits.slice(0, 2);
	if (state.f.twelve && hour.length === 2 && (+hour === 0 || +hour > 12)) {
		[hour, state.pm] = +hour === 0 ? ['12', false] : +hour < 24 ? [String(+hour - 12), true] : [hour.slice(1), state.pm];
	} else if (+hour > 23) {
		hour = '23';
	}
	hours.value = hour;
	write(state);
	drawPeriod(state);
	open(state);
	if (hour.length === 2 || +hour > (state.f.twelve ? 1 : 2) || (hour !== '' && /\D$/.test(raw))) {
		take(state, minutes);
	}
};

/** The minutes as typed: a first digit above 5 is 0X, two digits stop at 59 and the next digit starts them again;
 *  under 12 hours with AM or PM not said yet, two digits go on to it. */
const minutesTyped = (state) => {
	const {hours, minutes} = state;
	let minute = (state.fresh === minutes ? typedIn(state, minutes) : minutes.value).replace(/\D/g, '').slice(0, 2);
	if (minute.length === 1 && +minute > 5) {
		minute = '0' + minute;
	}
	minutes.value = +minute > 59 ? '59' : minute;
	if (minute !== '' && hours.value === '') {
		hours.value = state.f.twelve ? '12' : '0';
	}
	state.fresh = minute.length === 2 ? minutes : null;
	write(state);
	if (minute.length === 2 && state.f.twelve && state.pm === null) {
		state.period.focus();
	}
};

/** Steps the part by one hour - round 1 to 12 under 12 hours -, or by the input's step in minutes, round the clock. */
const step = (state, part, way) => {
	const {hours, minutes} = state;
	if (part === hours) {
		hours.value = String(state.f.twelve ? ((+hours.value || 12) - 1 + way + 12) % 12 + 1 : ((+hours.value || 0) + way + 24) % 24);
	} else {
		const by = Math.max(1, Math.round((parseFloat(state.input.getAttribute('step') ?? '') || 60) / 60));
		const now = +minutes.value || 0;
		minutes.value = pad(way > 0 ? (Math.floor(now / by) * by + by) % 60 : (Math.ceil(now / by) * by - by + 60) % 60);
		hours.value ||= state.f.twelve ? '12' : '0';
	}
	state.fresh = part;
	write(state);
};

/** The keys of a part: the arrows, Backspace and Delete, Enter in the hours, a and p under 12 hours, and Escape for the
 *  list. */
const keyed = (state, part, event) => {
	const {hours, minutes, list} = state;
	const key = event.key;
	if (part.readOnly || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	if (key === 'ArrowUp' || key === 'ArrowDown') {
		step(state, part, key === 'ArrowUp' ? 1 : -1);
	} else if (state.f.twelve && /^[ap]$/i.test(key)) {
		half(state, key.toLowerCase() === 'p');
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

/** The keys of AM or PM: a and p, the arrows, Space and Enter turn it - AM first when none is said -, Backspace and
 *  Delete clear it. */
const periodKeyed = (state, event) => {
	const key = event.key;
	if (state.input.disabled || state.input.readOnly || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	if (/^[ap]$/i.test(key)) {
		half(state, key.toLowerCase() === 'p');
	} else if (['ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(key)) {
		half(state, state.pm === false);
	} else if (key === 'Backspace' || key === 'Delete') {
		half(state, null);
	} else {
		return;
	}
	event.preventDefault();
};

/** Settles the field as the focus leaves it: hours alone take :00, minutes alone go; a change of the time is a
 *  completed choice. */
const leave = (state) => {
	const {hours, minutes} = state;
	if (hours.value === '') {
		minutes.value = '';
	} else {
		hours.value = shown(state, state.f.twelve ? +hours.value % 12 : +hours.value);
		minutes.value = pad(+minutes.value);
	}
	state.fresh = null;
	state.typed = false;
	state.list?.hidePopover();
	write(state);
	commit(state);
};

/** Builds the face over the box's input once: the parts in a frame, the label naming the frame, the list. */
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
	// The parts speak through the input alone: their own input and change stop at the frame.
	face.addEventListener('input', (event) => event.stopPropagation());
	face.addEventListener('change', (event) => event.stopPropagation());
	const list = input.hasAttribute('list') ? Object.assign(document.createElement('div'), {className: 'menu time-input-list', popover: 'manual'}) : null;
	if (list !== null) {
		face.after(list);
	}
	const state = {box, input, face, hours, minutes, period: null, list, f: formatOf(box), pm: null, fresh: null, typed: false, before: '', first: '', committed: '', limits: ''};
	states.set(box, state);
	draw(state);
	state.first = input.value;
	state.committed = input.value;
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
			fill(state, parse(item.dataset.time), true);
			commit(state);
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

/** Builds the boxes not built yet, draws again the ones whose input a script, a Discard or a reset changed, or whose
 *  pattern changed, and checks again the ones whose bounds changed. */
const start = () => {
	for (const box of document.querySelectorAll(BOX)) {
		const state = states.get(box);
		if (state === undefined) {
			build(box);
		} else if (state.input.value !== valueOf(state) || state.hours.disabled !== state.input.disabled || state.hours.readOnly !== state.input.readOnly || state.f.pattern !== formatOf(box).pattern) {
			draw(state);
			state.committed = state.input.value;
		} else if (state.limits !== limitsOf(state)) {
			state.limits = limitsOf(state);
			check(state);
		}
	}
};
start();
new MutationObserver(start).observe(document.documentElement, {childList: true, subtree: true, attributeFilter: ['disabled', 'readonly', 'value', 'min', 'max', 'required', 'data-time-format']});

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll(BOX).forEach((box) => {
		const state = states.get(box);
		if (state !== undefined) {
			state.input.value = state.first;
			draw(state);
			state.committed = state.input.value;
		}
	}));
});
