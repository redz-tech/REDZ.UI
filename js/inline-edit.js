// REDZ.UI, inline edit: a button with commandfor naming a form of class inline-edit-form and command="--edit" opens the
// form - in place of the value the form names in data-for, or, a popover form, beside its button - its field focused
// and its text selected; Escape, or a button with command="--cancel" for the form, puts the field back and closes the
// form, the focus on the Edit button again; a click outside leaves it open. Its submit fires the cancelable redz:save
// (js/answer.js) with the form and the field's value: answered with a promise, the Save button is busy until it
// settles - resolved, the value shows the saved text and the form closes; rejected with words, the form stays open, the
// field invalid and the words in its invalid-feedback. Left alone, the value shows the text at once, the field keeps it.
import {ask} from './answer.js';
import {busy} from './busy.js';

const fieldOf = (form) => form.querySelector('input:not([type="hidden"]), textarea, select');
const shownOf = (form) => document.getElementById(form.dataset.for || '');
const editorsOf = (form) => [...document.querySelectorAll('button[commandfor="' + CSS.escape(form.id) + '"]')].filter((button) => button.getAttribute('command') === '--edit');

/** What the field holds as the value shows it: a choice's words, else the text. */
const wordsOf = (field) => field instanceof HTMLSelectElement ? field.selectedOptions[0]?.textContent.trim() ?? '' : field.value;

/** Takes the field's error away. */
const clear = (form) => {
	fieldOf(form)?.removeAttribute('aria-invalid');
	const feedback = form.querySelector('.invalid-feedback');
	if (feedback !== null) {
		feedback.textContent = '';
		feedback.hidden = true;
	}
};

/** Opens the form, its field focused and its text selected. */
const open = (form, editor) => {
	clear(form);
	if (form.popover === null) {
		form.hidden = false;
		shownOf(form)?.setAttribute('hidden', '');
		editorsOf(form).forEach((button) => button.setAttribute('hidden', ''));
	} else if (!form.matches(':popover-open')) {
		form.showPopover({source: editor});
	}
	const field = fieldOf(form);
	field?.focus();
	if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
		field.select();
	}
};

/** Closes the form, the value and its Edit button back, the focus on the button. */
const close = (form) => {
	if (form.popover === null) {
		form.hidden = true;
		shownOf(form)?.removeAttribute('hidden');
		editorsOf(form).forEach((button) => button.removeAttribute('hidden'));
	} else if (form.matches(':popover-open')) {
		form.hidePopover();
	}
	editorsOf(form)[0]?.focus();
};

/** Puts the field back as it was saved and closes the form. */
const cancel = (form) => {
	form.reset();
	clear(form);
	close(form);
};

/** The value shows the field's words, and they become the field's own, which a cancel puts back. */
const done = (form) => {
	const field = fieldOf(form);
	if (field instanceof HTMLSelectElement) {
		[...field.options].forEach((option) => {
			option.defaultSelected = option.selected;
		});
	} else {
		field.defaultValue = field.value;
	}
	const shown = shownOf(form);
	if (shown !== null) {
		shown.textContent = wordsOf(field);
	}
	clear(form);
	close(form);
};

/** Keeps the form open with the page's words as the field's error. */
const fail = (form, words) => {
	const field = fieldOf(form);
	const feedback = form.querySelector('.invalid-feedback');
	field.setAttribute('aria-invalid', 'true');
	if (feedback === null) {
		console.error('REDZ.UI: the inline edit form #' + form.id + ' has no .invalid-feedback for the page\'s words');
		return;
	}
	feedback.id ||= form.id + '-error';
	const described = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
	if (!described.includes(feedback.id)) {
		field.setAttribute('aria-describedby', [...described, feedback.id].join(' '));
	}
	feedback.setAttribute('role', 'alert');
	feedback.textContent = String(words ?? '');
	feedback.hidden = false;
	field.focus();
};

/** Asks the page to save the field's value, and finishes as it answers. */
const save = (form) => {
	const field = fieldOf(form);
	const [taken, answer] = ask(form, 'redz:save', {form, value: field.value});
	if (!taken) {
		done(form);
		return;
	}
	if (answer === null) {
		return;
	}
	const button = form.querySelector('button[type="submit"], button:not([type])');
	(button === null ? answer : busy(button, answer)).then((saved) => {
		if (typeof saved === 'string') {
			field.value = saved;
		}
		done(form);
	}, (words) => fail(form, words));
};

document.addEventListener('command', (event) => {
	const form = event.target;
	if (!(form instanceof HTMLFormElement) || !form.classList.contains('inline-edit-form')) {
		return;
	}
	if (event.command === '--edit') {
		open(form, event.source);
	} else if (event.command === '--cancel') {
		cancel(form);
	}
}, true);

document.addEventListener('keydown', (event) => {
	const form = event.target instanceof Element ? event.target.closest('.inline-edit-form') : null;
	if (form !== null && event.key === 'Escape' && !event.isComposing) {
		event.preventDefault();
		event.stopPropagation();
		cancel(form);
	}
}, true);

document.addEventListener('submit', (event) => {
	const form = event.target;
	if (form instanceof HTMLFormElement && form.classList.contains('inline-edit-form')) {
		event.preventDefault();
		save(form);
	}
});
