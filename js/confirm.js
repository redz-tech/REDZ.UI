// REDZ.UI, confirm: REDZ.ui.confirm() asks in a modal alert dialog and answers true or false — Escape and the cancel
// button answer false, and the focus starts on cancel, the safe choice; the words come from the caller or, for the two
// buttons, from the page's texts; the dialog is removed when it closes, and the focus goes back where it was.
import {text} from './text.js';

let made = 0;

/** Asks: {title, text, ok, cancel, tone} — tone danger paints the confirming button red; answers a promise of true. */
export const confirm = ({title = '', text: detail = '', ok = '', cancel = '', tone = 'primary'} = {}) => new Promise((answer) => {
	const id = 'redz-confirm-' + ++made;
	const dialog = document.createElement('dialog');
	dialog.className = 'dialog dialog-sm';
	dialog.setAttribute('role', 'alertdialog');
	dialog.setAttribute('aria-labelledby', id + '-title');
	dialog.setAttribute('aria-describedby', id + '-text');
	const header = Object.assign(document.createElement('div'), {className: 'dialog-header'});
	header.append(Object.assign(document.createElement('h2'), {className: 'dialog-title', id: id + '-title', textContent: title}));
	const body = Object.assign(document.createElement('div'), {className: 'dialog-body'});
	body.append(Object.assign(document.createElement('p'), {id: id + '-text', textContent: detail}));
	const footer = Object.assign(document.createElement('div'), {className: 'dialog-footer'});
	const no = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', value: 'cancel', textContent: cancel || text('confirm.cancel')});
	const yes = Object.assign(document.createElement('button'), {className: 'btn btn-' + tone, type: 'button', value: 'ok', textContent: ok || text('confirm.ok')});
	for (const button of [no, yes]) {
		button.addEventListener('click', () => dialog.close(button.value));
	}
	no.autofocus = true;
	footer.append(no, yes);
	dialog.append(header, body, footer);
	dialog.addEventListener('close', () => {
		answer(dialog.returnValue === 'ok');
		dialog.remove();
	});
	document.body.append(dialog);
	dialog.showModal();
});
