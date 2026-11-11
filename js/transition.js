// REDZ.UI, the change of pages, as <html data-transition> says: fade, the default, and instant are the stylesheet's
// alone (css/components/app.css); none skips the view transition the stylesheet asks for, on the page that leaves and
// on the page that comes; busy holds the app shell's main column under the busy overlay, from 400 ms into a navigation
// that leaves this page for another of this site, where the browser has the Navigation API. A navigation to another tab,
// window or target, a download, a fragment of this page and one a handler prevents or takes over are not such. The
// overlay lifts as the page comes back from the back-forward cache, the navigation fails, Escape stops it or after ten
// seconds, as a navigation that turns into a download or that the browser's stop ends tells the page nothing; while a
// tracked form's changes have the browser ask before the page goes (js/track.js), no overlay starts, nor for a
// navigation ended before the overlay would start - the page's own question before leaving answered Stay, a stop().
import {hold} from './busy.js';
import {guarding} from './track.js';

const LONGEST = 10000;
let lift = null;

/** The page's data-transition. */
const mode = () => document.documentElement.dataset.transition;

/** Holds the main column busy until lift() is called. */
const veil = () => {
	const main = document.querySelector('.app-main');
	if (main === null || mode() !== 'busy' || lift !== null) {
		return;
	}
	let done = () => {};
	const ends = new Promise((resolve) => {
		done = resolve;
	});
	const timer = setTimeout(() => lift?.(), LONGEST);
	lift = () => {
		clearTimeout(timer);
		lift = null;
		done();
	};
	hold(main, ends);
};

const skip = (event) => {
	for (const promise of [event.viewTransition?.ready, event.viewTransition?.finished, event.viewTransition?.updateCallbackDone]) {
		promise?.catch(() => {});
	}
	if (mode() === 'none') {
		event.viewTransition?.skipTransition();
	}
};
addEventListener('pageswap', skip);
addEventListener('pagereveal', skip);

globalThis.navigation?.addEventListener('navigate', (event) => {
	const url = new URL(event.destination.url);
	if (event.hashChange || (event.downloadRequest ?? null) !== null || event.destination.sameDocument || url.origin !== location.origin) {
		return;
	}
	setTimeout(() => {
		if (!event.defaultPrevented && !event.signal.aborted && navigation.transition === null && !guarding()) {
			veil();
		}
	});
});
globalThis.navigation?.addEventListener('navigateerror', () => lift?.());
addEventListener('pageshow', (event) => {
	if (event.persisted) {
		lift?.();
	}
});
addEventListener('keydown', (event) => {
	if (event.key === 'Escape') {
		lift?.();
	}
});
