// REDZ.UI docs - the site's script, not part of the library. The view: theme and direction from ?theme= and ?dir=,
// else as last chosen here, set before the page paints; a twin written right to left stays so. The state mirror: every
// :hover, :focus-visible, :focus and :active rule of the page's stylesheets is copied, in its place, under
// [data-docs-state~="…"], so a state grid shows those states without a pointer or a key - the probes compare the copy
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
	// The folded pages, kept here as the library keeps nothing.
	document.addEventListener('redz:fold', (event) => store('folded', event.detail.folded ? '1' : ''));
	document.addEventListener('DOMContentLoaded', () => {
		if (stored('folded') === '1') {
			document.getElementById('docs-nav')?.setAttribute('data-folded', '');
		}
	});
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
		'confirm-phrase': async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete the site lagoon.example?', text: 'Its pages, its files and its settings go away for good.', ok: 'Delete the site', tone: 'danger', phrase: 'lagoon.example'}) ? 'Confirmed.' : 'Cancelled.'),
		'confirm-lists': async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete the project Riverside tower?', note: {tone: 'danger', text: 'This cannot be undone.'}, sections: [{title: 'Will be deleted:', items: ['128 tasks', '342 files', '1,204 log entries']}, {title: 'Kept:', items: ['The audit history']}], ok: 'Delete', tone: 'danger', phrase: 'Riverside tower'}) ? 'Confirmed.' : 'Cancelled.'),
		'busy-button': (button) => REDZ.ui.busy(button, new Promise((done) => setTimeout(done, 2000))),
		'cooldown': (button) => {
			button.dataset.cooldown = '20';
		},
		'flash': () => {
			const row = document.getElementById('utilities-flash-target');
			row.classList.remove('flash');
			void row.offsetWidth;
			row.classList.add('flash');
		},
		'busy-region': (button) => REDZ.ui.busy(document.getElementById(button.getAttribute('aria-controls')), new Promise((done) => setTimeout(done, 2000))),
		'alert-fill': () => {
			const words = document.getElementById('alert-fill-words');
			words.textContent = words.textContent === '' ? 'The code is wrong. Two tries are left.' : '';
		},
	};
	document.addEventListener('click', (event) => {
		const button = event.target instanceof Element ? event.target.closest('[data-docs-run]') : null;
		if (button !== null && button.getAttribute('aria-disabled') !== 'true') {
			calls[button.dataset.docsRun]?.(button);
		}
	});

	const people = ['Anong Srisuk', 'Boris Lebedev', 'Chen Wei', 'Dao Nguyen', 'Elena Petrova', 'Farid Haddad', 'Grace Kim', 'Hiroshi Sato', 'Ingrid Berg', 'Kanya Thongchai', 'Leila Nasser', 'Maria Lopez', 'Niran Pongsak', 'Olga Ivanova', 'Somchai Wong'];
	document.addEventListener('redz:search', (event) => {
		const list = document.getElementById(event.target.getAttribute('aria-controls') || '');
		const query = event.detail.query.toLowerCase();
		if (list === null || !list.hasAttribute('data-docs-remote') || query === '') {
			return;
		}
		event.preventDefault();
		setTimeout(() => {
			if (event.detail.signal.aborted) {
				return;
			}
			list.replaceChildren(...people.filter((name) => name.toLowerCase().includes(query)).map((name) => {
				const option = Object.assign(document.createElement('div'), {className: 'menu-item', id: list.id + '-' + name.toLowerCase().replace(/\W+/g, '-'), textContent: name});
				option.setAttribute('role', 'option');
				option.dataset.value = name.toLowerCase().replace(/\W+/g, '.');
				return option;
			}));
		}, 400);
	});

	// The editor's page: the package loaded where its example stands.
	document.addEventListener('DOMContentLoaded', () => {
		const host = document.getElementById('editor-demo-host');
		if (host === null) {
			return;
		}
		document.head.append(Object.assign(document.createElement('link'), {rel: 'stylesheet', href: '../editor/editor.css'}));
		import('../editor/editor.js').then(({editor}) => editor(host, {
			placeholder: 'The page text',
			value: '<h2>A day on Ang Thong</h2><p>The boat leaves the pier at <strong>8:00</strong>; bring a hat and water.</p><div class="alert alert-info"><i class="bi bi-info-circle" aria-hidden="true"></i><div>The park fee is paid at the pier.</div></div><ul><li>Kayaks in the lagoon</li><li>The viewpoint</li></ul><div class="accordion"><details class="accordion-item" name="editor-demo"><summary class="accordion-header">What is included?<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">Lunch, the gear and the transfer.</div></details></div>',
		}));
	});

	// The tabs that ask before they are left: a changed note asks first.
	document.addEventListener('input', (event) => {
		if (event.target instanceof HTMLElement && event.target.id === 'nav-guard-note') {
			event.target.dataset.changed = '';
		}
	});
	document.addEventListener('redz:select', (event) => {
		const note = document.getElementById('nav-guard-note');
		if (event.detail.from?.id !== 'nav-guard-1' || note?.dataset.changed === undefined) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(REDZ.ui.confirm({title: 'Leave without saving?', text: 'The note for the guides has changes that are not saved.', ok: 'Leave', tone: 'danger'}).then((leave) => {
			if (leave) {
				delete note.dataset.changed;
			}
			return leave;
		}));
	});

	// The PIN pad's check: 2580 opens after 600 ms, any other PIN is wrong.
	document.addEventListener('redz:pin', (event) => {
		const alert = document.getElementById('pin-unlock-alert');
		if (alert === null || !event.target.closest('#pin-unlock')) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(new Promise((done) => setTimeout(() => {
			const right = event.detail.value === '2580';
			alert.className = right ? 'alert alert-success' : 'alert alert-danger';
			alert.textContent = right ? 'Unlocked.' : 'Wrong PIN. 4 tries left.';
			done(right);
		}, 600)));
	});

	// The tree's lazy Archive: two pages after 400 ms.
	document.addEventListener('redz:expand', (event) => {
		if (!event.target.hasAttribute('data-docs-lazy')) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(new Promise((done) => setTimeout(() => {
			event.target.innerHTML = '<li class="tree-item"><div class="tree-row"><a href="#tree-pages">Songkran 2025</a></div></li><li class="tree-item"><div class="tree-row"><a href="#tree-pages">Loy Krathong 2025</a></div></li>';
			done();
		}, 400)));
	});

	// The upload's example: each file "sent" in a second and a half, its bar moving.
	document.addEventListener('redz:files', (event) => {
		if (!event.target.hasAttribute('data-docs-upload')) {
			return;
		}
		event.preventDefault();
		const {progress, signal} = event.detail;
		event.detail.respondWith(new Promise((sent) => {
			let step = 0;
			const timer = setInterval(() => {
				progress(++step / 10);
				if (step === 10) {
					clearInterval(timer);
					sent();
				}
			}, 150);
			signal.addEventListener('abort', () => clearInterval(timer));
		}));
	});

	// The inline edit's "saved by the page" example: a save after 600 ms, an empty title refused.
	document.addEventListener('redz:save', (event) => {
		if (!event.target.hasAttribute('data-docs-save')) {
			return;
		}
		event.preventDefault();
		const value = event.detail.value.trim();
		event.detail.respondWith(new Promise((saved, refused) => setTimeout(() => (value === '' ? refused('A title cannot be empty') : saved(value)), 600)));
	});
})();
