// REDZ.UI, growing fields: a textarea with data-grow starts at its rows - rows="1" one line - and grows with its text:
// field-sizing where the engine has it (Chrome 123, Firefox 152, Safari 26.2), else its height from its scrollHeight
// on input, reset and load. A cap is the page's max-block-size (max-h-*); past it, the field scrolls.
const sized = CSS.supports('field-sizing', 'content');

/** Gives the field its rows as the floor of its height, and below field-sizing its text's height. */
const fit = (field) => {
	field.style.setProperty('--redz-grow-rows', String(field.rows || 1));
	if (!sized && field.getClientRects().length > 0) {
		field.style.blockSize = 'auto';
		field.style.blockSize = field.scrollHeight + field.offsetHeight - field.clientHeight + 'px';
	}
};

const grows = (node) => node instanceof HTMLTextAreaElement && node.hasAttribute('data-grow');

document.querySelectorAll('textarea[data-grow]').forEach(fit);

document.addEventListener('input', (event) => {
	if (grows(event.target)) {
		fit(event.target);
	}
});

document.addEventListener('reset', (event) => {
	setTimeout(() => event.target.querySelectorAll('textarea[data-grow]').forEach(fit));
});

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(grows(node) ? [node] : []).concat([...node.querySelectorAll('textarea[data-grow]')]).forEach(fit);
			}
		}
	}
}).observe(document.documentElement, {subtree: true, childList: true});
