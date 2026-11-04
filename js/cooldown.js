// REDZ.UI, cooldowns: a button with data-cooldown="N" waits N seconds - aria-disabled, which keeps its focus and
// swallows its clicks, and the seconds left after its words, in the page's text "cooldown" - and then wakes, the
// attribute gone. Setting the attribute again starts it again; a page reloaded mid-wait renders the seconds left. The
// count is drawn, not said: a name that changes every second would be read every second, so the page says the wait in
// words once when it starts it. While it counts the cooldown holds aria-disabled: a busy() that ends meanwhile leaves
// the button disabled, and the end of the count puts back the state from before both (js/hold.js).
import {text} from './text.js';
import {take, leave} from './hold.js';

const waits = new WeakMap();

/** Ends the button's wait: the count gone, the attribute gone, aria-disabled let go. */
const stop = (button) => {
	clearInterval(waits.get(button)?.timer);
	waits.delete(button);
	button.querySelector(':scope > .btn-cooldown')?.remove();
	leave(button, 'cooldown');
	delete button.dataset.cooldown;
};

/** Counts the button's wait down from its data-cooldown; a new value starts it again, none or zero ends it. */
const start = (button) => {
	const seconds = Number.parseInt(button.dataset.cooldown ?? '', 10);
	const running = waits.get(button);
	if (running !== undefined) {
		clearInterval(running.timer);
	}
	if (!(seconds > 0)) {
		if (running !== undefined) {
			stop(button);
		}
		return;
	}
	if (running === undefined) {
		take(button, 'cooldown');
	}
	const end = Date.now() + seconds * 1000;
	let left = button.querySelector(':scope > .btn-cooldown');
	if (left === null) {
		left = Object.assign(document.createElement('span'), {className: 'btn-cooldown'});
		left.setAttribute('aria-hidden', 'true');
		button.append(left);
	}
	const tick = () => {
		const now = Math.ceil((end - Date.now()) / 1000);
		if (now > 0) {
			left.textContent = text('cooldown', {seconds: now});
			return;
		}
		stop(button);
	};
	waits.set(button, {timer: setInterval(tick, 250)});
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
