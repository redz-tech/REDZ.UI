// REDZ.UI, commands: where the browser has no invoker commands (Chrome before 135, Firefox before 144, Safari before
// 26.2), stands in for commandfor and command. A popover command becomes the browser's own popovertarget inside the
// click, so the browser still returns focus and anchors the popover; a dialog command calls the dialog; every command
// first dispatches the command event, which a listener may cancel, as on the platform. In every browser the button that
// opened a popover by commandfor says it is open in aria-expanded, and every other button opening the same popover - the
// handles of a list sharing one menu of moves - says it is not: Firefox gives such a button no expanded state of its
// own. The opener is the toggle event's source where the engine names it, else the button just pressed, else the one
// with the focus, else the only one there is. The state is written before the popover opens or closes, as a closing
// popover hands the focus back to its button at once, and when the button takes the focus.
const OPENERS = ['toggle-popover', 'show-popover'];
// The button each open popover was opened by.
const openers = new WeakMap();
let pressed = null;

/** The button that opened the popover - the outermost one's for a menu inside a menu - else the one naming it, or null. */
export const openerOf = (popover) => {
	const outer = popover.parentElement?.closest('[popover]');
	if (outer) {
		return openerOf(outer);
	}
	const named = popover.id === '' ? [] : [...document.querySelectorAll('button[commandfor="' + CSS.escape(popover.id) + '"]')];
	return openers.get(popover) ?? (named.length === 1 ? named[0] : null);
};

/** Whether the button opens the popover: a toggle or show command from outside it. */
const opens = (button, popover) => OPENERS.includes((button.getAttribute('command') || '').toLowerCase()) && !popover.contains(button);

document.addEventListener('click', (event) => {
	pressed = event.target instanceof Element ? event.target.closest('button[commandfor]') : null;
}, true);

document.addEventListener('beforetoggle', (event) => {
	const popover = event.target;
	if (!(popover instanceof HTMLElement) || popover.popover === null || popover.id === '') {
		return;
	}
	const buttons = [...document.querySelectorAll('button[commandfor="' + CSS.escape(popover.id) + '"]')].filter((button) => opens(button, popover));
	const opener = event.newState !== 'open' ? null : [event.source, pressed, document.activeElement].find((button) => buttons.includes(button)) ?? (buttons.length === 1 ? buttons[0] : null);
	pressed = null;
	openers.set(popover, opener);
	for (const button of buttons) {
		button.setAttribute('aria-expanded', String(button === opener));
	}
}, true);

document.addEventListener('focusin', (event) => {
	const button = event.target instanceof HTMLButtonElement && event.target.hasAttribute('commandfor') && !event.target.hasAttribute('aria-expanded') ? event.target : null;
	const popover = button === null ? null : document.getElementById(button.getAttribute('commandfor'));
	if (popover !== null && popover.popover !== null && opens(button, popover)) {
		button.setAttribute('aria-expanded', String(popover.matches(':popover-open') && openers.get(popover) === button));
	}
});

if (!('command' in HTMLButtonElement.prototype)) {
	const builtIn = ['show-modal', 'close', 'request-close', 'toggle-popover', 'show-popover', 'hide-popover'];

	/** The command of the button as the platform reads it: a built-in one in lower case, a custom one as written, else ''. */
	const commandOf = (button) => {
		const written = button.getAttribute('command') || '';
		return written.startsWith('--') ? written : (builtIn.includes(written.toLowerCase()) ? written.toLowerCase() : '');
	};

	/** Hands a popover command of the button to the browser's own popovertarget. */
	const upgrade = (button, target, command) => {
		if (command.endsWith('-popover') && target.popover !== null) {
			button.popoverTargetElement = target;
			button.popoverTargetAction = command.slice(0, -'-popover'.length);
		}
	};

	for (const button of document.querySelectorAll('button[commandfor]')) {
		const target = document.getElementById(button.getAttribute('commandfor'));
		if (target !== null) {
			upgrade(button, target, commandOf(button));
		}
	}

	document.addEventListener('click', (event) => {
		const button = event.target instanceof Element ? event.target.closest('button[commandfor]') : null;
		const target = button === null || button.disabled ? null : document.getElementById(button.getAttribute('commandfor'));
		const command = target === null ? '' : commandOf(button);
		if (command === '') {
			return;
		}
		const signal = new Event('command', {cancelable: true});
		Object.defineProperties(signal, {command: {value: command}, source: {value: button}});
		if (!target.dispatchEvent(signal)) {
			event.preventDefault();
			return;
		}
		upgrade(button, target, command);
		if (target.localName !== 'dialog') {
			return;
		}
		const value = button.hasAttribute('value') ? button.value : undefined;
		if (command === 'show-modal' && !target.open) {
			target.showModal();
		} else if (command === 'close' && target.open) {
			target.close(value);
		} else if (command === 'request-close' && target.open) {
			if (typeof target.requestClose === 'function') {
				target.requestClose(value);
			} else if (target.dispatchEvent(new Event('cancel', {cancelable: true}))) {
				target.close(value);
			}
		}
	}, true);
}
