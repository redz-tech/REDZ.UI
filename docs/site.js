// REDZ.UI docs - the site's script, not part of the library. The view: theme and direction from ?theme= and ?dir=,
// else as last chosen here, set before the page paints; a twin written right to left stays so. The state mirror: every
// :hover, :focus-visible, :focus and :active rule of the page's stylesheets is copied, in its place, under
// [data-docs-state~="…"], so a state grid shows those states without a pointer or a key - the probes compare the copy
// with the real state. A rule that names a state only inside :not() is a rule of the rest: it takes the mark into its
// :not() instead of a copy, as a copy would match everything unmarked. The examples' buttons with data-docs-run call REDZ.ui.
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
		// The ticking times' moments, so many seconds before now.
		for (const time of document.querySelectorAll('time[data-docs-since]')) {
			time.dateTime = new Date(Date.now() - Number(time.dataset.docsSince) * 1000).toISOString();
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
	const not = /:not\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
	const mirror = (list) => {
		for (let i = 0; i < list.cssRules.length; i++) {
			const rule = list.cssRules[i];
			if (rule instanceof CSSImportRule) {
				if (rule.styleSheet !== null) {
					mirror(rule.styleSheet);
				}
			} else if (rule instanceof CSSStyleRule) {
				const copy = rule.selectorText.replace(pseudo, '[data-docs-state~="$1"]');
				if (copy !== rule.selectorText && rule.selectorText.replace(not, '').search(pseudo) === -1) {
					rule.selectorText = rule.selectorText.replace(not, (part) => part.replace(pseudo, '$&, [data-docs-state~="$1"]'));
				} else if (copy !== rule.selectorText) {
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
		'toast-success': () => REDZ.ui.toast({title: 'Saved', text: 'North Bay · 3 pages rebuilt', tone: 'success'}),
		'toast-info': () => REDZ.ui.toast({title: 'Import started', text: 'You can leave this page.', tone: 'info'}),
		'toast-danger': () => REDZ.ui.toast({title: 'Not saved', text: 'The connection was lost; try again.', tone: 'danger'}),
		'banner-warning': () => REDZ.ui.banner({tone: 'warning', text: 'The system is paused for maintenance. Your changes are kept; try again in a few minutes.'}),
		'banner-danger': () => REDZ.ui.banner({tone: 'danger', text: 'The connection is lost. Changes made now are not saved.'}),
		'banner-clear': () => REDZ.ui.banner(null),
		'toast-action': () => REDZ.ui.toast({title: 'Moved to the archive', tone: 'info', action: {label: 'Undo', run: () => REDZ.ui.toast({title: 'Restored', tone: 'success'})}}),
		confirm: async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete 2 excursions?', text: 'Their pages go away on all three sites.', ok: 'Delete', tone: 'danger'}) ? 'Confirmed.' : 'Cancelled.'),
		'confirm-phrase': async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete the site lagoon.example?', text: 'Its pages, its files and its settings go away for good.', ok: 'Delete the site', tone: 'danger', phrase: 'lagoon.example'}) ? 'Confirmed.' : 'Cancelled.'),
		prompt: async (button) => {
			const name = await REDZ.ui.prompt({title: 'Rename the folder', label: 'Name', value: 'Tours 2026', required: true, ok: 'Rename'});
			answer(button, name === null ? 'Cancelled.' : 'Renamed to ' + name + '.');
		},
		'confirm-lists': async (button) => answer(button, await REDZ.ui.confirm({title: 'Delete the project Riverside tower?', note: {tone: 'danger', text: 'This cannot be undone.'}, sections: [{title: 'Will be deleted:', items: ['128 tasks', '342 files', '1,204 log entries']}, {title: 'Kept:', items: ['The audit history']}], ok: 'Delete', tone: 'danger', phrase: 'Riverside tower'}) ? 'Confirmed.' : 'Cancelled.'),
		'busy-button': (button) => REDZ.ui.busy(button, new Promise((done) => setTimeout(done, 2000))),
		progress: () => REDZ.ui.progress(new Promise((done) => setTimeout(done, 2000))),
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
		'status-save': () => REDZ.ui.status(document.getElementById('status-save-line'), new Promise((done) => setTimeout(done, 1200))),
		'status-refuse': () => REDZ.ui.status(document.getElementById('status-save-line'), new Promise((done, refuse) => setTimeout(() => refuse(new Error('The name is taken. Pick another.')), 1200))).catch(() => {}),
		'status-words': () => REDZ.ui.status(document.getElementById('status-words-line'), {tone: 'warning', text: 'Published; the sites rebuild within a minute.'}),
		'confirm-rows': async (button) => answer(button, await REDZ.ui.confirm({title: 'Pay for booking 24-0187?', rows: [{label: 'Excursion', value: 'North Bay by speedboat'}, {label: 'Guests', value: '2 adults, 1 child'}, {label: 'To pay', value: '5,850 THB'}], ok: 'Pay'}) ? 'Paid.' : 'Cancelled.'),
		'log-line': (button) => {
			const log = document.getElementById(button.getAttribute('aria-controls'));
			const time = document.createElement('span');
			time.dataset.tone = 'muted';
			time.textContent = new Date().toTimeString().slice(0, 8);
			log.append('\n', time, ' A new line, kept in view');
		},
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

	const people = ['Alex Sample', 'Ben Sample', 'Chris Sample', 'Dana Sample', 'Ella Sample', 'Frank Sample', 'Grace Sample', 'Hana Sample', 'Iris Sample', 'Kim Sample', 'Lena Sample', 'Mia Sample', 'Nick Sample', 'Olive Sample', 'Sam Sample'];
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

	// The editor's example, on the pages that link the package: the same text under three people's rights.
	document.addEventListener('DOMContentLoaded', () => {
		const host = document.getElementById('editor-demo-host');
		if (host === null) {
			return;
		}
		const people = {
			expert: {html: true, ai: true, design: true, structure: true, facts: true, lock: true, review: true},
			author: {ai: true, design: true, structure: true, facts: true, review: true},
			translator: {ai: true},
		};
		const value = [
			'<h2 data-block="title">A day on North Bay</h2>',
			'<p data-block="boat">The boat leaves the pier at <data value="depart">8:00</data> and a seat costs <data value="adult">2,500 THB</data>, so bring a hat, water and something warm for the way back.</p>',
			'<div class="alert alert-info"><i class="bi bi-info-circle" aria-hidden="true"></i><div>The park fee is paid at the pier.</div></div>',
			'<ul><li>Kayaks in the lagoon</li><li>The viewpoint</li></ul>',
			'<table class="table"><thead><tr><th scope="col">Boat</th><th scope="col">Seats</th><th scope="col">Leaves</th></tr></thead><tbody><tr><td>Boat A</td><td>12</td><td>8:00</td></tr><tr><td>Boat B</td><td>30</td><td>9:30</td></tr></tbody></table>',
			'<div class="accordion"><details class="accordion-item" name="editor-demo"><summary class="accordion-header">What is included?<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">Lunch, the gear and the transfer.</div></details><details class="accordion-item" name="editor-demo"><summary class="accordion-header">What if it rains?<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">The trip moves to the next dry day.</div></details></div>',
			'<div class="grid md:cols-2 gap-16"><div class="card"><div class="card-body vstack gap-8"><h3>The lagoon</h3><p>A short climb to a green lake inside the rock.</p></div></div><div class="card"><div class="card-body vstack gap-8"><h3>The viewpoint</h3><p>Forty-two islands from one steep path.</p></div></div></div>',
			'<div class="alert alert-warning" data-block="safety" data-lock="form"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div>The sea closes the park from October to December.</div></div>',
		].join('');
		const facts = [{key: 'depart', label: 'Departure', text: '8:00'}, {key: 'adult', label: 'Price, adult', text: '2,500 THB'}];
		const thai = '<h2 data-block="title" data-by="mt">หนึ่งวันที่อ่าวเหนือ</h2><p data-block="boat">เรือออกจากท่าเวลา <data value="depart">8:00</data></p>';
		// A stand-in for the host's AI: it calls no model, so the example runs anywhere and shows the seam.
		const shorter = (words) => words.split(/[,;](?![^⟦]*⟧)/)[0].replace(/\.?$/, '.');
		const answers = {
			rewrite: (task) => ({blocks: task.blocks.map((block) => ({id: block.id, fields: block.fields.map((words) => {
				const short = shorter(words);
				const keeps = (words.match(/⟦[\w.-]+⟧/g) ?? []).every((token) => short.includes(token));
				return {shorter: keeps ? short : words, simpler: words.replace('leaves the pier', 'goes'), warmer: words + ' We look forward to seeing you.', fix: words}[task.how];
			})}))}),
			tones: (task) => ({grid: [(words) => words, (words) => words, (words) => words + ' Ask us anything.'].map((length) => [(words) => 'Please note: ' + words, (words) => words, (words) => words + ' Welcome aboard!'].map((tone) => task.blocks[0].fields.map((words) => tone(length(words)))))}),
			translate: (task) => ({blocks: task.blocks.map((block) => ({id: block.id, fields: block.fields.map((words) => 'TH: ' + words)}))}),
			write: () => ({blocks: [{kind: 'heading', level: 2, tone: '', size: '', text: 'Before you go', href: '', head: [], rows: [], items: []}, {kind: 'alert', level: 0, tone: 'warning', size: '', text: 'The **sea** closes the park from October to December.', href: '', head: [], rows: [], items: []}]}),
			read: (task) => ({text: task.text.split(/\n|(?<=\.)\s/).find((line) => task.question.toLowerCase().split(/\W+/).some((word) => word.length > 3 && line.toLowerCase().includes(word))) ?? 'The page does not say.'}),
			alt: () => ({text: 'A green lagoon inside the rock'}),
		};
		const ai = (task, tools) => new Promise((done, fail) => {
			const timer = setTimeout(() => done(answers[task.kind](task)), 700);
			tools.signal.addEventListener('abort', () => {
				clearTimeout(timer);
				fail(new DOMException('Stopped', 'AbortError'));
			});
		});
		const page = REDZ.ui.editor(host, {placeholder: 'The page text', ids: true, rights: people.expert, value, facts, onFact: () => true, ai, source: 'en', languages: [{code: 'en', label: 'EN', value}, {code: 'th', label: 'TH', value: thai}], person: {name: 'Anna'}});
		document.getElementById('editor-demo-rights').addEventListener('click', (event) => {
			const one = event.target.closest('[data-rights]');
			if (one !== null) {
				for (const each of event.currentTarget.children) {
					each.setAttribute('aria-pressed', String(each === one));
				}
				page.setRights(people[one.dataset.rights]);
			}
		});
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

	// The stored papers: the server lets a file go after 600 ms, but keeps the contract, which an invoice uses.
	document.addEventListener('redz:remove', (event) => {
		if (!event.target.closest('#upload-stored')) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(new Promise((done, refuse) => setTimeout(() => (event.detail.id === '41' ? refuse('An invoice uses the contract; it stays.') : done()), 600)));
	});

	// A paper added to them: sent in 600 ms, the server answering the id it keeps it under.
	let paper = 42;
	document.addEventListener('redz:files', (event) => {
		if (!event.target.closest('#upload-stored')) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(new Promise((sent) => setTimeout(() => sent(++paper), 600)));
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

	// The forms sent on a change: what they would send, written beside them instead of leaving the page.
	document.addEventListener('submit', (event) => {
		const form = event.target;
		if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-docs-submit')) {
			return;
		}
		event.preventDefault();
		const sent = form.querySelector('[data-docs-sent]');
		if (sent !== null) {
			sent.textContent = new URLSearchParams(new FormData(form)).toString();
		}
	});

	// The tree's lazy Archive: two pages after 400 ms.
	document.addEventListener('redz:expand', (event) => {
		if (!event.target.hasAttribute('data-docs-lazy')) {
			return;
		}
		event.preventDefault();
		event.detail.respondWith(new Promise((done) => setTimeout(() => {
			event.target.innerHTML = '<li class="tree-item"><div class="tree-row"><a href="#tree-pages">Water Festival 2025</a></div></li><li class="tree-item"><div class="tree-row"><a href="#tree-pages">Lantern Festival 2025</a></div></li>';
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
