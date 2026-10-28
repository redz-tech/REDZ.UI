// REDZ.UI reference, widgets: the page's buttons call REDZ.ui — a page of the reference, not part of the library.
const answer = document.getElementById('w-answer');
const calls = {
	'toast-success': () => REDZ.ui.toast({title: 'Saved', text: 'Ang Thong · 3 pages rebuilt', tone: 'success'}),
	'toast-danger': () => REDZ.ui.toast({title: 'Not saved', text: 'The connection was lost; try again.', tone: 'danger'}),
	'toast-action': () => REDZ.ui.toast({title: 'Moved to the archive', tone: 'info', action: {label: 'Undo', run: () => REDZ.ui.toast({title: 'Restored', tone: 'success'})}}),
	confirm: async () => {
		const yes = await REDZ.ui.confirm({title: 'Delete 2 excursions?', text: 'Their pages go away on all three sites.', ok: 'Delete', tone: 'danger'});
		answer.textContent = yes ? 'Confirmed.' : 'Cancelled.';
	},
	busy: (button) => REDZ.ui.busy(button, new Promise((done) => setTimeout(done, 2000))),
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('[data-widget]') : null;
	if (button !== null && button.getAttribute('aria-disabled') !== 'true') {
		calls[button.dataset.widget]?.(button);
	}
});
