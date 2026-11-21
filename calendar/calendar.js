// REDZ.UI, picking dates (the calendar package, linked apart): a .date-pick draws months to pick from - a day for its
// one input type="date", a period for its two, from and to, several separate days under data-multiple for its one
// input that holds them comma-separated -, and a .date-input draws its inputs as a field that opens such months below
// it, on a phone as a sheet; the browser's own date picker never opens. The inputs, turned hidden, stay the form's
// values, ISO dates.
// Settings of the page go by the nearest element that has them, so a page sets them once on <html> and a box or a part
// overrides: data-date-format, a pattern of PHP date() letters (d j m n Y y M F D l, a backslash for a letter as it
// is) - else the page language's order -, and data-format="short" on a box leaves the year out of its face;
// data-first-day, 1 for Monday to 7 for Sunday, 0 for Sunday too, Monday unless it says; data-calendar="buddhist" adds
// 543 to the year, "gregorian" keeps the Gregorian one; data-time-zone, the zone today is counted in, else the
// device's; data-weekend, the weekdays the heads tint, "6 7" unless it says; data-typing, a day typed in the pattern
// in place of the field's button, where the pointer is not a finger, "off" below it; data-count-icon, an icon before
// each count. Settings of a box are its own: data-months, how many months, side by side while they fit; data-min and
// data-max, "today", "+N" or "-N" days or an ISO date, the stricter of them and the input's min and max holding;
// data-enable and data-disable, comma-separated rules - a day, a from/to with ".." for an open end, a month YYYY-MM, a
// day or a from/to of every year --MM-DD, weekdays 1 to 7 or "weekend", or a period and weekdays together -, a day
// picked only when some enable rule takes it, when there are any, and no disable rule does.
// data-counts, {"YYYY-MM-DD": n or {n, text, tone, off, note}}, shows n in a pill under a day, said with the page's
// text data-count-text names, date.count unless it says, or the text alone; off makes the day one not to pick and note
// says why, after the day's name and as its tooltip; data-counts-note is a line under the months. A month shown anew
// fires redz:month with the first and the last day the months show and the box's data-context; a page that answers
// with event.detail.respondWith(promise of such a map) has it kept by month and context - the months it waits for are
// aria-busy, a new data-context asks again -, a page that does not sets data-counts, asked at each other range.
// A period: the first pick is its start, and a period of that day unless the end may stay empty (data-open-end) or
// data-min-days asks more; the second its end, the days out of reach - past data-max-days, short of data-min-days,
// past the next day not to pick under data-unbroken - not taken and saying why; a pick before the start, or the start
// again, starts it again or keeps the one day. Several days: a pick turns a day on or off, with Shift every day from
// the last one turned, the same way; the chosen days are a list under the months, each with its remove. Input fires on
// each pick; change once per completed choice - a period's end, a quick pick, Clear, a typed part, the month closing,
// the focus leaving an inline box; for several days only the last two. The month is a WAI-ARIA grid per month: the
// arrows move by a day and a week across the months shown, Home and End to the ends of the week, Page Up and Page Down
// by a month, by a year with Shift; Enter or Space picks. A typed day takes the pattern's order in the page's digits, a
// month's name, a missing year or month from today, 4, 6 or 8 digits run together, a two-digit or Buddhist year and an
// ISO date; the up and down arrows step it a day; one that reads as no day or cannot be picked is refused in the page's
// words. A script that sets an input's value, a tracked form's Discard and the form's reset draw it again; a
// date-input's face follows its inputs' disabled and required.
import {ask} from '../js/answer.js';
import {langAt, locales, text, textCount} from '../js/text.js';

const DAY = 86400000;
const BOXES = '.date-pick, .date-input';
const LETTERS = 'djmnYyMFDl';
const PAGE = ['data-date-format', 'data-first-day', 'data-calendar', 'data-time-zone', 'data-weekend', 'data-typing', 'data-count-icon', 'lang'];
const touch = matchMedia('(pointer: coarse)');
const states = new WeakMap();
const rules = new Map();
const names = new Map();
let made = 0;

/** The day of an ISO date as UTC milliseconds, or null. */
const dayOf = (iso) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
	const t = match === null ? NaN : Date.UTC(+match[1], +match[2] - 1, +match[3]);
	return Number.isNaN(t) || isoOf(t) !== iso ? null : t;
};

/** The ISO date of a day. */
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);

const pad = (n) => String(n).padStart(2, '0');

/** The first day of the day's month, or of the month that many after it. */
const monthOf = (t, after = 0) => {
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + after, 1);
};

/** The same day of the month that many months away, or the last day of a shorter month. */
const monthsAway = (t, months) => {
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, Math.min(d.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate()));
};

/** Today in the zone, else on this device. */
const todayIn = (zone) => {
	if (zone) {
		try {
			const parts = new Intl.DateTimeFormat(locales('en'), {timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric'}).formatToParts();
			const field = (type) => +parts.find((part) => part.type === type).value;
			return Date.UTC(field('year'), field('month') - 1, field('day'));
		} catch {
			console.error('REDZ.UI: no time zone "' + zone + '"');
		}
	}
	const now = new Date();
	return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Now in the zone, else on this device, as YYYY-MM-DDTHH:MM. */
const nowIn = (zone) => {
	const now = new Date();
	let [hour, minute] = [now.getHours(), now.getMinutes()];
	try {
		const parts = new Intl.DateTimeFormat(locales('en'), {timeZone: zone || undefined, hourCycle: 'h23', hour: 'numeric', minute: 'numeric'}).formatToParts(now);
		[hour, minute] = ['hour', 'minute'].map((type) => +parts.find((part) => part.type === type).value);
	} catch {
	}
	return isoOf(todayIn(zone)) + 'T' + pad(hour) + ':' + pad(minute);
};

/** The page language's names in a calendar, made once: the formats, the digits, the months' names as they stand beside
 *  a day and alone, the order of a date's parts. */
const namesOf = (lang, calendar) => {
	const key = lang + ' ' + calendar;
	if (!names.has(key)) {
		const format = (options) => new Intl.DateTimeFormat(locales(lang), {...options, calendar, timeZone: 'UTC'});
		const months = (one) => [...Array(12).keys()].map((m) => (one.formatToParts(Date.UTC(2026, m, 15)).find((part) => part.type === 'month')?.value ?? '').toLocaleLowerCase(lang).replace(/\.$/, ''));
		names.set(key, {
			date: format({day: '2-digit', month: '2-digit', year: 'numeric'}),
			short: format({day: '2-digit', month: '2-digit'}),
			weekday: format({weekday: 'long'}),
			weekdayShort: format({weekday: 'short'}),
			narrow: format({weekday: 'narrow'}),
			long: format({weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}),
			month: format({month: 'long', year: 'numeric'}),
			alone: format({month: 'long'}),
			beside: format({day: 'numeric', month: 'long'}),
			besideShort: format({day: 'numeric', month: 'short'}),
			day: format({day: 'numeric'}),
			number: new Intl.NumberFormat(locales(lang)),
			two: new Intl.NumberFormat(locales(lang), {minimumIntegerDigits: 2, useGrouping: false}),
			plain: new Intl.NumberFormat(locales(lang), {useGrouping: false}),
			digits: new Map([...Array(10).keys()].map((n) => [new Intl.NumberFormat(locales(lang)).format(n), String(n)])),
			months: [format({day: 'numeric', month: 'long'}), format({day: 'numeric', month: 'short'}), format({month: 'long'}), format({month: 'short'})].map(months),
			order: format({day: '2-digit', month: '2-digit', year: 'numeric'}).formatToParts(0).map((part) => ({day: 'd', month: 'm', year: 'y'})[part.type]).filter(Boolean),
			yearFirst: format({year: 'numeric', month: 'long'}).formatToParts(0).find((part) => part.type === 'year' || part.type === 'month')?.type === 'year',
		});
	}
	return names.get(key);
};

/** A pattern of PHP date() letters as parts: a letter, or the text between letters. */
const partsOf = (pattern) => {
	const parts = [];
	for (let i = 0; i < pattern.length; i++) {
		const escaped = pattern[i] === '\\' && i + 1 < pattern.length;
		const c = escaped ? pattern[++i] : pattern[i];
		if (!escaped && LETTERS.includes(c)) {
			parts.push({letter: c});
		} else if (parts.at(-1)?.text !== undefined) {
			parts.at(-1).text += c;
		} else {
			parts.push({text: c});
		}
	}
	return parts;
};

/** The parts without the year and the text beside it: before it when a letter comes first, else after it. */
const shortOf = (parts) => {
	const at = parts.findIndex((part) => part.letter === 'Y' || part.letter === 'y');
	if (at < 0) {
		return parts;
	}
	return parts.slice(0, at).some((part) => part.letter !== undefined)
		? [...parts.slice(0, at - (parts[at - 1]?.text !== undefined ? 1 : 0)), ...parts.slice(at + 1)]
		: [...parts.slice(0, at), ...parts.slice(at + (parts[at + 1]?.text !== undefined ? 2 : 1))];
};

/** One letter of a day: the page's digits and names, a month's name as it stands beside a day (19 ноября). */
const piece = (s, letter, t) => {
	const d = new Date(t);
	const month = (format) => format.formatToParts(t).find((part) => part.type === 'month')?.value ?? '';
	const year = d.getUTCFullYear() + s.offset;
	return {
		d: () => s.names.two.format(d.getUTCDate()),
		j: () => s.names.plain.format(d.getUTCDate()),
		m: () => s.names.two.format(d.getUTCMonth() + 1),
		n: () => s.names.plain.format(d.getUTCMonth() + 1),
		Y: () => s.names.plain.format(year),
		y: () => s.names.two.format(year % 100),
		F: () => month(s.names.beside),
		M: () => month(s.names.besideShort),
		D: () => s.names.weekdayShort.format(t),
		l: () => s.names.weekday.format(t),
	}[letter]();
};

/** A day in words: by the pattern, else in the page language's order; short leaves the year out. */
const dateWords = (s, t, short = false) => s.parts === null
	? (short ? s.names.short : s.names.date).format(t)
	: (short ? shortOf(s.parts) : s.parts).map((part) => part.letter === undefined ? part.text : piece(s, part.letter, t)).join('');

const capital = (words, lang) => words.charAt(0).toLocaleUpperCase(lang) + words.slice(1);

/** A month and its year: the page language's words, under the Buddhist year its number with no era. */
const monthTitle = (s, t) => s.offset === 0 ? s.names.month.format(t) : capital(s.names.alone.format(t), s.lang) + ' ' + s.names.plain.format(new Date(t).getUTCFullYear() + s.offset);

/** A setting of the page: the nearest element's around the box that has it. */
const near = (box, name) => box.closest('[' + name + ']')?.getAttribute(name) ?? null;

/** The page's settings a box draws by. */
const settingsOf = (box) => {
	const lang = langAt(box);
	const pattern = near(box, 'data-date-format') || null;
	const calendar = near(box, 'data-calendar') === 'buddhist' ? 'buddhist' : 'gregory';
	const first = near(box, 'data-first-day');
	const day = Math.round(Number(first));
	const typing = near(box, 'data-typing');
	return {
		lang, calendar,
		parts: pattern === null ? null : partsOf(pattern),
		offset: calendar === 'buddhist' ? 543 : 0,
		firstDay: first !== null && day === 0 ? 7 : Math.min(7, Math.max(1, day || 1)),
		weekend: (near(box, 'data-weekend') ?? '6 7').split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 7),
		zone: near(box, 'data-time-zone'),
		typing: typing !== null && typing !== 'off' && !touch.matches,
		icon: near(box, 'data-count-icon') || null,
		names: namesOf(lang, calendar),
	};
};

/** A bound of a box: "today" or "now", "+N" or "-N" days from today, or an ISO date or moment, by its day; null for
 *  anything else. */
const relative = (words, today) => {
	const match = /^\s*(?:(today|now)|([+-])(\d{1,5}))\s*$/.exec(words ?? '');
	return match === null ? dayOf((words ?? '').trim().slice(0, 10)) : match[1] ? today : today + (match[2] === '-' ? -1 : 1) * match[3] * DAY;
};

/** The rules of data-enable or data-disable, read once: each a period - a day, a from/to with open ends, a month, a day
 *  or a from/to of every year - and weekdays. */
const rulesOf = (words, weekend) => {
	const key = words + '|' + weekend;
	if (!rules.has(key)) {
		rules.set(key, words.split(',').filter((rule) => rule.trim() !== '').map((rule) => {
			const one = {from: -Infinity, to: Infinity, yearly: null, days: null};
			for (const part of rule.trim().split(/\s+/)) {
				let m;
				if (/^[1-7]$/.test(part) || part === 'weekend') {
					one.days ??= new Set();
					(part === 'weekend' ? weekend : [+part]).forEach((d) => one.days.add(d));
				} else if ((m = /^--(\d{2})-(\d{2})(?:\/--(\d{2})-(\d{2}))?$/.exec(part))) {
					one.yearly = [m[1] * 100 + +m[2], (m[3] ?? m[1]) * 100 + +(m[4] ?? m[2])];
				} else if ((m = /^(\d{4}-\d{2}-\d{2}|\.\.)\/(\d{4}-\d{2}-\d{2}|\.\.)$/.exec(part)) && (m[1] === '..' || dayOf(m[1]) !== null) && (m[2] === '..' || dayOf(m[2]) !== null)) {
					one.from = m[1] === '..' ? -Infinity : dayOf(m[1]);
					one.to = m[2] === '..' ? Infinity : dayOf(m[2]);
				} else if ((m = /^(\d{4})-(\d{2})$/.exec(part)) && +m[2] >= 1 && +m[2] <= 12) {
					one.from = Date.UTC(+m[1], m[2] - 1, 1);
					one.to = Date.UTC(+m[1], +m[2], 0);
				} else if (dayOf(part) !== null) {
					one.from = one.to = dayOf(part);
				} else {
					console.error('REDZ.UI: no date rule "' + part + '"');
					return null;
				}
			}
			return one;
		}).filter((one) => one !== null));
	}
	return rules.get(key);
};

/** Whether a rule takes a day. */
const matches = (rule, t) => {
	const d = new Date(t);
	const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
	const [a, b] = rule.yearly ?? [0, 9999];
	return t >= rule.from && t <= rule.to && (a <= b ? md >= a && md <= b : md >= a || md <= b) && (rule.days === null || rule.days.has(d.getUTCDay() || 7));
};

/** A day's entry of the counts: a number as {n}, or the object. */
const entryOf = (value) => value === undefined || value === null ? null : typeof value === 'object' ? value : {n: value};

/** Reads all a draw needs: the settings, today, the bounds, the rules, the counts, the period's limits, the context. */
const prepare = (state) => {
	const {box, inputs} = state;
	state.s = settingsOf(box);
	state.today = todayIn(state.s.zone);
	const min = [dayOf(inputs[0].min), relative(box.getAttribute('data-min'), state.today)].filter((t) => t !== null);
	const max = [dayOf(inputs[0].max), relative(box.getAttribute('data-max'), state.today)].filter((t) => t !== null);
	state.bounds = [min.length > 0 ? Math.max(...min) : null, max.length > 0 ? Math.min(...max) : null];
	const enable = box.getAttribute('data-enable') ?? '';
	state.enable = enable.trim() === '' ? null : rulesOf(enable, state.s.weekend);
	state.disable = rulesOf(box.getAttribute('data-disable') ?? '', state.s.weekend);
	const context = box.getAttribute('data-context') ?? '';
	if (context !== state.context) {
		state.context = context;
		state.answered.clear();
		state.waiting.clear();
		state.asked = null;
	}
	let counts = {};
	try {
		counts = JSON.parse(box.getAttribute('data-counts') || '{}') ?? {};
	} catch {
	}
	state.counts = Object.assign({}, typeof counts === 'object' ? counts : {}, ...state.answered.values());
	state.minDays = Math.max(0, Math.round(box.getAttribute('data-min-days')) || 0);
	state.maxDays = Math.max(0, Math.round(box.getAttribute('data-max-days')) || 0);
	state.openStart = box.hasAttribute('data-open-start');
	state.openEnd = box.hasAttribute('data-open-end');
	state.wall = state.start !== null && box.hasAttribute('data-unbroken') ? wallOf(state) : null;
};

/** Why a day is not to pick - '' or the page's note -, or null when it is. */
const unavailable = (state, t) => {
	const [min, max] = state.bounds;
	if (state.inputs[0].disabled || (min !== null && t < min) || (max !== null && t > max) || (state.enable !== null && !state.enable.some((rule) => matches(rule, t))) || state.disable.some((rule) => matches(rule, t))) {
		return '';
	}
	const entry = entryOf(state.counts[isoOf(t)]);
	return entry?.off === true ? String(entry.note ?? '') : null;
};

/** The first day not to pick after the start of the period being made. */
const wallOf = (state) => {
	for (let t = state.start + DAY; t <= state.start + (state.maxDays || 400) * DAY; t += DAY) {
		if (unavailable(state, t) !== null) {
			return t;
		}
	}
	return null;
};

/** Why a day cannot end the period being made, or null when it can. */
const beyond = (state, t) => {
	const length = Math.round((t - state.start) / DAY) + 1;
	if (state.maxDays > 0 && length > state.maxDays) {
		return textCount('date.longest', state.maxDays);
	}
	if (state.minDays > 0 && length < state.minDays) {
		return textCount('date.shortest', state.minDays);
	}
	return state.wall !== null && t >= state.wall ? text('date.unavailable') : null;
};

/** The days the inputs hold: from and to, or the one day. */
const valuesOf = (state) => state.inputs.map((input) => dayOf(input.value));

/** The days of several days, sorted. */
const listOf = (state) => [...new Set(state.inputs[0].value.split(',').map((one) => dayOf(one.trim())).filter((t) => t !== null))].sort((a, b) => a - b);

/** The day a month opens on: the chosen one, else the first to pick from today on, held to the bounds. */
const opening = (state) => {
	const [from, to] = state.multiple ? [listOf(state).find((t) => t >= state.today) ?? null] : valuesOf(state);
	if ((from ?? to ?? null) !== null) {
		return from ?? to;
	}
	const [min, max] = state.bounds;
	const start = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, state.today));
	for (let t = start; t <= start + 400 * DAY && (max === null || t <= max); t += DAY) {
		if (unavailable(state, t) === null) {
			return t;
		}
	}
	return start;
};

/** Writes the inputs - a day, null to empty one, or the list of several days - with input on each that changed. */
const write = (state, days) => {
	state.inputs.forEach((input, i) => {
		const value = state.multiple ? days.map(isoOf).join(',') : days[i] === null || days[i] === undefined ? '' : isoOf(days[i]);
		if (input.value !== value) {
			input.value = value;
			input.dispatchEvent(new Event('input', {bubbles: true}));
		}
	});
	state.drawn = state.inputs.map((input) => input.value);
};

/** A completed choice: change once, on the last input, when the values differ from the last completed ones; a day and
 *  its time complete theirs only as the focus leaves the field. */
const commit = (state, leaving = false) => {
	state.start = null;
	state.wall = null;
	state.hover = null;
	const inputs = state.timed?.inputs ?? state.inputs;
	const values = inputs.map((input) => input.value).join('/');
	if (values !== state.committed && (state.timed === undefined || leaving)) {
		state.committed = values;
		inputs.at(-1).dispatchEvent(new Event('change', {bubbles: true}));
	}
};

/** A day and its time: each end's day and time written into its datetime-local, whole or empty, with input on it when
 *  it changed; each time then held to its day's bounds. */
const join = (state) => {
	const {inputs, times} = state.timed;
	inputs.forEach((input, i) => {
		const [day, time] = [state.inputs[i].value, times[i].input.value];
		const value = day !== '' && time !== '' ? day + 'T' + time : '';
		if (input.value !== value) {
			input.value = value;
			input.dispatchEvent(new Event('input', {bubbles: true}));
		}
	});
	state.timed.drawn = inputs.map((input) => input.value);
	limit(state);
};

/** Holds each time to the moments that bound its day: the first input's min and max, data-min and data-max as "now" or
 *  a moment, and for the end the start on the same day; a day chosen asks for its time. */
const limit = (state) => {
	const {inputs, times} = state.timed;
	const now = nowIn(state.s.zone);
	const moments = (own, words) => [own, words === 'now' ? now : /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(words ?? '') ? words.slice(0, 16) : ''].filter(Boolean);
	const lows = moments(inputs[0].min, state.box.getAttribute('data-min'));
	const highs = moments(inputs[0].max, state.box.getAttribute('data-max'));
	times.forEach(({input}, i) => {
		const day = state.inputs[i].value;
		const on = (list) => list.filter((at) => at.slice(0, 10) === day).map((at) => at.slice(11, 16)).sort();
		const low = [...on(lows), ...(i === 1 && day !== '' && inputs[0].value.startsWith(day) ? [inputs[0].value.slice(11, 16)] : [])].sort().at(-1);
		const high = on(highs)[0];
		put(input, 'min', low ?? null);
		put(input, 'max', high ?? null);
		put(input, 'required', inputs[i].required || day !== '');
		put(input, 'disabled', inputs[i].disabled);
		put(input, 'readonly', inputs[i].readOnly);
	});
};

/** Sets an attribute only when it differs: the same value set again is a change the boxes would draw again for. */
const put = (element, name, value) => {
	const words = value === true ? '' : value === false ? null : value;
	if (element.getAttribute(name) !== words) {
		words === null ? element.removeAttribute(name) : element.setAttribute(name, words);
	}
};

/** A day and its time from their datetime-local: what a script, a Discard or a reset wrote there, split. */
const split = (state) => {
	const {inputs, times} = state.timed;
	inputs.forEach((input, i) => {
		state.inputs[i].value = input.value.slice(0, 10);
		times[i].input.value = input.value.slice(11, 16);
	});
	state.timed.drawn = inputs.map((input) => input.value);
};

/** The days' settings from their datetime-local: the first's min and max by their day, each end's disabled, required
 *  and names. */
const mirror = (state) => {
	const {inputs} = state.timed;
	state.inputs.forEach((day, i) => {
		put(day, 'min', inputs[0].min.slice(0, 10) || null);
		put(day, 'max', inputs[0].max.slice(0, 10) || null);
		put(day, 'disabled', inputs[i].disabled);
		put(day, 'required', inputs[i].required);
		for (const name of ['aria-label', 'aria-describedby', 'aria-invalid']) {
			put(day, name, inputs[i].getAttribute(name));
		}
	});
};

/** The choice ends with no other pick: kept as it stands, or a period that needs an end it lacks given back. */
const finish = (state) => {
	if (state.start !== null && state.inputs.length > 1 && state.inputs[1].value === '' && !state.openEnd) {
		state.inputs.forEach((input, i) => {
			if (input.value !== state.before[i]) {
				input.value = state.before[i];
				input.dispatchEvent(new Event('input', {bubbles: true}));
			}
		});
		state.drawn = state.inputs.map((input) => input.value);
		state.start = null;
	}
	commit(state);
	draw(state);
	drawFace(state);
};

/** The words of a day: under data-weekday Today, Tomorrow or Yesterday before it, else the day's whole name. */
const said = (state, t, face = false) => {
	const date = dateWords(state.s, t, face && state.box.getAttribute('data-format') === 'short');
	if (!state.box.hasAttribute('data-weekday')) {
		return date;
	}
	const away = Math.round((t - state.today) / DAY);
	return (away === 0 ? text('date.today') : away === 1 ? text('date.tomorrow') : away === -1 ? text('date.yesterday') : state.s.names.weekday.format(t)) + ', ' + date;
};

/** The words of the choice: a day, a period, one with an open end, several days, or none. */
const choiceWords = (state, face = false) => {
	if (state.multiple) {
		const n = listOf(state).length;
		return n > 0 ? textCount('date.chosen', n) : face ? '' : text('date.none');
	}
	const [from, to = null] = valuesOf(state);
	if (from !== null && (to !== null || state.inputs.length === 1)) {
		return from === (to ?? from) ? said(state, from, face) : said(state, from, face) + ' - ' + said(state, to, face);
	}
	return from !== null ? text('date.since', {date: said(state, from, face)}) : to !== null ? text('date.until', {date: said(state, to, face)}) : face ? '' : text('date.none');
};

/** Asks the page for the counts of the months shown: a page that answers is asked only for the months it has not
 *  answered in this context, one that does not at each other range. */
const load = (state, from, to, months) => {
	const missing = months.filter((month) => !state.answered.has(month) && !state.waiting.has(month));
	const key = from + '/' + to + '/' + state.context;
	if (state.quiet || state.asked === key || (state.answers && missing.length === 0)) {
		return;
	}
	state.asked = key;
	const [, answer] = ask(state.box, 'redz:month', {from, to, context: state.context});
	if (answer === null) {
		return;
	}
	const context = state.context;
	state.answers = true;
	missing.forEach((month) => state.waiting.add(month));
	state.blocks.forEach((block, b) => block.wrap.setAttribute('aria-busy', String(state.waiting.has(months[b]))));
	answer.then((map) => {
		if (context === state.context && map !== null && typeof map === 'object') {
			missing.forEach((month) => state.answered.set(month, map));
		}
	}, () => {}).finally(() => {
		if (context === state.context) {
			missing.forEach((month) => state.waiting.delete(month));
			draw(state);
		}
	});
};

/** The month and the year lists, for the first month shown: the years of the bounds, else data-years, else ten back and
 *  ten ahead, the shown one always; a month all out of the bounds not offered. */
const drawLists = (state) => {
	const {s, months, years} = state;
	const shown = new Date(state.shown);
	if (months.dataset.lang !== s.lang + s.calendar) {
		months.dataset.lang = s.lang + s.calendar;
		months.replaceChildren(...[...Array(12).keys()].map((m) => new Option(capital(s.names.alone.format(Date.UTC(2026, m, 1)), s.lang), String(m))));
		months.parentElement.append(...(s.names.yearFirst ? [years, months] : [months, years]));
	}
	const now = new Date(state.today).getUTCFullYear();
	const [a, b] = (state.box.getAttribute('data-years') ?? '').split('/').map(Number);
	const [min, max] = state.bounds;
	const from = Math.min(min !== null ? new Date(min).getUTCFullYear() : a > 0 ? a : now - 10, shown.getUTCFullYear());
	const to = Math.max(max !== null ? new Date(max).getUTCFullYear() : b > 0 ? b : now + 10, shown.getUTCFullYear());
	if (years.dataset.range !== from + '/' + to + '/' + s.offset + s.lang) {
		years.dataset.range = from + '/' + to + '/' + s.offset + s.lang;
		years.replaceChildren(...[...Array(to - from + 1).keys()].map((i) => new Option(s.names.plain.format(from + i + s.offset), String(from + i))));
	}
	years.value = String(shown.getUTCFullYear());
	[...months.options].forEach((option, m) => (option.disabled = (max !== null && Date.UTC(shown.getUTCFullYear(), m, 1) > max) || (min !== null && Date.UTC(shown.getUTCFullYear(), m + 1, 0) < min)));
	months.value = String(shown.getUTCMonth());
};

/** Draws the months shown: the words of the choice, the lists, the heads, the days and their counts, the quick picks;
 *  the focus kept on the focused day when asked; the page asked for counts it has not given. */
const draw = (state, keep = false) => {
	prepare(state);
	const {box, s, blocks} = state;
	const [from, to = null] = valuesOf(state);
	const single = state.inputs.length === 1 && !state.multiple;
	const chosen = state.multiple ? new Set(listOf(state)) : null;
	const lo = from ?? to;
	const hi = single ? from : to ?? from;
	const key = box.getAttribute('data-count-text');
	const many = blocks.length > 1;
	const starts = blocks.map((block, b) => monthOf(state.shown, b));
	const firsts = starts.map((start) => start - ((new Date(start).getUTCDay() || 7) - s.firstDay + 7) % 7 * DAY);
	const reach = state.start !== null && state.hover !== null && state.hover > state.start && unavailable(state, state.hover) === null && beyond(state, state.hover) === null ? state.hover : null;
	blocks.forEach((block, b) => {
		block.title.textContent = monthTitle(s, starts[b]);
		block.title.classList.toggle('visually-hidden', !many);
		block.wrap.setAttribute('aria-busy', String(state.waiting.has(isoOf(starts[b]).slice(0, 7))));
		[...block.grid.tHead.rows[0].cells].forEach((th, d) => {
			const t = Date.UTC(2026, 10, 15 + s.firstDay + d);
			const short = s.names.weekdayShort.format(t);
			th.textContent = short.length > 3 ? s.names.narrow.format(t) : short;
			th.setAttribute('aria-label', s.names.weekday.format(t));
			th.toggleAttribute('data-weekend', s.weekend.includes(new Date(t).getUTCDay() || 7));
		});
		block.grid.querySelectorAll('td').forEach((cell, i) => {
			const t = firsts[b] + i * DAY;
			const [number, count] = cell.children;
			if (many && monthOf(t) !== starts[b]) {
				cell.setAttribute('data-blank', '');
				number.textContent = '';
				count.dataset.count = '';
				count.replaceChildren();
				for (const name of ['data-day', 'tabindex', 'aria-label', 'aria-selected', 'aria-disabled', 'aria-current', 'title', 'data-past']) {
					cell.removeAttribute(name);
				}
				return;
			}
			const entry = entryOf(state.counts[isoOf(t)]);
			const off = unavailable(state, t);
			const out = state.start !== null && t > state.start && off === null ? beyond(state, t) : null;
			const note = off || out || String(entry?.note ?? '');
			const pill = entry !== null && entry.n !== undefined && entry.n !== null;
			cell.removeAttribute('data-blank');
			cell.dataset.day = isoOf(t);
			cell.tabIndex = t === state.focus ? 0 : -1;
			cell.setAttribute('aria-label', [s.names.long.format(t), !pill ? String(entry?.text ?? '') : key ? textCount(key, Number(entry.n) || 0) : textCount('date.count', Number(entry.n) || 0), note].filter(Boolean).join(', '));
			note ? (cell.title = note) : cell.removeAttribute('title');
			cell.setAttribute('aria-selected', String(chosen !== null ? chosen.has(t) : lo !== null && t >= lo && t <= hi));
			cell.toggleAttribute('data-from', !single && chosen === null && t === lo);
			cell.toggleAttribute('data-to', !single && chosen === null && t === hi && to !== null);
			cell.toggleAttribute('data-in', chosen === null && lo !== null && t > lo && t < hi);
			cell.toggleAttribute('data-reach', reach !== null && t > state.start && t <= reach);
			cell.toggleAttribute('data-other', !many && monthOf(t) !== starts[b]);
			cell.toggleAttribute('data-past', t < state.today);
			off !== null || out !== null ? cell.setAttribute('aria-disabled', 'true') : cell.removeAttribute('aria-disabled');
			t === state.today ? cell.setAttribute('aria-current', 'date') : cell.removeAttribute('aria-current');
			number.textContent = s.names.day.format(t);
			count.dataset.count = entry === null ? '' : String(entry.text ?? (pill ? s.names.number.format(Number(entry.n) || 0) : ''));
			count.toggleAttribute('data-pill', pill);
			count.replaceChildren(...(pill && s.icon !== null ? [Object.assign(document.createElement('i'), {className: 'bi ' + s.icon})] : []));
			['danger', 'warning', 'success'].includes(entry?.tone) ? count.setAttribute('data-tone', entry.tone) : count.removeAttribute('data-tone');
		});
	});
	state.home.hidden = starts.includes(monthOf(state.today));
	const note = box.getAttribute('data-counts-note') ?? '';
	state.note.textContent = note;
	state.note.hidden = note === '';
	const [words, length] = state.chosen.children;
	words.textContent = choiceWords(state);
	length.textContent = state.start !== null && (state.maxDays || state.minDays) ? textCount(state.maxDays ? 'date.longest' : 'date.shortest', state.maxDays || state.minDays) : !single && chosen === null && from !== null && to !== null ? textCount('date.days', Math.round((to - from) / DAY) + 1) : '';
	state.clear.hidden = (chosen !== null ? chosen.size === 0 : from === null && to === null) || state.inputs.every((input) => input.required);
	if (chosen !== null) {
		// Each day keeps its chip, so the one in focus keeps the focus.
		const items = new Map([...state.list.children].map((item) => [item.firstChild.dataset.day, item]));
		let last = null;
		for (const t of [...chosen].sort((a, b) => a - b)) {
			const words = dateWords(s, t);
			let item = items.get(isoOf(t));
			items.delete(isoOf(t));
			if (item === undefined) {
				item = document.createElement('li');
				const remove = button('chip', words);
				remove.dataset.day = isoOf(t);
				remove.append(Object.assign(document.createElement('i'), {className: 'bi bi-x-lg'}));
				remove.lastChild.setAttribute('aria-hidden', 'true');
				item.append(remove);
				last === null ? state.list.prepend(item) : last.after(item);
			}
			item.firstChild.firstChild.textContent = words;
			item.firstChild.setAttribute('aria-label', text('date.remove', {date: words}));
			last = item;
		}
		items.forEach((item) => item.remove());
	}
	for (const quick of state.root.querySelectorAll('.date-pick-quick > button[value]')) {
		const [a, b = a] = quick.value.split('/').map(dayOf);
		quick.setAttribute('aria-pressed', String(a !== null && a === from && (single || b === to)));
		quick.disabled = a === null || b === null || unavailable(state, a) !== null || unavailable(state, b) !== null || (state.maxDays > 0 && Math.round((b - a) / DAY) + 1 > state.maxDays);
	}
	drawLists(state);
	if (keep) {
		state.root.querySelector('td[tabindex="0"]')?.focus();
	}
	load(state, isoOf(firsts[0]), isoOf(firsts.at(-1) + 41 * DAY), starts.map((start) => isoOf(start).slice(0, 7)));
};

/** Moves the focus to a day: within the months shown, else showing its month first or last. */
const focusOn = (state, t, keep) => {
	if (t < state.shown) {
		state.shown = monthOf(t);
	} else if (t >= monthOf(state.shown, state.blocks.length)) {
		state.shown = monthOf(t, 1 - state.blocks.length);
	}
	state.focus = t;
	draw(state, keep);
};

/** Shows a month and a year, the nearest month in the bounds when it is out of them, the focus on the same day there,
 *  held to the bounds. */
const jump = (state, year, month) => {
	const [min, max] = state.bounds;
	const first = Math.min(max === null ? Infinity : monthOf(max), Math.max(min === null ? -Infinity : monthOf(min), Date.UTC(year, month, 1)));
	[year, month] = [new Date(first).getUTCFullYear(), new Date(first).getUTCMonth()];
	const t = Date.UTC(year, month, Math.min(new Date(state.focus).getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()));
	state.shown = first;
	state.focus = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, t));
	draw(state);
};

/** Turns a day of several days on or off; a run, every day from the last one turned, the same way; only days to pick
 *  come on, and any goes off. The focus goes to the day unless kept where it is. */
const toggle = (state, t, run, keep = true) => {
	const list = new Set(listOf(state));
	const span = run && state.anchor !== null;
	const on = span ? state.on : !list.has(t);
	if (!span && on && unavailable(state, t) !== null) {
		return;
	}
	for (let d = Math.min(span ? state.anchor : t, t); d <= Math.max(span ? state.anchor : t, t); d += DAY) {
		if (!on) {
			list.delete(d);
		} else if (unavailable(state, d) === null) {
			list.add(d);
		}
	}
	state.on = on;
	state.anchor = t;
	state.focus = t;
	write(state, [...list].sort((a, b) => a - b));
	draw(state, keep);
	drawFace(state);
};

/** A pick: a day turned on or off; one day; the start of a period, then its end. */
const pick = (state, t, run = false) => {
	if (state.multiple) {
		toggle(state, t, run);
		return;
	}
	state.focus = t;
	if (state.inputs.length === 1 || (state.start !== null && t > state.start && unavailable(state, t) === null && beyond(state, t) === null)) {
		if (unavailable(state, t) !== null) {
			return;
		}
		write(state, state.inputs.length === 1 ? [t] : [state.start, t]);
	} else if (state.start !== null && t === state.start) {
		if (state.minDays > 1) {
			return;
		}
		write(state, [t, state.openEnd ? null : t]);
	} else if (unavailable(state, t) === null && (state.start === null || t < state.start)) {
		if (state.start === null) {
			state.before = state.inputs.map((input) => input.value);
		}
		state.start = t;
		write(state, [t, state.openEnd || state.minDays > 1 ? null : t]);
		draw(state, true);
		drawFace(state);
		return;
	} else {
		return;
	}
	commit(state);
	draw(state, true);
	drawFace(state);
	state.done?.();
};

/** The keys of the grid: by a day, a week, to the week's ends, by a month or a year; Enter or Space picks, with Shift a
 *  run of several days. */
const keyed = (state, event) => {
	const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null;
	if (cell === null || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	const t = dayOf(cell.dataset.day);
	const back = getComputedStyle(cell).direction === 'rtl' ? 1 : -1;
	const week = ((new Date(t).getUTCDay() || 7) - state.s.firstDay + 7) % 7;
	const by = {ArrowLeft: back, ArrowRight: -back, ArrowUp: -7, ArrowDown: 7, Home: -week, End: 6 - week}[event.key];
	if (by !== undefined) {
		state.hover = state.start === null ? null : t + by * DAY;
		focusOn(state, t + by * DAY, true);
	} else if (event.key === 'PageUp' || event.key === 'PageDown') {
		focusOn(state, monthsAway(t, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)), true);
	} else if (event.key === 'Enter' || event.key === ' ') {
		pick(state, t, event.shiftKey);
	} else {
		return;
	}
	event.preventDefault();
};

/** A button: an icon button named by the page's text, or a text button. */
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

/** Builds the months into root for the box's inputs: the choice's words and Clear, the page's quick picks, the bar
 *  with the month and the year lists, a grid per month, the list of several days, the note. */
const mount = (box, root, inputs, done, quiet = false) => {
	const id = 'redz-date-' + ++made;
	const multiple = box.hasAttribute('data-multiple');
	const words = Object.assign(document.createElement('output'), {className: 'date-pick-chosen'});
	words.setAttribute('aria-live', 'polite');
	words.append(document.createElement('strong'), document.createElement('span'));
	const clear = button('btn btn-sm btn-text date-pick-clear', text('date.clear'));
	const head = Object.assign(document.createElement('div'), {className: 'date-pick-head'});
	head.append(words, clear);
	const bar = Object.assign(document.createElement('div'), {className: 'date-pick-nav'});
	const home = button('btn btn-sm btn-text', text('date.today'));
	const previous = button('btn btn-icon btn-text', text('date.previous'), 'bi-chevron-left');
	const next = button('btn btn-icon btn-text', text('date.next'), 'bi-chevron-right');
	const lists = document.createElement('span');
	const months = Object.assign(document.createElement('select'), {className: 'form-select form-select-sm'});
	const years = Object.assign(document.createElement('select'), {className: 'form-select form-select-sm'});
	months.setAttribute('aria-label', text('date.month'));
	years.setAttribute('aria-label', text('date.year'));
	lists.append(months, years);
	bar.append(previous, lists, home, next);
	const shown = Object.assign(document.createElement('div'), {className: 'date-pick-months'});
	const blocks = [...Array(Math.min(12, Math.max(1, Math.round(box.getAttribute('data-months')) || 1))).keys()].map((b) => {
		const wrap = Object.assign(document.createElement('div'), {className: 'date-pick-month'});
		const title = Object.assign(document.createElement('div'), {className: 'date-pick-title', id: id + '-title-' + b});
		const grid = Object.assign(document.createElement('table'), {className: 'date-pick-grid'});
		if (b === 0) {
			title.setAttribute('aria-live', 'polite');
		}
		grid.setAttribute('role', 'grid');
		grid.setAttribute('aria-labelledby', title.id);
		if (multiple) {
			grid.setAttribute('aria-multiselectable', 'true');
		}
		const row = grid.createTHead().insertRow();
		for (let d = 0; d < 7; d++) {
			row.append(Object.assign(document.createElement('th'), {scope: 'col'}));
		}
		const body = grid.createTBody();
		for (let w = 0; w < 6; w++) {
			const week = body.insertRow();
			for (let d = 0; d < 7; d++) {
				// The count is drawn from data-count, so the day's text stays its number alone and its name holds the
				// count's words (WCAG 2.5.3, axe's label-content-name-mismatch).
				const count = Object.assign(document.createElement('span'), {className: 'date-pick-count'});
				count.setAttribute('aria-hidden', 'true');
				week.insertCell().append(document.createElement('span'), count);
			}
		}
		wrap.append(title, grid);
		shown.append(wrap);
		return {wrap, title, grid};
	});
	const quick = box.querySelector(':scope > .date-pick-quick');
	const list = Object.assign(document.createElement('ul'), {className: 'date-pick-days'});
	const note = Object.assign(document.createElement('p'), {className: 'date-pick-note'});
	root.append(head, ...(quick === null ? [] : [quick]), bar, shown, ...(multiple ? [list] : []), note);
	const state = {box, root, inputs, done, quiet, multiple, blocks, months, years, home, clear, note, list, chosen: words, start: null, hover: null, anchor: null, on: true, before: [], answered: new Map(), waiting: new Set(), asked: null, answers: false, context: null, shown: 0, focus: 0, drawn: inputs.map((input) => input.value), committed: inputs.map((input) => input.value).join('/'), first: inputs.map((input) => input.value)};
	prepare(state);
	state.focus = opening(state);
	state.shown = monthOf(state.focus);
	previous.addEventListener('click', () => focusOn(state, monthsAway(state.focus, -1), false));
	next.addEventListener('click', () => focusOn(state, monthsAway(state.focus, 1), false));
	home.addEventListener('click', () => focusOn(state, state.today, false));
	months.addEventListener('change', () => jump(state, new Date(state.shown).getUTCFullYear(), +months.value));
	years.addEventListener('change', () => jump(state, +years.value, new Date(state.shown).getUTCMonth()));
	clear.addEventListener('click', () => {
		state.anchor = null;
		state.timed?.times.forEach(({input}) => (input.value = ''));
		write(state, []);
		state.multiple || commit(state);
		draw(state);
		drawFace(state);
		if (state.done !== undefined) {
			state.done();
		} else if (state.clear.hidden) {
			state.root.querySelector('td[tabindex="0"]')?.focus();
		}
	});
	quick?.addEventListener('click', (event) => {
		const one = event.target instanceof Element ? event.target.closest('button[value]') : null;
		const [a, b = a] = one === null ? [null] : one.value.split('/').map(dayOf);
		if (a !== null && b !== null && b >= a && !one.disabled) {
			const days = [];
			for (let d = a; state.multiple && d <= b; d += DAY) {
				if (unavailable(state, d) === null) {
					days.push(d);
				}
			}
			state.start = null;
			write(state, state.multiple ? [...new Set([...listOf(state), ...days])].sort((x, y) => x - y) : [a, b]);
			state.multiple || commit(state);
			focusOn(state, a, false);
			drawFace(state);
			state.done?.();
		}
	});
	list.addEventListener('click', (event) => {
		const one = event.target instanceof Element ? event.target.closest('button[data-day]') : null;
		if (one !== null) {
			// The focus moves before the chip goes: to the next chip, else the one before, else the day in its month.
			const chips = [...list.querySelectorAll('button')];
			const at = chips.indexOf(one);
			const t = dayOf(one.dataset.day);
			const next = chips[at + 1] ?? chips[at - 1];
			next === undefined ? focusOn(state, t, true) : next.focus();
			state.anchor = null;
			toggle(state, t, false, next === undefined);
		}
	});
	shown.addEventListener('click', (event) => {
		const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null;
		if (cell !== null) {
			pick(state, dayOf(cell.dataset.day), event.shiftKey);
		}
	});
	shown.addEventListener('pointerover', (event) => {
		const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null;
		const t = cell === null ? null : dayOf(cell.dataset.day);
		if (state.start !== null && t !== state.hover) {
			state.hover = t;
			draw(state);
		}
	});
	shown.addEventListener('pointerleave', () => {
		if (state.hover !== null) {
			state.hover = null;
			draw(state);
		}
	});
	shown.addEventListener('keydown', (event) => keyed(state, event));
	hush(root, state);
	root.addEventListener('focusout', (event) => {
		if (state.panel === undefined && !root.contains(event.relatedTarget)) {
			finish(state);
		}
	});
	draw(state);
	return state;
};

/** The inputs of a box: its one input of several days, else its one or two input type="date" - or, in a date-input,
 *  input type="datetime-local". */
const inputsOf = (box, timed = false) => box.hasAttribute('data-multiple') ? [...box.querySelectorAll(':scope > input')].slice(0, 1) : [...box.querySelectorAll(':scope > input[type="date"]' + (timed ? ', :scope > input[type="datetime-local"]' : ''))].slice(0, 2);

/** A date-pick: its inputs turned hidden, the months after them. */
const buildPick = (box) => {
	const inputs = inputsOf(box);
	if (inputs.length > 0) {
		inputs.forEach((input) => (input.type = 'hidden'));
		states.set(box, mount(box, box, inputs));
	}
};

/** A typed day, or undefined when the words read as no day. */
const readTyped = (state, words) => {
	const s = state.s;
	const iso = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(words);
	if (iso !== null) {
		return dayOf(iso[1] + '-' + pad(iso[2]) + '-' + pad(iso[3])) ?? undefined;
	}
	const order = s.parts === null ? s.names.order : s.parts.filter((part) => part.letter !== undefined && !'Dl'.includes(part.letter)).map((part) => 'dj'.includes(part.letter) ? 'd' : 'Yy'.includes(part.letter) ? 'y' : 'm');
	const numbers = [];
	let month = null;
	for (const token of words.toLocaleLowerCase(s.lang).match(/\p{N}+|\p{L}+/gu) ?? []) {
		if (/^\p{N}+$/u.test(token)) {
			numbers.push([...token].map((c) => s.names.digits.get(c) ?? c).join(''));
		} else {
			const found = s.names.months.map((one) => one.findIndex((name) => name !== '' && (name === token || (token.length >= 3 && name.startsWith(token))))).find((m) => m >= 0);
			month = found === undefined ? month : found + 1;
		}
	}
	let slots = order.filter((slot) => slot !== 'm' || month === null);
	if (numbers.length === 1 && month === null && [4, 6, 8].includes(numbers[0].length)) {
		const whole = numbers.pop();
		slots = whole.length === 4 ? slots.filter((slot) => slot !== 'y') : slots;
		let at = 0;
		for (const slot of slots) {
			const width = slot === 'y' && whole.length === 8 ? 4 : 2;
			numbers.push(whole.slice(at, at + width));
			at += width;
		}
	}
	for (const missing of ['y', 'm']) {
		slots = numbers.length < slots.length ? slots.filter((slot) => slot !== missing) : slots;
	}
	if (numbers.length === 0 || numbers.length !== slots.length) {
		return undefined;
	}
	const now = new Date(state.today);
	const got = {d: null, m: month, y: null};
	slots.forEach((slot, i) => (got[slot] = numbers[i]));
	let year = now.getUTCFullYear();
	if (got.y !== null && got.y.length <= 2) {
		year = (s.offset ? 2500 : 2000) + +got.y - s.offset;
		year -= !s.offset && year > now.getUTCFullYear() + 50 ? 100 : 0;
	} else if (got.y !== null) {
		year = s.offset && +got.y >= 2400 ? got.y - s.offset : +got.y;
	}
	return dayOf(String(year).padStart(4, '0') + '-' + pad(+(got.m ?? now.getUTCMonth() + 1)) + '-' + pad(+got.d)) ?? undefined;
};

/** A typed part read: its day written - a period turned the right way round -, or the part refused in the page's
 *  words. */
const typedIn = (state, i, final) => {
	const part = state.parts[i];
	const t = part.value.trim() === '' ? null : readTyped(state, part.value);
	const days = valuesOf(state);
	const example = text('date.invalid', {example: dateWords(state.s, state.today)});
	let why = t === undefined || (t === null && days.length > 1 && days[1 - i] !== null && !(i === 0 ? state.openStart : state.openEnd)) ? example : '';
	if (why === '' && t !== null && unavailable(state, t) !== null) {
		why = unavailable(state, t) || text('date.unavailable');
	}
	days[i] = t ?? null;
	if (days.length > 1 && days[0] !== null && days[1] !== null && days[1] < days[0]) {
		days.reverse();
	}
	if (why === '' && days.length > 1 && days[0] !== null && days[1] !== null && state.maxDays > 0 && Math.round((days[1] - days[0]) / DAY) + 1 > state.maxDays) {
		why = textCount('date.longest', state.maxDays);
	}
	part.setCustomValidity(why);
	why === '' ? part.removeAttribute('aria-invalid') : part.setAttribute('aria-invalid', 'true');
	if (why !== '') {
		return;
	}
	state.start = null;
	write(state, days);
	if (final) {
		commit(state);
	}
	state.focus = t ?? state.focus;
	if (state.focus < state.shown || state.focus >= monthOf(state.shown, state.blocks.length)) {
		state.shown = monthOf(state.focus);
	}
	draw(state);
	drawFace(state, part);
};

/** The field's face: a button that opens the months - always under a finger and for several days -, or the day typed
 *  in parts, with a button beside them that opens the months; a day and its time, each end's day and its time in one
 *  frame. */
const makeFace = (state) => {
	const typed = state.s.typing && !state.multiple;
	if (state.typed === typed) {
		return;
	}
	state.typed = typed;
	state.face?.remove();
	state.open?.remove();
	state.panel.toggleAttribute('data-typed', typed);
	state.panel.style.removeProperty('position-anchor');
	if (state.timed !== undefined) {
		timedFace(state, typed);
		return;
	}
	const {label, inputs, panel} = state;
	const describe = (element) => {
		for (const name of ['aria-describedby', 'aria-invalid']) {
			if (inputs[0].hasAttribute(name)) {
				element.setAttribute(name, inputs[0].getAttribute(name));
			}
		}
	};
	if (!typed) {
		const face = Object.assign(document.createElement('button'), {type: 'button', className: 'form-select date-input-face', id: panel.id + '-face'});
		face.append(Object.assign(document.createElement('span'), {className: 'date-input-value'}));
		for (const [name, words] of [['role', 'combobox'], ['aria-haspopup', 'dialog'], ['aria-expanded', 'false'], ['commandfor', panel.id], ['command', 'toggle-popover']]) {
			face.setAttribute(name, words);
		}
		if (label === undefined && inputs[0].hasAttribute('aria-label')) {
			face.setAttribute('aria-label', inputs[0].getAttribute('aria-label'));
		}
		describe(face);
		face.addEventListener('keydown', (event) => {
			if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !panel.matches(':popover-open')) {
				event.preventDefault();
				face.click();
			}
		});
		Object.assign(state, {face, parts: [], open: undefined});
		inputs.at(-1).after(face);
		if (label !== undefined) {
			label.htmlFor = face.id;
		}
		return;
	}
	const open = button('btn btn-icon btn-text date-input-open', text('date.choose'), 'bi-calendar3');
	for (const [name, words] of [['aria-haspopup', 'dialog'], ['aria-expanded', 'false'], ['commandfor', panel.id], ['command', 'toggle-popover']]) {
		open.setAttribute(name, words);
	}
	const partOf = (input, i, single) => {
		const part = Object.assign(document.createElement('input'), {type: 'text', className: single ? 'form-control date-input-face date-input-typed' : 'date-input-part', id: panel.id + '-part-' + i, autocomplete: 'off', spellcheck: false});
		if (!single || (label === undefined && input.hasAttribute('aria-label'))) {
			part.setAttribute('aria-label', input.getAttribute('aria-label') ?? '');
		}
		part.addEventListener('keydown', (event) => {
			if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey) {
				event.preventDefault();
				state.open.click();
			} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				part.value = dateWords(state.s, (valuesOf(state)[i] ?? state.today) + (event.key === 'ArrowUp' ? DAY : -DAY));
				typedIn(state, i, false);
			} else if (event.key === 'Enter') {
				typedIn(state, i, true);
			}
		});
		part.addEventListener('change', () => typedIn(state, i, true));
		part.addEventListener('blur', () => part.hasAttribute('aria-invalid') || commit(state));
		return part;
	};
	if (inputs.length === 1) {
		const face = partOf(inputs[0], 0, true);
		describe(face);
		Object.assign(state, {face, parts: [face], open});
		inputs[0].after(face);
		if (label !== undefined) {
			label.htmlFor = face.id;
		}
	} else {
		const face = Object.assign(document.createElement('div'), {className: 'form-control date-input-face date-input-typed', id: panel.id + '-face'});
		const parts = inputs.map((input, i) => partOf(input, i, false));
		const dash = Object.assign(document.createElement('span'), {textContent: '-'});
		dash.setAttribute('aria-hidden', 'true');
		face.setAttribute('role', 'group');
		describe(face);
		face.append(parts[0], dash, parts[1]);
		face.addEventListener('click', (event) => event.target === face && parts[parts[0].value === '' ? 0 : 1].focus());
		if (label !== undefined) {
			face.setAttribute('aria-labelledby', label.id);
			label.htmlFor = parts[0].id;
		}
		Object.assign(state, {face, parts, open});
		inputs.at(-1).after(face);
	}
	hush(state.face, state);
	anchor(state);
	state.box.append(open);
};

/** The months stand below the whole face, not the button that opened them: an anchor set through the CSSOM, which a
 *  Content-Security-Policy leaves alone. */
const anchor = (state) => {
	state.face.style.setProperty('anchor-name', '--' + state.panel.id);
	state.panel.style.setProperty('position-anchor', '--' + state.panel.id);
};

/** The face of a day and its time: in one frame, each end its day - a button that opens the months, or typed - and
 *  its time, the main script's time input; a button after them opens the months when the days are typed. */
const timedFace = (state, typed) => {
	const {label, panel, timed} = state;
	const face = Object.assign(document.createElement('div'), {className: 'form-control date-input-face date-input-timed' + (typed ? ' date-input-typed' : ''), id: panel.id + '-face'});
	face.setAttribute('role', 'group');
	label === undefined ? face.setAttribute('aria-label', timed.inputs[0].getAttribute('aria-label') ?? '') : face.setAttribute('aria-labelledby', label.id);
	const open = typed ? button('btn btn-icon btn-text date-input-open', text('date.choose'), 'bi-calendar3') : undefined;
	const days = [];
	const parts = [];
	timed.times.forEach((time, i) => {
		if (i === 1) {
			face.append(Object.assign(document.createElement('span'), {textContent: '-'}));
			face.lastChild.setAttribute('aria-hidden', 'true');
		}
		const end = Object.assign(document.createElement('span'), {className: 'date-input-end'});
		let day;
		if (typed) {
			day = Object.assign(document.createElement('input'), {type: 'text', className: 'date-input-part', id: panel.id + '-part-' + i, autocomplete: 'off', spellcheck: false});
			day.setAttribute('aria-label', timed.inputs[i].getAttribute('aria-label') ?? label?.textContent.trim() ?? '');
			day.addEventListener('keydown', (event) => {
				if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey) {
					event.preventDefault();
					open.click();
				} else if (event.key === 'Enter') {
					typedIn(state, i, true);
				}
			});
			day.addEventListener('change', () => typedIn(state, i, true));
			parts.push(day);
		} else {
			day = button('date-input-day', '');
			day.replaceChildren(Object.assign(document.createElement('i'), {className: 'bi bi-calendar3'}), Object.assign(document.createElement('span'), {className: 'date-input-value'}));
			day.firstChild.setAttribute('aria-hidden', 'true');
			for (const [name, words] of [['aria-haspopup', 'dialog'], ['aria-expanded', 'false'], ['commandfor', panel.id], ['command', 'toggle-popover']]) {
				day.setAttribute(name, words);
			}
			day.addEventListener('click', () => (timed.from = i));
			days.push(day);
		}
		end.append(day, time.box);
		face.append(end);
	});
	if (open !== undefined) {
		for (const [name, words] of [['aria-haspopup', 'dialog'], ['aria-expanded', 'false'], ['commandfor', panel.id], ['command', 'toggle-popover']]) {
			open.setAttribute(name, words);
		}
		state.box.append(open);
	}
	if (label !== undefined) {
		label.htmlFor = (parts[0] ?? days[0]).id ||= panel.id + '-day';
	}
	Object.assign(state, {face, parts, days, open});
	state.inputs.at(-1).after(face);
	panel.toggleAttribute('data-timed', true);
	hush(face, state);
	anchor(state);
};

/** The time the focus goes to as the months close after a day was chosen: the first whose day is chosen and time is
 *  not; null when none waits. */
const after = (state) => {
	const {timed} = state;
	const need = timed.picked ? state.inputs.findIndex((day, j) => day.value !== '' && timed.times[j].input.value === '') : -1;
	timed.picked = false;
	return need < 0 ? null : timed.times[need].box.querySelector('.time-input-part');
};

/** The inner parts and lists speak through the box's inputs alone: their own input and change, a part's or a list's,
 *  stop where they are. */
const hush = (element, state) => {
	for (const type of ['input', 'change']) {
		element.addEventListener(type, (event) => (state.timed?.inputs ?? state.inputs).includes(event.target) || event.stopPropagation());
	}
};

/** A date-input: its inputs turned hidden, a face named by its label, a panel with the months that the face opens. */
const buildInput = (box) => {
	const inputs = inputsOf(box, true);
	if (inputs.length === 0) {
		return;
	}
	const timed = inputs[0].type === 'datetime-local' ? {inputs, times: [], picked: false, from: null} : undefined;
	const id = 'redz-date-' + ++made;
	const label = inputs[0].labels?.[0] ?? box.querySelector(':scope > label') ?? undefined;
	const panel = Object.assign(document.createElement('div'), {className: 'menu date-input-menu', id: id + '-panel', popover: 'auto'});
	const head = Object.assign(document.createElement('div'), {className: 'date-input-head'});
	const title = Object.assign(document.createElement('span'), {className: 'date-input-title', textContent: label?.textContent.trim() ?? ''});
	const close = button('btn btn-icon btn-text', text('close'), 'bi-x-lg');
	const root = Object.assign(document.createElement('div'), {className: 'date-pick'});
	close.setAttribute('commandfor', panel.id);
	close.setAttribute('command', 'hide-popover');
	title.setAttribute('aria-hidden', 'true');
	head.append(title, close);
	panel.setAttribute('role', 'dialog');
	if (label !== undefined) {
		label.id ||= id + '-label';
		panel.setAttribute('aria-labelledby', label.id);
	} else if (inputs[0].hasAttribute('aria-label')) {
		panel.setAttribute('aria-label', inputs[0].getAttribute('aria-label'));
	}
	inputs.forEach((input) => (input.type = 'hidden'));
	// A day and its time: each end's day held apart in an input of no name, the months' own, and its time in the main
	// script's time input; their datetime-local holds the two together.
	const days = timed === undefined ? inputs : inputs.map((input, i) => {
		const time = Object.assign(document.createElement('input'), {type: 'time', value: input.value.slice(11, 16)});
		time.setAttribute('aria-label', input.getAttribute('aria-label') ?? label?.textContent.trim() ?? '');
		const holder = Object.assign(document.createElement('span'), {className: 'time-input date-input-time'});
		holder.append(time);
		timed.times.push({box: holder, input: time});
		return Object.assign(document.createElement('input'), {type: 'hidden', value: input.value.slice(0, 10)});
	});
	inputs.at(-1).after(...(timed === undefined ? [] : days), panel);
	panel.append(head, root);
	const state = mount(box, root, days, () => panel.hidePopover(), true);
	Object.assign(state, {panel, label, timed});
	states.set(box, state);
	if (timed !== undefined) {
		timed.drawn = inputs.map((input) => input.value);
		timed.first = [...timed.drawn];
		state.committed = timed.drawn.join('/');
		mirror(state);
		// The days and the times speak through their datetime-local alone.
		for (const one of [...days, ...timed.times.map((time) => time.input)]) {
			one.addEventListener('input', (event) => {
				event.stopPropagation();
				timed.picked ||= days.includes(one);
				join(state);
			});
			one.addEventListener('change', (event) => event.stopPropagation());
		}
		box.addEventListener('focusin', () => limit(state));
		box.addEventListener('focusout', (event) => {
			if (!box.contains(event.relatedTarget)) {
				requestAnimationFrame(() => box.contains(document.activeElement) || panel.matches(':popover-open') || commit(state, true));
			}
		});
	}
	makeFace(state);
	panel.addEventListener('beforetoggle', (event) => {
		if (event.newState === 'open') {
			state.quiet = false;
			prepare(state);
			state.focus = opening(state);
			const [from, to] = valuesOf(state);
			if (timed?.from === 1 && from !== null) {
				state.before = state.inputs.map((input) => input.value);
				state.start = from;
				state.focus = to ?? from;
			}
			state.shown = monthOf(state.focus);
			draw(state);
		}
	});
	panel.addEventListener('toggle', (event) => {
		const open = event.newState === 'open';
		(state.days?.length > 0 ? state.days : [state.open ?? state.face]).forEach((one) => one.setAttribute('aria-expanded', String(open)));
		state.quiet = !open;
		if (open) {
			if (timed !== undefined) {
				timed.picked = false;
			}
			state.root.querySelector('td[tabindex="0"]')?.focus();
		} else {
			finish(state);
			const time = timed === undefined ? null : after(state);
			if (time !== null) {
				time.focus();
			} else if (panel.contains(document.activeElement) || document.activeElement === document.body) {
				(state.parts[0] ?? state.days?.[timed?.from ?? 0] ?? state.face).focus();
			}
		}
	});
	drawFace(state);
};

/** Draws a date-input's face from its inputs: the words of the choice, or the typed parts but the one being refused;
 *  the inputs' disabled and required. */
const drawFace = (state, refused) => {
	if (state.face === undefined) {
		return;
	}
	if (state.timed !== undefined) {
		mirror(state);
		limit(state);
	}
	const disabled = state.inputs[0].disabled;
	if (state.days?.length > 0) {
		valuesOf(state).forEach((t, i) => {
			const day = state.days[i];
			const name = state.timed.inputs.length > 1 ? state.timed.inputs[i].getAttribute('aria-label') ?? '' : '';
			const words = t === null ? name || text('date.choose') : dateWords(state.s, t, state.box.getAttribute('data-format') === 'short');
			day.lastChild.textContent = words;
			day.toggleAttribute('data-empty', t === null);
			day.disabled = state.inputs[i].disabled;
			name !== '' && t !== null ? day.setAttribute('aria-label', name + ', ' + words) : day.removeAttribute('aria-label');
		});
		return;
	}
	if (state.parts.length === 0) {
		state.face.firstChild.textContent = choiceWords(state, true);
		state.face.disabled = disabled;
		state.inputs[0].required ? state.face.setAttribute('aria-required', 'true') : state.face.removeAttribute('aria-required');
		return;
	}
	state.open.disabled = disabled;
	valuesOf(state).forEach((t, i) => {
		const part = state.parts[i];
		Object.assign(part, {disabled, required: state.inputs[i].required, placeholder: dateWords(state.s, state.today)});
		if (part !== refused || !part.hasAttribute('aria-invalid')) {
			part.value = t === null ? '' : dateWords(state.s, t);
			part.setCustomValidity('');
			part.removeAttribute('aria-invalid');
		}
	});
};

/** Draws a box again: on the month of its inputs' days when they hold other values than it drew - a script's, a
 *  Discard's, a reset's -, else where it stands, for other bounds, rules, counts or settings. */
const redraw = (state, moved) => {
	if (moved) {
		state.drawn = state.inputs.map((input) => input.value);
		state.committed = (state.timed?.inputs ?? state.inputs).map((input) => input.value).join('/');
		state.start = null;
		prepare(state);
		state.focus = opening(state);
		state.shown = monthOf(state.focus);
	}
	if (state.panel !== undefined) {
		prepare(state);
		makeFace(state);
	}
	draw(state);
	drawFace(state);
};

/** Builds the boxes not built yet, and draws again the ones whose inputs, settings or counts changed. */
const start = (records = []) => {
	const page = records.some((record) => PAGE.includes(record.attributeName) && !record.target.matches?.(BOXES));
	for (const box of document.querySelectorAll(BOXES)) {
		const state = states.get(box);
		if (state === undefined) {
			if (!box.matches('.date-input .date-pick')) {
				box.classList.contains('date-input') ? buildInput(box) : buildPick(box);
			}
		} else if (state.timed !== undefined && state.timed.inputs.some((input, i) => input.value !== state.timed.drawn[i])) {
			split(state);
			redraw(state, true);
		} else if (state.inputs.some((input, i) => input.value !== state.drawn[i])) {
			redraw(state, true);
		} else if (page || records.some((record) => record.attributeName !== 'value' && (record.target === box || state.inputs.includes(record.target) || state.timed?.inputs.includes(record.target)))) {
			redraw(state, false);
		}
	}
};
start();
new MutationObserver(start).observe(document.documentElement, {childList: true, subtree: true, attributeFilter: ['value', 'min', 'max', 'disabled', 'readonly', 'required', 'data-counts', 'data-counts-note', 'data-count-text', 'data-format', 'data-weekday', 'data-min', 'data-max', 'data-enable', 'data-disable', 'data-min-days', 'data-max-days', 'data-unbroken', 'data-open-start', 'data-open-end', 'data-years', 'data-context', ...PAGE]});
touch.addEventListener('change', () => start([{attributeName: 'data-typing', target: document.documentElement}]));

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll(BOXES).forEach((box) => {
		const state = states.get(box);
		if (state !== undefined) {
			(state.timed?.inputs ?? state.inputs).forEach((input, i) => (input.value = (state.timed ?? state).first[i]));
			if (state.timed !== undefined) {
				split(state);
			}
			redraw(state, true);
		}
	}));
});
