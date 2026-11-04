// REDZ.UI, prompt: REDZ.ui.prompt() asks for one value in a modal dialog and answers it, or null - Escape and the cancel
// button answer null. The field takes the focus with its text selected; Enter answers once the field is valid - its
// required, pattern and type held by the browser's own checks; the buttons' words come from the caller or the page's
// texts. The dialog is removed when it closes, and the focus goes back where it was.
import {text} from './text.js';

let made = 0;

/** Asks: {title, text, label, value, placeholder, type, inputmode, pattern, required, ok, cancel, tone}; a promise of the value or null. */
export const prompt = ({title = '', text: detail = '', label = '', value = '', placeholder = '', type = 'text', inputmode = '', pattern = '', required = false, ok = '', cancel = '', tone = 'primary'} = {}) => new Promise((answer) => {
	const id = 'redz-prompt-' + ++made;
	const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog dialog-sm'});
	dialog.setAttribute('aria-labelledby', id + '-title');
	const form = Object.assign(document.createElement('form'), {method: 'dialog'});
	const header = Object.assign(document.createElement('div'), {className: 'dialog-header'});
	header.append(Object.assign(document.createElement('h2'), {className: 'dialog-title', id: id + '-title', textContent: title}));
	const body = Object.assign(document.createElement('div'), {className: 'dialog-body vstack gap-12'});
	if (detail !== '') {
		body.append(Object.assign(document.createElement('p'), {id: id + '-text', textContent: detail}));
		dialog.setAttribute('aria-describedby', id + '-text');
	}
	const field = Object.assign(document.createElement('div'), {className: 'vstack gap-4'});
	const input = Object.assign(document.createElement('input'), {className: 'form-control', id: id + '-field', type, value, placeholder, required, autocomplete: 'off', autofocus: true});
	if (pattern !== '') {
		input.pattern = pattern;
	}
	if (inputmode !== '') {
		input.inputMode = inputmode;
	}
	field.append(Object.assign(document.createElement('label'), {className: 'form-label', htmlFor: input.id, textContent: label || title}), input);
	body.append(field);
	const footer = Object.assign(document.createElement('div'), {className: 'dialog-footer'});
	const no = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: cancel || text('confirm.cancel')});
	no.addEventListener('click', () => dialog.close());
	footer.append(no, Object.assign(document.createElement('button'), {className: 'btn btn-' + tone, type: 'submit', value: 'ok', textContent: ok || text('confirm.ok')}));
	form.append(header, body, footer);
	dialog.append(form);
	dialog.addEventListener('close', () => {
		answer(dialog.returnValue === 'ok' ? input.value : null);
		dialog.remove();
	});
	document.body.append(dialog);
	// Selected before the dialog gives it the focus, so a screen reader hears the field, not a change of selection;
	// WebKit drops that selection on focus, so it comes once the field has been said.
	input.setSelectionRange(0, input.value.length);
	dialog.showModal();
	if (input.selectionEnd !== input.value.length) {
		setTimeout(() => document.activeElement === input && input.selectionStart === input.selectionEnd && input.select(), 300);
	}
});
