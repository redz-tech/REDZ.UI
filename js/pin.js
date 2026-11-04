// REDZ.UI, PIN pads: a .pin around one password field with inputmode="numeric" and a maxlength draws the field's dots
// under it - the field lies over them, so a tap there still opens the keyboard - and a keypad of 1-9, 0 and delete,
// its keys out of the Tab order and never taking the focus, since the keyboard types into the field. A minlength below
// the maxlength lets any length between: the dots grow as it is typed and the keypad gets an Enter key. A fixed length
// goes when its last digit lands, any length on Enter: the pad asks the page in redz:pin (detail.value) and is busy -
// dimmed, the field read-only, the keys swallowed - while the page's promise runs; false clears the field and marks it
// wrong (red dots and one shake), true leaves it while the page goes on. Left to itself the pad submits the form.
import {ask} from './answer.js';
import {text} from './text.js';

const ready = new WeakSet();

/** A keypad key: its words or icon, the key it stands for and, for an icon, its name. */
const key = (value, name = '', glyph = '') => {
	const button = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', tabIndex: -1});
	button.dataset.key = value;
	if (glyph === '') {
		button.textContent = value;
	} else {
		const icon = Object.assign(document.createElement('i'), {className: 'bi bi-' + glyph});
		icon.setAttribute('aria-hidden', 'true');
		button.append(icon);
		button.setAttribute('aria-label', name);
	}
	return button;
};

const setUp = (pin) => {
	const field = pin.querySelector(':scope > input');
	if (field === null || ready.has(pin)) {
		return;
	}
	ready.add(pin);
	const length = field.maxLength > 0 ? field.maxLength : 8;
	const fixed = field.minLength < 1 || field.minLength >= length;
	const least = fixed ? length : field.minLength;
	const dots = Object.assign(document.createElement('div'), {className: 'pin-dots'});
	dots.setAttribute('aria-hidden', 'true');
	const keys = Object.assign(document.createElement('div'), {className: 'pin-keypad'});
	keys.append(...'123456789'.split('').map((digit) => key(digit)));
	keys.append(fixed ? document.createElement('span') : key('enter', text('pin.enter'), 'check-lg'), key('0'), key('delete', text('pin.delete'), 'backspace flip-rtl'));
	pin.append(dots, keys);
	let busy = false;
	const draw = () => {
		const typed = field.value.length;
		dots.replaceChildren(...Array.from({length: fixed ? length : Math.max(least, typed)}, (_, at) => {
			const dot = document.createElement('span');
			dot.toggleAttribute('data-filled', at < typed);
			return dot;
		}));
	};
	const send = () => {
		if (busy || field.value.length < least) {
			return;
		}
		const [taken, answer] = ask(pin, 'redz:pin', {value: field.value});
		if (!taken) {
			field.form?.requestSubmit();
			return;
		}
		if (answer === null) {
			return;
		}
		busy = true;
		field.readOnly = true;
		pin.setAttribute('aria-busy', 'true');
		answer.then((yes) => yes === true).catch(() => false).then((yes) => {
			busy = false;
			field.readOnly = false;
			pin.removeAttribute('aria-busy');
			if (!yes) {
				field.value = '';
				draw();
				field.setAttribute('aria-invalid', 'true');
				field.focus();
			}
		});
	};
	field.addEventListener('input', () => {
		const digits = field.value.replace(/\D/g, '').slice(0, length);
		if (digits !== field.value) {
			field.value = digits;
		}
		field.removeAttribute('aria-invalid');
		draw();
		if (fixed && digits.length === length) {
			send();
		}
	});
	field.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault();
			send();
		}
	});
	keys.addEventListener('mousedown', (event) => event.preventDefault());
	keys.addEventListener('click', (event) => {
		const button = event.target instanceof Element ? event.target.closest('button') : null;
		if (button === null || busy) {
			return;
		}
		if (button.dataset.key === 'enter') {
			send();
			return;
		}
		field.value = button.dataset.key === 'delete' ? field.value.slice(0, -1) : field.value + button.dataset.key;
		field.dispatchEvent(new Event('input', {bubbles: true}));
	});
	draw();
};

document.querySelectorAll('.pin').forEach(setUp);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches('.pin') ? [node] : []).concat([...node.querySelectorAll('.pin')]).forEach(setUp);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});
