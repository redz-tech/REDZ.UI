// REDZ.UI, dialogs: where the browser has no closedby (Chrome before 134, Firefox before 141, Safari), a click on the
// backdrop of a modal dialog with closedby="any" asks it to close, as the attribute does.
if (!('closedBy' in HTMLDialogElement.prototype)) {
	document.addEventListener('click', (event) => {
		const dialog = event.target;
		if (!(dialog instanceof HTMLDialogElement) || !dialog.matches(':modal') || dialog.getAttribute('closedby') !== 'any') {
			return;
		}
		const box = dialog.getBoundingClientRect();
		if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) {
			return;
		}
		if (typeof dialog.requestClose === 'function') {
			dialog.requestClose();
		} else if (dialog.dispatchEvent(new Event('cancel', {cancelable: true}))) {
			dialog.close();
		}
	});
}
