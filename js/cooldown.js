// REDZ.UI, cooldowns: a button with data-cooldown="N" waits N seconds - aria-disabled, which keeps its focus and
// swallows its clicks, and the seconds left after its words, in the page's text "cooldown" - and then wakes, the
// attribute gone. Setting the attribute again starts it again; a page reloaded mid-wait renders the seconds left. The
// count is drawn, not said: a name that changes every second would be read every second, so the page says the wait in
// words once when it starts it.
import {text} from './text.js';

const waits = new WeakMap();

/** Counts the button's wait down from its data-cooldown; a new value starts it again. */
const start = (button) => {
	const seconds = Number.parseInt(button.dataset.cooldown ?? '', 10);
	const running = waits.get(button);
	if (running !== undefined) {
		clearInterval(running.timer);
	}
	if (!(seconds > 0)) {
		return;
	}
	const disabled = running === undefined ? button.getAttribute('aria-disabled') : running.disabled;
	const end = Date.now() + seconds * 1000;
	let left = button.querySelector(':scope > .btn-cooldown');
	if (left === null) {
		left = Object.assign(document.createElement('span'), {className: 'btn-cooldown'});
		left.setAttribute('aria-hidden', 'true');
		button.append(left);
	}
	button.setAttribute('aria-disabled', 'true');
	const tick = () => {
		const now = Math.ceil((end - Date.now()) / 1000);
		if (now > 0) {
			left.textContent = text('cooldown', {seconds: now});
			return;
		}
		clearInterval(waits.get(button)?.timer);
		waits.delete(button);
		left.remove();
		if (disabled === null) {
			button.removeAttribute('aria-disabled');
		}
		delete button.dataset.cooldown;
	};
	waits.set(button, {timer: setInterval(tick, 250), disabled});
	tick();
};

document.querySelectorAll('[data-cooldown]').forEach(start);

new MutationObserver((records) => {
	for (const record of records) {
		if (record.type === 'attributes' && record.target instanceof HTMLElement && record.target.hasAttribute('data-cooldown')) {
			start(record.target);
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches('[data-cooldown]') ? [node] : []).concat([...node.querySelectorAll('[data-cooldown]')]).forEach(start);
			}
		}
	}
}).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-cooldown']});
