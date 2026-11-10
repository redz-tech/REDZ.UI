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
// with it, as the menu closes. Any other element - a cell that checks, a line - shows a small ring after 400 ms and,
// for a screen reader, the words of its data-busy or "busy", saying nothing aloud.
import {text} from './text.js';
import {announce} from './say.js';
import {take, leave} from './hold.js';
import {openerOf} from './commands.js';

const SHOW = 400;
const HOLD = 400;
const REGIONS = '.card, .card-body, .dialog-body, .drawer-body, .region, .app-main';
const LIVE = '[aria-live], [role="status"], [role="alert"], [role="log"]';

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[aria-disabled="true"], .btn[aria-disabled="true"], input:is([type="checkbox"], [type="radio"])[aria-disabled="true"]') : null;
	if (button !== null) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}, true);

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
	const shown = setTimeout(() => element.append(ring, words), SHOW);
	return Promise.resolve(promise).finally(() => {
		clearTimeout(shown);
		ring.remove();
		words.remove();
		element.removeAttribute('aria-busy');
	});
};

/** Marks the element busy until the promise settles; answers the promise. */
export const busy = (element, promise) => {
	if (element.matches(LIVE) || element.querySelector(LIVE) !== null) {
		console.error('REDZ.UI: busy() on or around a live region breaks it in screen readers - mark an element without one');
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
