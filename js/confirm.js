// REDZ.UI, confirm: REDZ.ui.confirm() asks in a modal alert dialog and answers true or false - Escape and the cancel
// button answer false, and the focus starts on cancel, the safe choice; the words come from the caller or, for the
// buttons and the field, from the page's texts; the dialog is removed when it closes, and the focus goes back where it
// was. With a phrase the person types it first: the confirming button waits for it, the focus starts in its field, and
// Enter there confirms once it matches. A note in a tone and sections - a title over a list, such as what goes and
// what stays - come between the text and the phrase; every word is text, never HTML.
import {text} from './text.js';

const ICONS = {info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon'};

let made = 0;

/** Asks: {title, text, note: {tone, text}, sections: [{title, items}], ok, cancel, tone, phrase} - tone danger paints the confirming button red; a promise of true. */
export const confirm = ({title = '', text: detail = '', note = null, sections = [], ok = '', cancel = '', tone = 'primary', phrase = ''} = {}) => new Promise((answer) => {
	const id = 'redz-confirm-' + ++made;
	const dialog = document.createElement('dialog');
	dialog.className = 'dialog dialog-sm';
	dialog.setAttribute('role', 'alertdialog');
	dialog.setAttribute('aria-labelledby', id + '-title');
	const header = Object.assign(document.createElement('div'), {className: 'dialog-header'});
	header.append(Object.assign(document.createElement('h2'), {className: 'dialog-title', id: id + '-title', textContent: title}));
	const body = Object.assign(document.createElement('div'), {className: 'dialog-body vstack gap-12'});
	const described = [];
	if (detail !== '') {
		body.append(Object.assign(document.createElement('p'), {id: id + '-text', textContent: detail}));
		described.push(id + '-text');
	}
	if (note !== null && (note.text ?? '') !== '') {
		const shade = note.tone in ICONS ? note.tone : 'warning';
		const box = Object.assign(document.createElement('div'), {className: 'alert alert-' + shade, id: id + '-note'});
		const icon = Object.assign(document.createElement('i'), {className: 'bi bi-' + ICONS[shade]});
		icon.setAttribute('aria-hidden', 'true');
		box.append(icon, Object.assign(document.createElement('div'), {textContent: note.text}));
		body.append(box);
		described.push(id + '-note');
	}
	for (const section of sections) {
		const part = Object.assign(document.createElement('div'), {className: 'vstack gap-4'});
		part.append(Object.assign(document.createElement('h3'), {textContent: section.title ?? ''}));
		const list = document.createElement('ul');
		list.append(...(section.items ?? []).map((item) => Object.assign(document.createElement('li'), {textContent: item})));
		part.append(list);
		body.append(part);
	}
	if (described.length > 0) {
		dialog.setAttribute('aria-describedby', described.join(' '));
	}
	const footer = Object.assign(document.createElement('div'), {className: 'dialog-footer'});
	const no = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', value: 'cancel', textContent: cancel || text('confirm.cancel')});
	const yes = Object.assign(document.createElement('button'), {className: 'btn btn-' + tone, type: 'button', value: 'ok', textContent: ok || text('confirm.ok')});
	for (const button of [no, yes]) {
		button.addEventListener('click', () => dialog.close(button.value));
	}
	no.autofocus = true;
	if (phrase !== '') {
		const field = Object.assign(document.createElement('div'), {className: 'vstack gap-4'});
		const label = Object.assign(document.createElement('label'), {className: 'form-label', htmlFor: id + '-phrase', textContent: text('confirm.phrase', {phrase})});
		const input = Object.assign(document.createElement('input'), {className: 'form-control', id: id + '-phrase', type: 'text', autocomplete: 'off', spellcheck: false, autofocus: true});
		input.setAttribute('autocapitalize', 'off');
		const matches = () => input.value.trim() === phrase;
		yes.disabled = true;
		no.autofocus = false;
		input.addEventListener('input', () => {
			yes.disabled = !matches();
		});
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.isComposing && matches()) {
				event.preventDefault();
				dialog.close('ok');
			}
		});
		field.append(label, input);
		body.append(field);
	}
	footer.append(no, yes);
	dialog.append(header, body, footer);
	dialog.addEventListener('close', () => {
		answer(dialog.returnValue === 'ok');
		dialog.remove();
	});
	document.body.append(dialog);
	dialog.showModal();
});
