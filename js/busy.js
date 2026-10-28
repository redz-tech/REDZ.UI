// REDZ.UI, busy: REDZ.ui.busy() marks an element aria-busy while a promise runs — a button aria-disabled too, which
// keeps its focus and, as for every button so marked, swallows its clicks — and answers the promise.
document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[aria-disabled="true"], .btn[aria-disabled="true"]') : null;
	if (button !== null) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}, true);

/** Marks the element busy until the promise settles; answers the promise. */
export const busy = (element, promise) => {
	const button = element.matches('button, .btn');
	const disabled = element.getAttribute('aria-disabled');
	element.setAttribute('aria-busy', 'true');
	if (button) {
		element.setAttribute('aria-disabled', 'true');
	}
	return Promise.resolve(promise).finally(() => {
		element.removeAttribute('aria-busy');
		if (button && disabled === null) {
			element.removeAttribute('aria-disabled');
		}
	});
};
