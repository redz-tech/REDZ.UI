// REDZ.UI, a flash: REDZ.ui.flash(element, words) shows a result a person sees in the field itself - an agent added, a
// photo attached - in place of a toast: the element, or the face a time or date input draws for its hidden input,
// lights in the success tone and fades in 2 s, and the page's words, when it gives them, are said politely. Under less
// motion the tone holds for the 2 s and goes. A tracked form flashes the fields a save took (js/track.js).
import {announce} from './say.js';

const SHOWN = 2000;
const timers = new WeakMap();

/** Lights the element - a hidden input's face - for 2 s, from the start again when it already does; says the words. */
export const flash = (element, words = '') => {
	const face = element instanceof HTMLInputElement && element.type === 'hidden' ? element.parentElement?.querySelector(':scope:is(.time-input, .date-input) > :is(.time-input-face, .date-input-face)') : null;
	const target = face ?? element;
	clearTimeout(timers.get(target));
	target.removeAttribute('data-flash');
	// A style read between the two writes starts the animation again.
	void target.offsetWidth;
	target.setAttribute('data-flash', '');
	timers.set(target, setTimeout(() => target.removeAttribute('data-flash'), SHOWN));
	if (words !== '') {
		announce(words);
	}
};
