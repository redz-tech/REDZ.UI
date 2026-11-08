// REDZ.UI, status lines: REDZ.ui.status(line, promise) says in an element .form-status what a save is doing - the
// page's text "status.saving" with a spinner once it waits past 400 ms, then "status.saved" with a check, which fades
// after three seconds, or the rejection's own message with a danger icon, which stays - and answers the promise.
// REDZ.ui.status(line, {tone, text}) says the words at once with the tone's icon: success and info fade, warning and
// danger stay, and so does any with keep: true; REDZ.ui.status(line, null) empties the line. Each line holds a polite
// status, made at load, that says each message once; a later call wins.
import {text} from './text.js';

const WAIT = 400;
const SHOWN = 3000;
const FADE = 300;
const ICONS = {info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon'};
const calls = new WeakMap();

/** The line's polite status, made now when it has none; whether it was just made. */
const statusOf = (line) => {
	let region = line.querySelector(':scope > [role="status"]');
	if (region !== null) {
		return {region, fresh: false};
	}
	region = document.createElement('span');
	region.setAttribute('role', 'status');
	line.append(region);
	return {region, fresh: true};
};

document.querySelectorAll('.form-status').forEach(statusOf);

/** Shows and says the words of call $call in the tone - pending, info, success, warning or danger. */
const put = (line, call, tone, words, keep = false) => {
	if (calls.get(line) !== call) {
		return;
	}
	const {region, fresh} = statusOf(line);
	delete line.dataset.fading;
	line.dataset.tone = tone;
	const icon = document.createElement(tone === 'pending' ? 'span' : 'i');
	icon.className = tone === 'pending' ? 'spinner-border' : 'bi bi-' + (ICONS[tone] ?? ICONS.info);
	icon.setAttribute('aria-hidden', 'true');
	const show = () => {
		if (calls.get(line) === call) {
			region.replaceChildren(icon, Object.assign(document.createElement('span'), {textContent: words}));
		}
	};
	if (fresh) {
		setTimeout(show, 100);
	} else {
		show();
	}
	if ((tone === 'success' || tone === 'info') && !keep) {
		setTimeout(() => {
			if (calls.get(line) !== call) {
				return;
			}
			line.dataset.fading = '';
			setTimeout(() => {
				if (calls.get(line) === call) {
					region.replaceChildren();
					delete line.dataset.fading;
					delete line.dataset.tone;
				}
			}, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : FADE);
		}, SHOWN);
	}
};

/** Says in the line what the promise does, or the words of {tone, text}, or empties it for null; answers the promise. */
export const status = (line, what) => {
	const call = (calls.get(line) ?? 0) + 1;
	calls.set(line, call);
	if (what === null) {
		statusOf(line).region.replaceChildren();
		delete line.dataset.fading;
		delete line.dataset.tone;
		return Promise.resolve();
	}
	if (typeof what?.then !== 'function') {
		put(line, call, what?.tone ?? 'info', what?.text ?? '', what?.keep === true);
		return Promise.resolve();
	}
	const promise = Promise.resolve(what);
	const waiting = setTimeout(() => put(line, call, 'pending', text('status.saving')), WAIT);
	promise.then(() => {
		clearTimeout(waiting);
		put(line, call, 'success', text('status.saved'));
	}, (error) => {
		clearTimeout(waiting);
		put(line, call, 'danger', error instanceof Error ? error.message : String(error ?? ''));
	});
	return promise;
};
