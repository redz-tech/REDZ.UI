// REDZ.UI docs — the site's script, not part of the library. The view: theme and direction from ?theme= and ?dir=,
// else as last chosen here, set before the page paints; a twin written right to left stays so. The state mirror: every
// :hover, :focus-visible, :focus and :active rule of the page's stylesheets is copied, in its place, under
// [data-docs-state~="…"], so a state grid shows those states without a pointer or a key — the probes compare the copy
// with the real state. The examples' buttons with data-docs-run call REDZ.ui.
(() => {
	const root = document.documentElement;
	const params = new URLSearchParams(location.search);
	const fixed = params.has('theme') || params.has('dir');
	const twin = root.getAttribute('dir') === 'rtl';
	const stored = (key) => {
		try {
			return localStorage.getItem('redz-ui.docs.' + key);
		} catch {
			return null;
		}
	};
	const store = (key, value) => {
		try {
			if (!fixed) {
				localStorage.setItem('redz-ui.docs.' + key, value);
			}
		} catch {
		}
	};
	const state = {theme: params.get('theme') || stored('theme') || 'system', dir: params.get('dir') || stored('dir') || 'ltr'};
	const apply = () => {
		if (state.theme === 'light' || state.theme === 'dark') {
			root.dataset.theme = state.theme;
		} else {
			delete root.dataset.theme;
		}
		root.dir = twin || state.dir === 'rtl' ? 'rtl' : 'ltr';
		for (const item of document.querySelectorAll('[data-docs-theme], [data-docs-dir]')) {
			const checked = item.dataset.docsTheme ? item.dataset.docsTheme === state.theme : item.dataset.docsDir === root.dir;
			item.setAttribute('aria-checked', String(checked));
		}
	};
	apply();
	document.addEventListener('DOMContentLoaded', () => {
		apply();
		for (const box of document.querySelectorAll('[data-docs-indeterminate]')) {
			box.indeterminate = true;
		}
	});
	document.addEventListener('click', (event) => {
		const item = event.target instanceof Element ? event.target.closest('[data-docs-theme], [data-docs-dir]') : null;
		if (item !== null) {
			const axis = item.dataset.docsTheme ? 'theme' : 'dir';
			state[axis] = item.dataset.docsTheme || item.dataset.docsDir;
			store(axis, state[axis]);
			apply();
		}
	});

	const pseudo = /:(hover|focus-visible|focus|active)(?![\w-])/g;
	const mirror = (list) => {
		for (let i = 0; i < list.cssRules.length; i++) {
			const rule = list.cssRules[i];
			if (rule instanceof CSSImportRule) {
				if (rule.styleSheet !== null) {
					mirror(rule.styleSheet);
				}
			} else if (rule instanceof CSSStyleRule) {
				const copy = rule.selectorText.replace(pseudo, '[data-docs-state~="$1"]');
				if (copy !== rule.selectorText) {
					list.insertRule(copy + ' {' + rule.style.cssText + '}', ++i);
				}
			} else if (rule.cssRules !== undefined) {
				mirror(rule);
			}
		}
	};
	for (const sheet of document.styleSheets) {
		try {
			mirror(sheet);
		} catch (error) {
			console.error('REDZ.UI docs: the state mirror cannot read ' + sheet.href, error);
		}
	}

	const answer = (button, words) => {
		const out = button.closest('.docs-example')?.querySelector('[data-docs-answer]');
		if (out) {
			out.textContent = words;
		}
	};
	const calls = {
		toggle: (button) => button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')),
		'toast-success': () => REDZ.ui.toast({title: 'Saved', text: 'Ang Thong · 3 pages rebuilt', tone: 'success'}),
		'toast-info': () => REDZ.ui.toast({title: 'Import started', text: 'You can leave this page.', tone: 'info'}),
		'toast-danger': () => REDZ.ui.toast({title: 'Not saved', text: 'The connection was lost; try again.', tone: 'danger'}),
		'toast-action': () => REDZ.ui.toast({title: 'Moved to the archive', tone: 'info', action: {label: 'Undo', run: () => REDZ.ui.toast({title: 'Restored', tone: 'success'})}}),
		confirm: async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete 2 excursions?', text: 'Their pages go away on all three sites.', ok: 'Delete', tone: 'danger'}) ? 'Confirmed.' : 'Cancelled.'),
		'busy-button': (button) => REDZ.ui.busy(button, new Promise((done) => setTimeout(done, 2000))),
		'busy-region': (button) => REDZ.ui.busy(document.getElementById(button.getAttribute('aria-controls')), new Promise((done) => setTimeout(done, 2000))),
	};
	document.addEventListener('click', (event) => {
		const button = event.target instanceof Element ? event.target.closest('[data-docs-run]') : null;
		if (button !== null && button.getAttribute('aria-disabled') !== 'true') {
			calls[button.dataset.docsRun]?.(button);
		}
	});
})();
