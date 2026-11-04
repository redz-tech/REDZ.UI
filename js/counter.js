// REDZ.UI, counters: an element .form-counter with data-counter naming a field shows how much is typed against the most -
// the field's maxlength, or the counter's data-counter-max, which lets the text go over - as "123 / 320" in the page's
// digits, in data-state "near" from nine tenths and "over" past the most. Once the typing pauses, near or over, the
// count is said politely in the page's text "counter", only when it changed: a count said at every key would drown
// the typing.
import {text} from './text.js';

const PAUSE = 1000;
const NEAR = 0.9;
const timers = new WeakMap();
const said = new WeakMap();
const voices = new WeakMap();

/** The counter's polite live region, made at the field's first key - before the words it says - beside it. */
const voiceOf = (counter) => {
	let voice = voices.get(counter);
	if (voice === undefined) {
		voice = Object.assign(document.createElement('span'), {className: 'visually-hidden'});
		voice.setAttribute('aria-live', 'polite');
		counter.after(voice);
		voices.set(counter, voice);
	}
	return voice;
};

/** The most the counter holds the field to, or 0 without one. */
const mostOf = (counter, field) => Number.parseInt(counter.dataset.counterMax ?? '', 10) || (field.maxLength > 0 ? field.maxLength : 0);

/** Writes the count, its state, and, once the typing pauses, says it when near or over. */
const count = (counter, typed) => {
	const field = document.getElementById(counter.dataset.counter || '');
	if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
		return;
	}
	const most = mostOf(counter, field);
	const length = field.value.length;
	const digits = new Intl.NumberFormat(document.documentElement.lang || 'en');
	counter.textContent = most > 0 ? digits.format(length) + ' / ' + digits.format(most) : digits.format(length);
	const state = most > 0 && length > most ? 'over' : (most > 0 && length >= most * NEAR ? 'near' : '');
	if (state === '') {
		delete counter.dataset.state;
	} else {
		counter.dataset.state = state;
	}
	clearTimeout(timers.get(counter));
	if (!typed) {
		return;
	}
	const voice = voiceOf(counter);
	timers.set(counter, setTimeout(() => {
		const words = state === '' ? '' : text('counter', {count: digits.format(length), max: digits.format(most)});
		if (words !== '' && said.get(counter) !== words) {
			voice.textContent = words;
		}
		said.set(counter, words);
	}, PAUSE));
};

const countersOf = (field) => field.id === '' ? [] : [...document.querySelectorAll('.form-counter[data-counter="' + CSS.escape(field.id) + '"]')];

document.querySelectorAll('.form-counter[data-counter]').forEach((counter) => count(counter, false));

document.addEventListener('input', (event) => {
	if (event.target instanceof Element) {
		countersOf(event.target).forEach((counter) => count(counter, true));
	}
});

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll('input, textarea').forEach((field) => countersOf(field).forEach((counter) => count(counter, false))));
});
