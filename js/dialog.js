// REDZ.UI, dialogs: where the browser has no closedby (Chrome before 134, Firefox before 141, Safari), a press and a
// release on the backdrop of a modal dialog with closedby="any" ask it to close, as the attribute does. As a layer
// opens, data-page-fits on the root says the page is no taller than the window: the scroll lock keeps no room for a
// scrollbar the page did not have.
const root = document.documentElement;
const fits = () => root.toggleAttribute('data-page-fits', root.scrollHeight <= root.clientHeight);
new MutationObserver(fits).observe(root, {subtree: true, attributes: true, attributeFilter: ['open']});
document.addEventListener('beforetoggle', fits, true);
fits();

if (!('closedBy' in HTMLDialogElement.prototype)) {
	/** The modal dialog with closedby="any" whose backdrop the point lies on, or null. */
	const backdropOf = (event) => {
		const dialog = event.target;
		if (!(dialog instanceof HTMLDialogElement) || !dialog.matches(':modal') || dialog.getAttribute('closedby') !== 'any') {
			return null;
		}
		const box = dialog.getBoundingClientRect();
		return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom ? null : dialog;
	};
	let pressed = null;
	document.addEventListener('pointerdown', (event) => {
		pressed = backdropOf(event);
	}, true);
	document.addEventListener('click', (event) => {
		const dialog = backdropOf(event);
		if (dialog === null || dialog !== pressed) {
			return;
		}
		if (typeof dialog.requestClose === 'function') {
			dialog.requestClose();
		} else if (dialog.dispatchEvent(new Event('cancel', {cancelable: true}))) {
			dialog.close();
		}
	});
}
