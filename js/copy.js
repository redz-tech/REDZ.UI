// REDZ.UI, copy: a button with command="--copy" copies its data-copy, or the value of the field aria-controls names, or
// that element's text; it says politely that it did - the page's texts copy.done and copy.failed -, shows a check in
// place of its icon for a moment, and tells the page in redz:copy (detail.text). Where the Clipboard API is missing - a
// page over plain http - a hidden field and the browser's copy command stand in. Like --toggle, it has no commandfor.
import {text} from './text.js';
import {announce} from './say.js';

const shown = new WeakMap();

/** The words the button copies, or null. */
const wordsOf = (button) => {
	if (button.hasAttribute('data-copy')) {
		return button.dataset.copy;
	}
	const target = document.getElementById((button.getAttribute('aria-controls') || '').trim());
	return target === null ? null : (target.matches('input, textarea, select') ? target.value : target.textContent.trim());
};

/** Copies the words by a hidden field and the browser's copy command, the focus put back. */
const byField = (words, button) => {
	const field = Object.assign(document.createElement('textarea'), {value: words, readOnly: true, className: 'visually-hidden'});
	([...document.querySelectorAll('dialog:modal')].at(-1) ?? document.body).append(field);
	field.focus();
	field.select();
	const done = document.execCommand('copy');
	field.remove();
	button.focus();
	return done ? Promise.resolve() : Promise.reject(new Error('copy refused'));
};

/** Puts a check in place of the button's icon for a moment. */
const check = (button) => {
	const icon = button.querySelector('.bi');
	if (icon === null) {
		return;
	}
	const [was, timer] = shown.get(button) ?? [icon.className, 0];
	clearTimeout(timer);
	icon.className = 'bi bi-check-lg';
	shown.set(button, [was, setTimeout(() => {
		icon.className = was;
		shown.delete(button);
	}, 1500)]);
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('[command="--copy"]') : null;
	const words = button === null || button.disabled || button.getAttribute('aria-disabled') === 'true' ? null : wordsOf(button);
	if (words === null) {
		return;
	}
	(navigator.clipboard?.writeText ? navigator.clipboard.writeText(words) : byField(words, button)).then(() => {
		check(button);
		announce(text('copy.done'));
		button.dispatchEvent(new CustomEvent('redz:copy', {bubbles: true, detail: {text: words}}));
	}, () => announce(text('copy.failed')));
});
