// REDZ.UI, highlights: elements that share a data-highlight key light together - a chart's lane and the row of the same
// thing in a table, say. Hovering or focusing one marks every element with its key data-highlighted, which the stylesheet
// tints; the mark moves when the pointer or the focus goes to another key and goes when they leave every one.
let lit = '';

/** Marks the elements of the key, and only them. */
const light = (key) => {
	if (key === lit) {
		return;
	}
	for (const element of document.querySelectorAll('[data-highlighted]')) {
		element.removeAttribute('data-highlighted');
	}
	lit = key;
	if (key !== '') {
		for (const element of document.querySelectorAll('[data-highlight="' + CSS.escape(key) + '"]')) {
			element.setAttribute('data-highlighted', '');
		}
	}
};

/** The key of the element or the one around it, '' when none. */
const keyOf = (target) => target instanceof Element ? target.closest('[data-highlight]')?.getAttribute('data-highlight') ?? '' : '';

document.addEventListener('pointerover', (event) => light(keyOf(event.target)));
document.addEventListener('focusin', (event) => light(keyOf(event.target)));
document.addEventListener('focusout', (event) => light(keyOf(event.relatedTarget)));
