// REDZ.UI, confirm: REDZ.ui.confirm() asks in a modal alert dialog and answers true or false - Escape and the cancel
// button answer false, and the focus starts on cancel, the safe choice; the words come from the caller or, for the
// buttons and the field, from the page's texts; the dialog is removed when it closes, and the focus goes back where it
// was. With a phrase the person types it first: the confirming button waits for it, the focus starts in its field, and
// Enter there confirms once it matches. A note in a tone, rows of a summary - a label and its value, such as what a
// payment is - and sections - a title over a list, such as what goes and what stays - come between the text and the
// phrase; every word is text, never HTML. A choice puts radios above the phrase, and the answer is then the chosen
// value. A third answer, alt, stands at the footer's start - Discard beside Stay and Save - and answers its value; the
// focus starts on cancel unless focus names 'ok' or 'alt', never for an answer that destroys. With run, OK carries the
// answer out before the dialog closes: run({choice, phrase, signal}) answers a promise, and the dialog waits for it
// (js/wait.js) - refused with words, it shows them and stays open.
import {text} from './text.js';
import {wait} from './wait.js';

const ICONS = {info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon'};

let made = 0;

/** Asks: {title, text, note: {tone, text}, rows: [{label, value}], sections: [{title, items}], choice: {label, items: [{value, text, hint}], value}, ok, cancel, tone, phrase, alt: {text, tone, value}, focus, run} - tone danger paints the confirming button red; a promise of true or the chosen value, alt's value, or false. */
export const confirm = ({title = '', text: detail = '', note = null, rows = [], sections = [], choice = null, ok = '', cancel = '', tone = 'primary', phrase = '', alt = null, focus = 'cancel', run = null} = {}) => new Promise((answer) => {
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
	if (rows.length > 0) {
		const summary = Object.assign(document.createElement('dl'), {className: 'summary'});
		for (const row of rows) {
			summary.append(Object.assign(document.createElement('dt'), {textContent: row.label ?? ''}), Object.assign(document.createElement('dd'), {textContent: row.value ?? ''}));
		}
		body.append(summary);
	}
	for (const section of sections) {
		const part = Object.assign(document.createElement('div'), {className: 'vstack gap-4'});
		part.append(Object.assign(document.createElement('h3'), {textContent: section.title ?? ''}));
		const list = document.createElement('ul');
		list.append(...(section.items ?? []).map((item) => Object.assign(document.createElement('li'), {textContent: item})));
		part.append(list);
		body.append(part);
	}
	let picked = () => '';
	if (choice !== null) {
		const set = Object.assign(document.createElement('fieldset'), {className: 'vstack gap-8'});
		set.append(Object.assign(document.createElement('legend'), {className: 'form-label', textContent: choice.label ?? ''}));
		(choice.items ?? []).forEach((item, n) => {
			const radio = Object.assign(document.createElement('input'), {className: 'radio', type: 'radio', name: id + '-choice', value: String(item.value ?? ''), checked: item.value === choice.value});
			const words = Object.assign(document.createElement('span'), {className: 'vstack gap-2'});
			words.append(Object.assign(document.createElement('span'), {textContent: item.text ?? ''}));
			if ((item.hint ?? '') !== '') {
				words.append(Object.assign(document.createElement('span'), {className: 'form-text', id: id + '-hint-' + n, textContent: item.hint}));
				radio.setAttribute('aria-describedby', id + '-hint-' + n);
			}
			const label = Object.assign(document.createElement('label'), {className: 'form-check align-items-start'});
			label.append(radio, words);
			set.append(label);
		});
		body.append(set);
		picked = () => set.querySelector(':checked')?.value ?? '';
	}
	if (described.length > 0) {
		dialog.setAttribute('aria-describedby', described.join(' '));
	}
	const footer = Object.assign(document.createElement('div'), {className: 'dialog-footer'});
	const no = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', value: 'cancel', textContent: cancel || text('confirm.cancel')});
	const yes = Object.assign(document.createElement('button'), {className: 'btn btn-' + tone, type: 'button', value: 'ok', textContent: ok || text('confirm.ok')});
	const other = alt === null ? null : Object.assign(document.createElement('button'), {className: 'btn dialog-footer-start' + (alt.tone ? ' btn-outline-' + alt.tone : ''), type: 'button', value: 'alt', textContent: alt.text ?? ''});
	let field = null;
	const ready = () => (field === null || field.value.trim() === phrase) && (choice === null || picked() !== '');
	no.addEventListener('click', () => dialog.close('cancel'));
	other?.addEventListener('click', () => dialog.close('alt'));
	yes.addEventListener('click', () => {
		if (run === null) {
			dialog.close('ok');
			return;
		}
		const controller = new AbortController();
		const asked = {choice: picked(), phrase: field?.value.trim() ?? '', signal: controller.signal};
		wait(dialog, yes, Promise.resolve().then(() => run(asked)), controller);
	});
	({ok: yes, alt: other ?? no}[focus] ?? no).autofocus = true;
	body.addEventListener('change', () => {
		yes.disabled = !ready();
	});
	if (phrase !== '') {
		const box = Object.assign(document.createElement('div'), {className: 'vstack gap-4'});
		const label = Object.assign(document.createElement('label'), {className: 'form-label', htmlFor: id + '-phrase', textContent: text('confirm.phrase', {phrase})});
		const input = Object.assign(document.createElement('input'), {className: 'form-control', id: id + '-phrase', type: 'text', autocomplete: 'off', spellcheck: false, autofocus: true});
		input.setAttribute('autocapitalize', 'off');
		field = input;
		[no, yes, other].forEach((button) => {
			if (button !== null) {
				button.autofocus = false;
			}
		});
		input.addEventListener('input', () => {
			yes.disabled = !ready();
		});
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.isComposing && ready()) {
				event.preventDefault();
				yes.click();
			}
		});
		box.append(label, input);
		body.append(box);
	}
	yes.disabled = !ready();
	footer.append(...(other === null ? [] : [other]), no, yes);
	dialog.append(header, ...(body.childElementCount > 0 ? [body] : []), footer);
	dialog.addEventListener('close', () => {
		const value = dialog.returnValue;
		answer(value === 'ok' ? (choice === null ? true : picked()) : (value === 'alt' ? alt.value ?? 'alt' : false));
		dialog.remove();
	});
	document.body.append(dialog);
	dialog.showModal();
});
