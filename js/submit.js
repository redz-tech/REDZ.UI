// REDZ.UI, forms that go on a change: data-submit="change" on a form or on one of its controls sends the form when such a
// control changes - by requestSubmit, so the browser's checks and the page's submit listeners run. A text field
// changes when it is left, not at every key; a combobox's list changes when a value is chosen.
document.addEventListener('change', (event) => {
	const control = event.target instanceof Element ? event.target : null;
	const form = control === null ? null : (control.form ?? control.closest('form'));
	const marked = control?.closest('[data-submit]') ?? form;
	if (form instanceof HTMLFormElement && marked?.getAttribute('data-submit') === 'change' && (marked === form || form.contains(marked) || marked === control)) {
		form.requestSubmit();
	}
});
