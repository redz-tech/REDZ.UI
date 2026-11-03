// REDZ.UI, regions a button opens and closes: a button with commandfor and command="--toggle" shows the element it
// names or hides it again as hidden="until-found", so the browser's find in page still reaches the words inside and
// opens it; every button for that element says whether it is open in aria-expanded — after a find in page too.
const COMMAND = '--toggle';

/** Marks every --toggle button of the element open or closed. */
export const mark = (target, open) => {
	for (const button of document.querySelectorAll('button[commandfor="' + CSS.escape(target.id) + '"]')) {
		if (button.getAttribute('command') === COMMAND) {
			button.setAttribute('aria-expanded', String(open));
		}
	}
};

document.addEventListener('command', (event) => {
	const target = event.target;
	if (event.command !== COMMAND || !(target instanceof HTMLElement)) {
		return;
	}
	if (target.hidden) {
		target.hidden = false;
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
