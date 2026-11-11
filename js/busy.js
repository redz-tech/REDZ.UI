// REDZ.UI, busy: REDZ.ui.busy() marks an element aria-busy while a promise runs and answers the promise. A button is
// marked aria-disabled too, which keeps its focus and, as for every button, check, radio or switch so marked, swallows
// its clicks; its leading icon turns into a spinner, or a spinner covers its words when it has none, and a data-busy
// on it says other words while it waits - shown at once, said politely after 400 ms. A region -
// a card, its body, a dialog's or a drawer's body, any .region, the app shell's main column - turns inert under an
// overlay that shows after 400 ms (css/components/busy.css) and then stays at least 400 ms; once it shows, one polite
// message says so (the page's text "busy"), and a focus the region dropped comes back to the same element, its namesake
// by id, or the region. The page's own picture, a .busy-art child, shows in place of the ring; the main column, which
// may be taller than the window, is given one with the ring while it has none. aria-busy is only a styling hook: screen
// readers mostly ignore it, and on a live region it breaks the region. A button that
// counts a cooldown meanwhile stays disabled until its count ends too (js/hold.js). A region's data-busy says its own
// words under the spinner and aloud instead of "busy". An item of a menu holds the button that opened the menu busy
// with it, as the menu closes. A check, a radio or a switch the person has just flipped is marked aria-disabled too and
// keeps its look, its cursor progress: after 400 ms its mark - a switch's knob - turns into a spinning ring and the words
// of its data-busy or "busy" are said politely; a radio's whole group swallows clicks and arrow keys meanwhile. Resolved,
// the flip stays; refused, it goes back without a change event - a radio to the choice its group held at the person's
// press, key or focus before it - and the refusal's words, an Error's or an object's message or a string, are a danger
// toast, while an empty one or an AbortError says nothing. One with data-apply fires the cancelable redz:apply
// {checked, value, signal} on its change (js/answer.js) - a newer one of the control or of its radio group aborts the
// last one's signal -: answered with a promise, it is busy until the promise settles. Any other element - a cell that
// checks, a line, a field - shows a small ring after 400 ms, inside it or after a field, and, for a screen reader, the
// words of its data-busy or "busy", saying nothing aloud.
import {ask} from './answer.js';
import {text} from './text.js';
import {announce} from './say.js';
import {take, leave} from './hold.js';
import {openerOf} from './commands.js';
import {toast} from './toast.js';

const SHOW = 400;
const HOLD = 400;
const REGIONS = '.card, .card-body, .dialog-body, .drawer-body, .region, .app-main';
const LIVE = '[aria-live], [role="status"], [role="alert"], [role="log"]';
const CHECKS = 'input:is(.check, .radio, .switch)';
const applying = new WeakMap();
let noted = null;

/** The radios of the radio's group: those of its name in its form, or in the page outside a form. */
export const groupOf = (radio) => radio.name === '' ? [radio] : [...(radio.form?.elements ?? document.querySelectorAll('input'))].filter((one) => one.type === 'radio' && one.name === radio.name && one.form === radio.form);

/** Whether a radio of the radio's group is busy. */
const held = (radio) => groupOf(radio).some((one) => one.matches('[aria-busy="true"]'));

document.addEventListener('click', (event) => {
	const target = event.target;
	if (target.closest?.('button[aria-disabled="true"], .btn[aria-disabled="true"], input:is([type="checkbox"], [type="radio"])[aria-disabled="true"]') || (target.type === 'radio' && held(target))) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}, true);

for (const type of ['pointerdown', 'keydown', 'focusin']) {
	document.addEventListener(type, (event) => {
		const radio = event.target.closest?.('label')?.control ?? event.target;
		if (radio.type !== 'radio') {
			return;
		}
		if (held(radio)) {
			if (event.key?.startsWith('Arrow')) {
				event.preventDefault();
			}
			return;
		}
		const group = groupOf(radio);
		noted = [group, group.find((one) => one.checked) ?? null];
	}, true);
}

document.addEventListener('change', (event) => {
	const control = event.target;
	if (!control.matches?.(CHECKS + '[data-apply]')) {
		return;
	}
	const key = control.type === 'radio' ? groupOf(control)[0] : control;
	const controller = new AbortController();
	applying.get(key)?.abort();
	applying.set(key, controller);
	const [, answer] = ask(control, 'redz:apply', {checked: control.checked, value: control.value, signal: controller.signal});
	if (answer !== null) {
		busy(control, answer).catch(() => {});
	}
});

/** Holds the region inert under its overlay until the promise settles; answers the promise. */
export const hold = (element, promise) => {
	const focused = element.contains(document.activeElement) ? document.activeElement : null;
	const started = performance.now();
	const words = element.dataset.busy ?? '';
	let made = null;
	if (element.matches('.app-main') && element.querySelector(':scope > .busy-art') === null) {
		made = Object.assign(document.createElement('div'), {className: 'busy-art'});
		made.setAttribute('aria-hidden', 'true');
		made.append(Object.assign(document.createElement('span'), {className: 'spinner-border'}));
		element.prepend(made);
	}
	const said = words === '' ? null : Object.assign(document.createElement('span'), {className: 'busy-words', textContent: words});
	said?.setAttribute('aria-hidden', 'true');
	if (said !== null) {
		(element.querySelector(':scope > .busy-art') ?? element).append(said);
	}
	element.setAttribute('aria-busy', 'true');
	element.inert = true;
	const shown = setTimeout(() => announce(words || text('busy')), SHOW);
	return Promise.resolve(promise).finally(async () => {
		clearTimeout(shown);
		said?.remove();
		const held = performance.now() - started;
		if (held >= SHOW && held < SHOW + HOLD) {
			await new Promise((done) => setTimeout(done, SHOW + HOLD - held));
		}
		made?.remove();
		element.removeAttribute('aria-busy');
		element.inert = false;
		if (focused === null || (document.activeElement !== null && document.activeElement !== document.body)) {
			return;
		}
		const again = focused.isConnected || focused.id === '' ? focused : document.getElementById(focused.id);
		if (again !== null && element.contains(again)) {
			again.focus();
			return;
		}
		if (!element.hasAttribute('tabindex')) {
			element.tabIndex = -1;
		}
		element.focus();
	});
};

/** Shows a small ring in the element after a moment, and its words to a screen reader, until the promise settles. */
const mark = (element, promise) => {
	const ring = Object.assign(document.createElement('span'), {className: 'spinner-border busy-ring'});
	ring.setAttribute('aria-hidden', 'true');
	const words = Object.assign(document.createElement('span'), {className: 'visually-hidden', textContent: element.dataset.busy || text('busy')});
	element.setAttribute('aria-busy', 'true');
	const shown = setTimeout(() => element.matches('input, select, textarea') ? element.after(ring, words) : element.append(ring, words), SHOW);
	return Promise.resolve(promise).finally(() => {
		clearTimeout(shown);
		ring.remove();
		words.remove();
		element.removeAttribute('aria-busy');
	});
};

/** Holds a check, a radio or a switch the person flipped until the promise settles; refused, the flip goes back. */
const flipped = (element, promise) => {
	const before = element.type === 'radio' ? (noted?.[0].includes(element) ? noted[1] : null) : !element.checked;
	element.setAttribute('aria-busy', 'true');
	take(element, 'busy');
	const said = setTimeout(() => announce(element.dataset.busy || text('busy')), SHOW);
	return Promise.resolve(promise).finally(() => {
		clearTimeout(said);
		element.removeAttribute('aria-busy');
		leave(element, 'busy');
	}).catch((reason) => {
		if (element.type === 'radio') {
			(before ?? element).checked = before !== null;
		} else {
			element.checked = before;
		}
		const words = typeof reason === 'string' ? reason : typeof reason?.message === 'string' ? reason.message : '';
		if (words !== '' && reason?.name !== 'AbortError') {
			toast({tone: 'danger', text: words});
		}
		throw reason;
	});
};

/** Marks the element busy until the promise settles; answers the promise. */
export const busy = (element, promise) => {
	if (element.matches(LIVE) || element.querySelector(LIVE) !== null) {
		console.error('REDZ.UI: busy() on or around a live region breaks it in screen readers - mark an element without one');
	}
	if (element.matches(CHECKS)) {
		return flipped(element, promise);
	}
	const button = element.matches('button, .btn');
	if (!button && element.matches(REGIONS)) {
		return hold(element, promise);
	}
	if (!button) {
		return mark(element, promise);
	}
	const menu = element.closest('[popover]');
	const opener = menu === null ? null : openerOf(menu);
	if (opener !== null && opener !== element && !opener.contains(element)) {
		busy(opener, promise).catch(() => {});
	}
	const words = element.dataset.busy ?? '';
	const kept = [...element.childNodes];
	element.setAttribute('aria-busy', 'true');
	take(element, 'busy');
	if (words !== '') {
		const lead = element.firstElementChild?.matches('.bi') ? element.firstElementChild : Object.assign(document.createElement('i'), {className: 'bi'});
		lead.setAttribute('aria-hidden', 'true');
		element.replaceChildren(lead, words);
	}
	const said = words === '' ? 0 : setTimeout(() => announce(words), SHOW);
	return Promise.resolve(promise).finally(() => {
		clearTimeout(said);
		if (words !== '') {
			element.replaceChildren(...kept);
		}
		element.removeAttribute('aria-busy');
		leave(element, 'busy');
	});
};
