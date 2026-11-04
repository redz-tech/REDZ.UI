// REDZ.UI, busy: REDZ.ui.busy() marks an element aria-busy while a promise runs and answers the promise. A button is
// marked aria-disabled too, which keeps its focus and, as for every button, check, radio or switch so marked, swallows
// its clicks; its leading icon turns into a spinner, or a spinner covers its words when it has none, and a data-busy
// on it says other words while it waits - shown at once, said politely after 400 ms. A region -
// a card, its body, a dialog's or a drawer's body, any .region - turns inert under an overlay that shows after 400 ms
// (css/components/busy.css) and then stays at least 400 ms; once it shows, one polite message says so (the page's text
// "busy"), and a focus the region dropped comes back to the same element, its namesake by id, or the region. aria-busy
// is only a styling hook: screen readers mostly ignore it, and on a live region it breaks the region. A button that
// counts a cooldown meanwhile stays disabled until its count ends too (js/hold.js).
import {text} from './text.js';
import {announce} from './say.js';
import {take, leave} from './hold.js';

const SHOW = 400;
const HOLD = 400;
const REGIONS = '.card, .card-body, .dialog-body, .drawer-body, .region';
const LIVE = '[aria-live], [role="status"], [role="alert"], [role="log"]';

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[aria-disabled="true"], .btn[aria-disabled="true"], input:is([type="checkbox"], [type="radio"])[aria-disabled="true"]') : null;
	if (button !== null) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}, true);

/** Holds the region inert under its overlay until the promise settles; answers the promise. */
const hold = (element, promise) => {
	const focused = element.contains(document.activeElement) ? document.activeElement : null;
	const started = performance.now();
	element.setAttribute('aria-busy', 'true');
	element.inert = true;
	const shown = setTimeout(() => announce(text('busy')), SHOW);
	return Promise.resolve(promise).finally(async () => {
		clearTimeout(shown);
		const held = performance.now() - started;
		if (held >= SHOW && held < SHOW + HOLD) {
			await new Promise((done) => setTimeout(done, SHOW + HOLD - held));
		}
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
		console.error('REDZ.UI: busy() takes a button or a region (' + REGIONS + ')');
	}
	const words = button ? element.dataset.busy ?? '' : '';
	const kept = [...element.childNodes];
	element.setAttribute('aria-busy', 'true');
	if (button) {
		take(element, 'busy');
	}
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
		if (button) {
			leave(element, 'busy');
		}
	});
};
