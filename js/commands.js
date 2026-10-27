// REDZ.UI, commands: where the browser has no invoker commands (Chrome before 135, Firefox before 144, Safari before
// 26.2), stands in for commandfor and command. A popover command becomes the browser's own popovertarget inside the
// click, so the browser still exposes the expanded state, returns focus and anchors the popover; a dialog command calls
// the dialog; every command first dispatches the command event, which a listener may cancel, as on the platform.
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
