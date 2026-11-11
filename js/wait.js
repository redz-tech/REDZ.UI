// REDZ.UI, a question that waits: wait() holds a dialog open while the page carries out its answer - the pressed
// button busy, the dialog's other buttons unavailable, its body inert, Escape and a click outside held. Resolved, the
// dialog closes with the button's value; refused with words, a danger alert with them stands right above the footer,
// said at once, and the buttons wake with the focus still on the pressed one. A dialog closed meanwhile by code aborts
// the signal, and a refusal that comes after it is a danger toast. A form with method="dialog" in a dialog fires the
// cancelable redz:save {form, data, submitter, signal} on its submit (js/answer.js): answered with a promise, the
// dialog waits the same way; a tracked form's submit is js/track.js's, which waits by wait() too.
import {ask} from './answer.js';
import {busy} from './busy.js';
import {announce} from './say.js';
import {toast} from './toast.js';

/** Shows the page's words of a refusal right above the dialog's footer and says them at once. */
const refuse = (dialog, words) => {
	const box = Object.assign(document.createElement('div'), {className: 'alert alert-danger'});
	box.dataset.refusal = '';
	const icon = Object.assign(document.createElement('i'), {className: 'bi bi-x-octagon'});
	icon.setAttribute('aria-hidden', 'true');
	box.append(icon, Object.assign(document.createElement('div'), {textContent: words}));
	const body = [...dialog.querySelectorAll('.dialog-body')].at(-1);
	if (body !== undefined) {
		body.append(box);
	} else {
		(dialog.querySelector('.dialog-footer') ?? dialog.lastElementChild)?.before(box);
	}
	box.scrollIntoView({block: 'nearest'});
	announce(words, true);
};

/** Holds the dialog open while the promise runs for the pressed button; answers whether it closed by it. */
export const wait = (dialog, button, promise, controller) => {
	dialog.querySelectorAll('[data-refusal]').forEach((old) => old.remove());
	const others = [...dialog.querySelectorAll('button')].filter((one) => one !== button && one.closest('.dialog-body') === null && one.getAttribute('aria-disabled') !== 'true');
	const bodies = [...dialog.querySelectorAll('.dialog-body')].filter((body) => !body.inert);
	others.forEach((one) => one.setAttribute('aria-disabled', 'true'));
	bodies.forEach((body) => {
		body.inert = true;
	});
	const hold = (event) => event.preventDefault();
	const forced = () => controller.abort();
	dialog.addEventListener('cancel', hold);
	dialog.addEventListener('close', forced);
	const wake = () => {
		dialog.removeEventListener('cancel', hold);
		dialog.removeEventListener('close', forced);
		others.forEach((one) => one.removeAttribute('aria-disabled'));
		bodies.forEach((body) => {
			body.inert = false;
		});
	};
	return busy(button, Promise.resolve(promise)).then(() => {
		wake();
		if (dialog.open) {
			dialog.close(button.value);
		}
		return true;
	}, (reason) => {
		wake();
		const words = reason instanceof Error ? reason.message : String(reason ?? '');
		if (words === '' || reason?.name === 'AbortError') {
			return false;
		}
		if (dialog.open) {
			refuse(dialog, words);
		} else {
			toast({tone: 'danger', text: words});
		}
		return false;
	});
};

document.addEventListener('submit', (event) => {
	const form = event.target;
	const dialog = form instanceof HTMLFormElement && form.method === 'dialog' ? form.closest('dialog') : null;
	if (dialog === null || !dialog.open || form.matches('form[data-track]')) {
		return;
	}
	const submitter = event.submitter ?? form.querySelector('button[type="submit"], button:not([type])');
	const controller = new AbortController();
	const [taken, answer] = ask(form, 'redz:save', {form, data: new FormData(form, event.submitter ?? null), submitter, signal: controller.signal});
	if (taken || answer !== null) {
		event.preventDefault();
	}
	if (answer !== null && submitter !== null) {
		wait(dialog, submitter, answer, controller);
	}
});
