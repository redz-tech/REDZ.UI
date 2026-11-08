// REDZ.UI, the page's answers: a moment only the page can carry out - creating a value, saving one - is a cancelable
// redz:* event on the widget. The page that takes the moment cancels it: with event.detail.respondWith(promise) it
// lets the widget wait and finish when the promise settles; without, the moment is all the page's. Left alone, the
// widget's own default acts.

/** Fires TYPE on ELEMENT with DETAIL: [whether the page took the moment, the promise it answered with or null]. */
export const ask = (element, type, detail) => {
	let answer = null;
	const respondWith = (promise) => {
		answer = Promise.resolve(promise);
	};
	const left = element.dispatchEvent(new CustomEvent(type, {bubbles: true, cancelable: true, detail: {...detail, respondWith}}));
	return [!left, answer];
};
