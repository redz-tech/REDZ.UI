// REDZ.UI, passwords: a button with commandfor naming a password field and command="--reveal" shows its text and
// hides it again, saying which in aria-pressed, and the field is hidden again on its form's submit and when the page
// comes back from the history; each change bubbles from the field as redz:reveal (detail.revealed). Each element with data-strength naming the field shows its level as it is typed - 0
// nothing, 1 shorter than its minlength (8 without one), 2 long enough, 3 long enough with four characters more or three
// kinds of characters (small or uncased letters, capitals, digits, the rest), 4 both, or twice the minimum: a meter at
// once as its value, and the level's words once the typing pauses - a meter's aria-valuetext, any other element's
// text - said politely when they change by a live region of the field's own: VoiceOver says nothing of a password
// field's own description changing, live or not.
import {text} from './text.js';

const COMMAND = '--reveal';
const PAUSE = 700;
const WORDS = ['', 'strength.short', 'strength.fair', 'strength.good', 'strength.strong'];
const KINDS = [/[\p{Ll}\p{Lm}\p{Lo}\p{Lt}]/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}\s]/u];
const timers = new WeakMap();
const voices = new WeakMap();

/** The field's polite live region, made at its first key - before the words it says - in its dialog or popover, which
 *  leaves the page outside inert, else in the body. */
const voiceOf = (field) => {
	let voice = voices.get(field);
	if (voice === undefined) {
		voice = Object.assign(document.createElement('span'), {className: 'visually-hidden'});
		voice.setAttribute('aria-live', 'polite');
		(field.closest('dialog, [popover]') ?? document.body).append(voice);
		voices.set(field, voice);
	}
	return voice;
};

/** Marks every --reveal button of the field pressed while its text shows. */
const press = (field, shown) => {
	for (const button of document.querySelectorAll('button[commandfor="' + CSS.escape(field.id) + '"]')) {
		if (button.getAttribute('command') === COMMAND) {
			button.setAttribute('aria-pressed', String(shown));
		}
	}
};

/** Shows or hides the field's text, and tells the page in redz:reveal. */
const reveal = (field, shown) => {
	field.type = shown ? 'text' : 'password';
	if (shown) {
		field.dataset.revealed = '';
	} else {
		delete field.dataset.revealed;
	}
	press(field, shown);
	field.dispatchEvent(new CustomEvent('redz:reveal', {bubbles: true, detail: {revealed: shown}}));
};

/** Hides the text of every revealed field within the root. */
const conceal = (root) => {
	for (const field of root.querySelectorAll('input[data-revealed]')) {
		reveal(field, false);
	}
};

/** The password's level, 0 to 4: its length against the field's minimum, and the kinds of characters in it. */
const levelOf = (field) => {
	const length = [...field.value].length;
	const least = field.minLength > 0 ? field.minLength : 8;
	if (length === 0 || length < least) {
		return length === 0 ? 0 : 1;
	}
	const varied = KINDS.filter((kind) => kind.test(field.value)).length >= 3;
	const longer = length >= least + 4;
	return length >= least * 2 || (longer && varied) ? 4 : (longer || varied ? 3 : 2);
};

/** Shows the field's level on its meters at once, and its words once the typing pauses, said by its live region when
 *  they change. */
const rate = (field) => {
	const shows = [...document.querySelectorAll('[data-strength="' + CSS.escape(field.id) + '"]')];
	const level = levelOf(field);
	const voice = voiceOf(field);
	for (const meter of shows.filter((show) => show instanceof HTMLMeterElement)) {
		meter.value = level;
	}
	clearTimeout(timers.get(field));
	timers.set(field, setTimeout(() => {
		const words = level === 0 ? '' : text(WORDS[level]);
		for (const show of shows) {
			if (!(show instanceof HTMLMeterElement)) {
				show.textContent = words;
			} else if (words === '') {
				show.removeAttribute('aria-valuetext');
			} else {
				show.setAttribute('aria-valuetext', words);
			}
		}
		if (voice.textContent !== words) {
			voice.textContent = words;
		}
	}, PAUSE));
};

document.addEventListener('command', (event) => {
	const field = event.target;
	if (event.command !== COMMAND || !(field instanceof HTMLInputElement)) {
		return;
	}
	reveal(field, field.type === 'password');
}, true);

document.addEventListener('input', (event) => {
	const field = event.target;
	if (field instanceof HTMLInputElement && field.id !== '' && document.querySelector('[data-strength="' + CSS.escape(field.id) + '"]') !== null) {
		rate(field);
	}
}, true);

document.addEventListener('submit', (event) => {
	if (event.target instanceof HTMLFormElement) {
		conceal(event.target);
	}
}, true);

addEventListener('pageshow', () => conceal(document));
