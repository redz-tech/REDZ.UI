// REDZ.UI, regions a button opens and closes: a button with command="--toggle" and aria-controls naming the element
// shows it or hides it again as hidden="until-found", so the browser's find in page still reaches the words inside and
// opens it - a table's row, which that kind of hiding cannot hide, as plain hidden; every button for that element says
// whether it is open in aria-expanded - after a find in page too. The
// button has no commandfor, which WebKit would expose as collapsed whatever its aria-expanded says: its click sends
// the element the command event, with command and source, as the platform sends it to a commandfor's target.
const COMMAND = '--toggle';

/** The element the --toggle button names in aria-controls, or null. */
const regionOf = (button) => document.getElementById((button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0]);

/** Marks every --toggle button of the element open or closed, one written with commandfor before 0.7.0 too. */
export const mark = (target, open) => {
	const id = CSS.escape(target.id);
	for (const button of document.querySelectorAll('button[command="' + COMMAND + '"]:is([aria-controls~="' + id + '"], [commandfor="' + id + '"])')) {
		button.setAttribute('aria-expanded', String(open));
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="' + COMMAND + '"][aria-controls]') : null;
	const target = button === null || event.defaultPrevented || button.disabled || button.hasAttribute('commandfor') ? null : regionOf(button);
	if (target !== null) {
		const signal = new Event('command', {cancelable: true});
		Object.defineProperties(signal, {command: {value: COMMAND}, source: {value: button}});
		target.dispatchEvent(signal);
	}
});

document.addEventListener('command', (event) => {
	const target = event.target;
	if (event.command !== COMMAND || !(target instanceof HTMLElement)) {
		return;
	}
	if (target.hidden) {
		target.hidden = false;
	} else if (getComputedStyle(target).display.startsWith('table-')) {
		target.hidden = true;
	} else {
		target.setAttribute('hidden', 'until-found');
	}
	mark(target, !target.hidden);
}, true);

document.addEventListener('beforematch', (event) => {
	if (event.target instanceof HTMLElement && event.target.id !== '') {
		mark(event.target, true);
	}
}, true);
