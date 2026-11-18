// REDZ.UI, sheets: on a phone a combobox's panel, a date input's month and a dialog stand as a sheet from a strip of the
// dimmed page to the bottom, as the stylesheet says with --redz-sheet: 1. A press on its top strip, its title or a
// dialog's header - not on a control - drags it down: past a third of its height it closes, a dialog as Escape asks, so
// a page may keep it open, and never one with closedby="none"; short of that it goes back.
const HANDLE = '.combobox-title, .date-input-head, .dialog-header';
const CONTROL = 'a[href], button, input, select, textarea, label, [contenteditable]';
const STRIP = 24;

/** Whether the stylesheet stands the element as a sheet now. */
export const sheeted = (el) => getComputedStyle(el).getPropertyValue('--redz-sheet').trim() === '1';

/** The open sheet a press drags, or null. */
const sheetOf = (event) => {
	const target = event.target;
	if (!(target instanceof Element) || event.button !== 0 || !event.isPrimary) {
		return null;
	}
	const layer = target.closest(':popover-open, dialog[open]');
	if (layer === null || !sheeted(layer)) {
		return null;
	}
	const control = target.closest(CONTROL);
	if (control !== null && layer.contains(control)) {
		return null;
	}
	const handle = target.closest(HANDLE);
	const onStrip = target === layer && event.clientY - layer.getBoundingClientRect().top <= STRIP;
	return onStrip || (handle !== null && layer.contains(handle)) ? layer : null;
};

/** Closes the sheet as a close request does; answers whether it closed. */
const close = (layer) => {
	if (!(layer instanceof HTMLDialogElement)) {
		layer.hidePopover();
		return true;
	}
	if (layer.getAttribute('closedby') === 'none' || !layer.dispatchEvent(new Event('cancel', {cancelable: true}))) {
		return false;
	}
	layer.close();
	return true;
};

document.addEventListener('pointerdown', (event) => {
	const layer = sheetOf(event);
	if (layer === null) {
		return;
	}
	event.preventDefault();
	const start = event.clientY;
	const height = layer.offsetHeight;
	let moved = 0;
	layer.setPointerCapture(event.pointerId);
	const move = (step) => {
		if (step.pointerId === event.pointerId) {
			moved = Math.max(0, step.clientY - start);
			layer.style.setProperty('transition', 'none');
			layer.style.setProperty('translate', '0 ' + moved + 'px');
		}
	};
	const end = (step) => {
		if (step.pointerId !== event.pointerId) {
			return;
		}
		layer.removeEventListener('pointermove', move);
		layer.removeEventListener('pointerup', end);
		layer.removeEventListener('pointercancel', end);
		layer.style.removeProperty('transition');
		if (step.type === 'pointerup' && moved > height / 3 && close(layer)) {
			layer.addEventListener(layer instanceof HTMLDialogElement ? 'close' : 'toggle', () => layer.style.removeProperty('translate'), {once: true});
		} else {
			layer.style.removeProperty('translate');
		}
	};
	layer.addEventListener('pointermove', move);
	layer.addEventListener('pointerup', end);
	layer.addEventListener('pointercancel', end);
});
