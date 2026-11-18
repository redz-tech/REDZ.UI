// REDZ.UI, ticking times: a time element with a datetime - ISO, with its zone - and data-elapsed shows the time since
// then as a clock, m:ss under an hour and h:mm:ss after; one with data-ago says how long ago it was, or how soon it
// comes ("5 minutes ago", or "5 min. ago" with data-ago="short"); one with data-local shows the moment by the reader's
// own clock - the time, the date and time with data-local="date", and with data-local="auto" the time on the reader's
// today, the weekday and time in the six days ahead, else the date and time. Words are in the language of the nearest
// lang, the full moment with the reader's zone in the title. One ticker serves them all: each second while an elapsed
// time is on the page, else every 30 seconds, still while the page is hidden. They are never read out.
import {langAt, locales} from './text.js';

const SELECTOR = 'time[data-elapsed], time[data-ago], time[data-local]';
const UNITS = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
const titles = new WeakMap();
const forms = new Map();
let timer = 0;

/** Seconds from the element's moment to now; NaN when it has none. */
const since = (time) => (Date.now() - Date.parse(time.dateTime)) / 1000;

/** The clock of so many seconds: m:ss, or h:mm:ss from an hour. */
const clock = (seconds) => {
	const whole = Math.max(0, Math.floor(seconds));
	const pad = (n) => String(n).padStart(2, '0');
	const hours = Math.floor(whole / 3600);
	return (hours > 0 ? hours + ':' + pad(Math.floor(whole / 60) % 60) : Math.floor(whole / 60)) + ':' + pad(whole % 60);
};

/** Words for so many seconds ago, or ahead when negative, long or short. */
const ago = (seconds, lang, style) => {
	const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? UNITS.at(-1);
	return new Intl.RelativeTimeFormat(locales(lang), {numeric: 'auto', style}).format(-Math.round(seconds / size), unit);
};

/** Hour and minute as the language writes its short time: 07:00 in Russian, 7:00 AM in American English. */
const clockOf = (lang) => forms.get(lang) ?? forms.set(lang, {hour: new Intl.DateTimeFormat(locales(lang), {timeStyle: 'short', timeZone: 'UTC'}).formatToParts(Date.UTC(2000, 0, 1, 7)).find((part) => part.type === 'hour')?.value.length === 2 ? '2-digit' : 'numeric', minute: '2-digit'}).get(lang);

/** The reader's calendar day of a moment, as a whole number. */
const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

/** The moment by the reader's clock: the time, the date and time, or for "auto" as much as its distance from today needs. */
const local = (moment, lang, mode) => {
	const ahead = day(moment) - day(new Date());
	const hours = clockOf(lang);
	const options = mode === 'date' ? {dateStyle: 'medium', timeStyle: 'short'}
		: mode !== 'auto' || ahead === 0 ? hours
		: ahead > 0 && ahead < 7 ? {weekday: 'short', ...hours}
		: {day: 'numeric', month: 'short', ...(moment.getFullYear() === new Date().getFullYear() ? {} : {year: 'numeric'}), ...hours};
	return new Intl.DateTimeFormat(locales(lang), options).format(moment);
};

/** Writes every ticking time and plans the next tick. */
const tick = () => {
	clearTimeout(timer);
	let next = 30000;
	for (const time of document.querySelectorAll(SELECTOR)) {
		const seconds = since(time);
		if (Number.isNaN(seconds)) {
			continue;
		}
		const lang = langAt(time);
		const moment = new Date(time.dateTime);
		if (time.hasAttribute('data-elapsed')) {
			time.textContent = clock(seconds);
			next = Math.min(next, 1010 - (Math.max(0, seconds) * 1000) % 1000);
			continue;
		}
		time.textContent = time.hasAttribute('data-ago') ? ago(seconds, lang, time.dataset.ago === 'short' ? 'short' : 'long') : local(moment, lang, time.dataset.local);
		if (time.title === '' || time.title === titles.get(time)) {
			time.title = new Intl.DateTimeFormat(locales(lang), {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...clockOf(lang), timeZoneName: 'short'}).format(moment);
			titles.set(time, time.title);
		}
	}
	if (!document.hidden) {
		timer = setTimeout(tick, next);
	}
};

document.addEventListener('visibilitychange', tick);
new MutationObserver((records) => {
	if (records.some((record) => record.type === 'attributes' || [...record.addedNodes].some((node) => node instanceof Element && (node.matches(SELECTOR) || node.querySelector(SELECTOR))))) {
		tick();
	}
}).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['datetime', 'data-elapsed', 'data-ago', 'data-local', 'lang']});
tick();
