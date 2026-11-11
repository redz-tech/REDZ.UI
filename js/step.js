// REDZ.UI, number steps: a button with command="--step-up" or "--step-down" and aria-controls naming a number field steps
// it by its step within its min and max - the field's own stepUp and stepDown - and fires input and change, as typing
// would; a button whose way is at the end, or whose field is disabled - by the page, its fieldset or a hidden region, at
// any time - says so in aria-disabled. Like --toggle, the button has no commandfor; the arrow keys in the field step it
// already.
const COMMANDS = ['--step-up', '--step-down'];
const BUTTONS = COMMANDS.map((command) => 'button[command="' + command + '"][aria-controls]').join(', ');

/** The field the button names in aria-controls, when it is a number field. */
const fieldOf = (button) => {
	const field = document.getElementById((button.getAttribute('aria-controls') || '').trim());
	return field instanceof HTMLInputElement && field.type === 'number' ? field : null;
};

/** Marks each step button of the field aria-disabled at its end: up at max, down at min. */
const mark = (field) => {
	const value = field.valueAsNumber;
	for (const button of document.querySelectorAll(BUTTONS)) {
		if (fieldOf(button) !== field) {
			continue;
		}
		const up = button.getAttribute('command') === '--step-up';
		const end = up ? field.max : field.min;
		const at = end !== '' && !Number.isNaN(value) && (up ? value >= Number(end) : value <= Number(end));
		if (at || field.matches(':disabled')) {
			button.setAttribute('aria-disabled', 'true');
		} else {
			button.removeAttribute('aria-disabled');
		}
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest(BUTTONS) : null;
	const field = button === null || event.defaultPrevented || button.disabled || button.hasAttribute('commandfor') || button.getAttribute('aria-disabled') === 'true' ? null : fieldOf(button);
	if (field === null || field.matches(':disabled') || field.readOnly) {
		return;
	}
	try {
		if (button.getAttribute('command') === '--step-up') {
			field.stepUp();
		} else {
			field.stepDown();
		}
	} catch {
		return;
	}
	for (const type of ['input', 'change']) {
		field.dispatchEvent(new Event(type, {bubbles: true}));
	}
});

const fields = () => new Set([...document.querySelectorAll(BUTTONS)].map(fieldOf).filter(Boolean));

fields().forEach(mark);

document.addEventListener('input', (event) => {
	if (event.target instanceof HTMLInputElement && event.target.type === 'number') {
		mark(event.target);
	}
});

document.addEventListener('reset', () => setTimeout(() => fields().forEach(mark)));
new MutationObserver(() => fields().forEach(mark)).observe(document.documentElement, {subtree: true, attributeFilter: ['disabled']});
