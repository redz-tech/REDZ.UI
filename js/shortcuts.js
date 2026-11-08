// REDZ.UI, shortcuts: a button or link whose aria-keyshortcuts names a combination with Control, Meta or Alt is pressed
// by it - the page states the keys once, for people and for the machine. Where both Meta+K and Control+K are named,
// Apple's systems answer Meta and the others Control. A combination any of them names is the page's and never reaches
// the browser, even while none can be pressed: a disabled, hidden or inert one, or one outside an open modal dialog, is
// left alone; a held combination presses once; a single key is never a shortcut here (WCAG 2.1.4).
const APPLE = /Mac|iPhone|iPad/.test(navigator.platform);
const MODIFIERS = ['Control', 'Meta', 'Alt', 'Shift'];

/** Whether the keydown is the combination, written as aria-keyshortcuts writes it: Control+Shift+K. */
const matches = (event, combination) => {
	const parts = combination.split('+');
	const key = parts.pop();
	if (parts.some((part) => !MODIFIERS.includes(part)) || event.ctrlKey !== parts.includes('Control') || event.metaKey !== parts.includes('Meta') || event.altKey !== parts.includes('Alt') || event.shiftKey !== parts.includes('Shift')) {
		return false;
	}
	return key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() || event.code === (/\d/.test(key) ? 'Digit' : 'Key') + key.toUpperCase() : event.key === key;
};

/** The combinations of the element this system answers. */
const combinationsOf = (element) => {
	const all = (element.getAttribute('aria-keyshortcuts') || '').split(/\s+/).filter((combination) => /(^|\+)(Control|Meta|Alt)\+/.test(combination));
	const other = APPLE ? 'Control' : 'Meta';
	const own = APPLE ? 'Meta' : 'Control';
	return all.filter((combination) => !combination.split('+').includes(other) || !all.includes(combination.split('+').map((part) => part === other ? own : part).join('+')));
};

/** Whether a person could press the element now, in the open modal dialog if there is one. */
const pressable = (element, modal) => (element.localName === 'button' ? !element.disabled : element.hasAttribute('href')) && element.getAttribute('aria-disabled') !== 'true' && element.checkVisibility() && element.closest('[inert]') === null && (modal === null || modal.contains(element));

document.addEventListener('keydown', (event) => {
	if (!(event.ctrlKey || event.metaKey || event.altKey)) {
		return;
	}
	const named = [...document.querySelectorAll('button[aria-keyshortcuts], a[aria-keyshortcuts]')].filter((element) => combinationsOf(element).some((combination) => matches(event, combination)));
	if (named.length === 0) {
		return;
	}
	event.preventDefault();
	const modal = document.querySelector('dialog:modal');
	const pressed = event.repeat ? undefined : named.find((element) => pressable(element, modal));
	pressed?.click();
});
