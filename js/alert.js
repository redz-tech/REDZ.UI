// REDZ.UI, alerts from code: REDZ.ui.alert(box, {tone, text}) fills a box with an alert of the tone - its class, its
// icon and the words, text and never HTML - and says them: politely, at once for danger; the same words again are said
// again. REDZ.ui.alert(box, null) empties the box, which then takes no room. REDZ.ui.alert(box, promise) shows the page's
// text "busy" with a spinner once it waits past 400 ms, then the {tone, text} the promise answers - nothing empties
// the box - or the rejection's message as danger; it answers the promise. A later call wins. The box carries no live
// role: a box a screen reader met empty may never speak, so the words go through the page's hidden status.
import {text} from './text.js';
import {announce} from './say.js';

const WAIT = 400;
const ICONS = {primary: 'info-circle', secondary: 'info-circle', info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon'};
const calls = new WeakMap();

/** Writes the words in the tone into the box, a spinner for pending; empty words empty it. */
const fill = (box, tone, words, quiet = false) => {
	const shade = tone in ICONS ? tone : 'info';
	box.classList.remove(...Object.keys(ICONS).map((name) => 'alert-' + name));
	box.classList.add('alert');
	if (words === '') {
		box.replaceChildren();
		return;
	}
	if (tone !== 'pending') {
		box.classList.add('alert-' + shade);
	}
	const icon = document.createElement(tone === 'pending' ? 'span' : 'i');
	icon.className = tone === 'pending' ? 'spinner-border' : 'bi bi-' + ICONS[shade];
	icon.setAttribute('aria-hidden', 'true');
	box.replaceChildren(icon, Object.assign(document.createElement('div'), {textContent: words}));
	if (!quiet) {
		announce(words, tone === 'danger');
	}
};

/** Fills the box with {tone, text}, empties it for null, or follows a promise; answers the promise. */
export const alert = (box, what) => {
	const call = (calls.get(box) ?? 0) + 1;
	calls.set(box, call);
	if (typeof what?.then !== 'function') {
		fill(box, what?.tone ?? 'info', what === null ? '' : String(what?.text ?? ''));
		return Promise.resolve();
	}
	const promise = Promise.resolve(what);
	const waiting = setTimeout(() => calls.get(box) === call && fill(box, 'pending', text('busy'), true), WAIT);
	promise.then((done) => {
		clearTimeout(waiting);
		if (calls.get(box) === call) {
			fill(box, done?.tone ?? 'info', String(done?.text ?? ''));
		}
	}, (error) => {
		clearTimeout(waiting);
		if (calls.get(box) === call) {
			fill(box, 'danger', error instanceof Error ? error.message : String(error ?? ''));
		}
	});
	return promise;
};
