// REDZ.UI probes, the page part: the detectors a probe runs in a loaded page of any engine; every call answers plain data.
window.REDZ_PROBE = (() => {
	const root = document.documentElement;
	const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
	const pause = (ms) => new Promise((done) => setTimeout(done, ms));
	// Two frames - or five seconds, as a page the engine has put in the background draws no frames at all; a slow
	// simulator's frames may take more than a second, and the menu guard places its menu in one.
	const frames = () => new Promise((done) => {
		requestAnimationFrame(() => requestAnimationFrame(done));
		setTimeout(done, 5000);
	});
	const closed = (el) => el.closest('[popover]:not(:popover-open), dialog:not([open])') !== null;
	// The box an opened layer rests in, without the scale or move of its opening transition - a slow engine may not have
	// run it yet when the probe measures.
	const resting = (el) => {
		const style = el.getAttribute('style');
		for (const property of ['transition', 'scale', 'translate']) {
			el.style.setProperty(property, 'none', 'important');
		}
		const box = el.getBoundingClientRect();
		if (style === null) {
			el.removeAttribute('style');
		} else {
			el.setAttribute('style', style);
		}
		return box;
	};
	const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !closed(el);
	// The element a button works on: its commandfor's, or the region a --toggle button names in aria-controls.
	const targetOf = (button) => document.getElementById(button.getAttribute('commandfor') || (button.getAttribute('command') === '--toggle' ? (button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0] : ''));
	// Hidden on purpose: the screen-reader-only pattern clips its box to nothing.
	const unseen = (el) => getComputedStyle(el).clipPath === 'inset(50%)';
	// The page's own errors from here on - an engine whose driver brings no events (Safari) shows them only this way.
	const errors = [];
	addEventListener('error', (event) => errors.push('exception ' + String(event.message || event.error)));
	addEventListener('unhandledrejection', (event) => errors.push('unhandled rejection ' + String(event.reason?.message ?? event.reason)));
	const consoleError = console.error;
	console.error = (...parts) => {
		errors.push('console ' + parts.map(String).join(' '));
		consoleError.apply(console, parts);
	};
	const live = '[aria-live], [role="status"], [role="alert"], [role="log"]';
	const mirrored = [];
	const itemsOf = (menu) => [...menu.querySelectorAll('[role^="menuitem"]')].filter((item) => item.getClientRects().length > 0 && item.getAttribute('aria-disabled') !== 'true');
	const clipped = (el) => {
		for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
			if (getComputedStyle(a).overflowX !== 'visible') {
				return true;
			}
		}
		return false;
	};
	return {
		// The cell's theme and direction, set with transitions off: an engine that cannot emulate the system's theme
		// (Safari) first draws the page in the system's, and a button would still be fading to the cell's when measured.
		async prepare(theme, dir) {
			const still = document.createElement('style');
			still.textContent = '*, *::before, *::after { transition: none !important; }';
			document.head.append(still);
			root.setAttribute('data-probe', '');
			root.setAttribute('data-theme', theme);
			root.dir = dir;
			await Promise.race([document.fonts.ready, pause(5000)]);
			await frames();
			still.remove();
			for (const animation of document.getAnimations()) {
				if (animation.effect?.getTiming().iterations === Infinity) {
					animation.pause();
				}
			}
			return true;
		},
		measure() {
			const vw = root.clientWidth;
			const offenders = [];
			for (const el of document.querySelectorAll('body *')) {
				if (closed(el)) {
					continue;
				}
				const r = el.getBoundingClientRect();
				const spills = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim() !== '') && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && r.left + el.scrollWidth > vw + 1;
				if (r.width > 0 && (r.right > vw + 1 || r.left < -1 || spills) && !clipped(el) && !offenders.some((o) => o.contains(el))) {
					offenders.push(el);
				}
			}
			const icons = [...document.querySelectorAll('.bi')];
			const unmasked = icons.filter((icon) => {
				const style = getComputedStyle(icon);
				const mask = style.maskImage || style.webkitMaskImage;
				return !mask || mask === 'none';
			});
			const unregioned = [];
			for (const el of document.querySelectorAll('[class*=":"]')) {
				const width = [...el.classList].filter((c) => /^(sm|md|lg|xl|2xl):/.test(c));
				let region = false;
				for (let a = el.parentElement; a && width.length && !region; a = a.parentElement) {
					region = (getComputedStyle(a).containerName || '').split(/\s+/).includes('region');
				}
				if (width.length && !region) {
					unregioned.push(name(el) + ' [' + width.join(' ') + ']');
				}
			}
			const cut = [];
			for (const el of document.querySelectorAll('.btn, .badge, .chip, .nav-link, .menu-item, .app-link, .form-label, label')) {
				if (shown(el) && !unseen(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
					cut.push(name(el) + ' "' + el.textContent.trim().slice(0, 30) + '"');
				}
			}
			return {
				client: vw,
				scroll: root.scrollWidth,
				forced: matchMedia('(forced-colors: active)').matches,
				scheme: getComputedStyle(root).colorScheme,
				dir: getComputedStyle(root).direction,
				icons: icons.length,
				offenders: offenders.slice(0, 8).map((el) => {
					const r = el.getBoundingClientRect();
					return name(el) + ' [' + Math.round(r.left) + ', ' + Math.round(r.right) + ']';
				}),
				unmasked: unmasked.slice(0, 5).map(name),
				unregioned: unregioned.slice(0, 8),
				cut: cut.slice(0, 8),
				busyLive: [...document.querySelectorAll('[aria-busy="true"]')].filter((el) => el.matches(live) || el.querySelector(live) !== null).slice(0, 8).map(name),
				toggles: [...document.querySelectorAll('button[command="--toggle"]')].filter((button) => {
					const target = targetOf(button);
					return target === null || button.getAttribute('aria-expanded') !== String(!target.hidden);
				}).slice(0, 8).map((button) => name(button) + ' → #' + (button.getAttribute('aria-controls') || button.getAttribute('commandfor'))),
				toggleFor: [...document.querySelectorAll('button[command="--toggle"][commandfor]')].slice(0, 8).map(name),
				tips: [...document.querySelectorAll('[role="tooltip"][popover][id]')].flatMap((tip) => [...document.querySelectorAll('[commandfor="' + CSS.escape(tip.id) + '"]')].filter((button) => !(button.getAttribute('aria-describedby') || '').split(/\s+/).includes(tip.id))).slice(0, 8).map(name),
				scrollspies: [...document.querySelectorAll('[data-scrollspy]')].filter((nav) => nav.querySelectorAll('[aria-current="location"]').length !== 1).slice(0, 8).map(name),
				strengths: [...document.querySelectorAll('[data-strength]')].filter((show) => !(document.getElementById(show.dataset.strength) instanceof HTMLInputElement)).slice(0, 8).map(name),
				edits: [...document.querySelectorAll('.inline-edit-form')].filter((form) => document.getElementById(form.dataset.for || '') === null).slice(0, 8).map(name),
				grips: [...document.querySelectorAll('.drag-handle')].filter((grip) => grip.closest('[data-reorder]') === null || grip.closest('[data-value]') === null).slice(0, 8).map(name),
				uploads: [...document.querySelectorAll('.upload')].filter((upload) => ['input[type="file"]', '.upload-zone', 'template', '.upload-list'].some((part) => upload.querySelector(part) === null)).slice(0, 8).map(name),
				comboboxes: [...document.querySelectorAll('input[role="combobox"][aria-controls]')].flatMap((input) => {
					const list = document.getElementById(input.getAttribute('aria-controls') || '');
					if (list === null) {
						return [name(input) + ': no list #' + input.getAttribute('aria-controls')];
					}
					const wrong = [];
					const active = input.getAttribute('aria-activedescendant');
					const option = active ? document.getElementById(active) : null;
					if (active && (option === null || !list.contains(option) || option.hidden)) {
						wrong.push(name(input) + ': the active option #' + active + ' is not a shown option of its list');
					}
					if (list.dataset.name) {
						const scope = list.closest('[popover], dialog') ?? list.parentElement;
						const held = new Set([...scope.querySelectorAll('input[type="hidden"]')].filter((holder) => holder.name === list.dataset.name).map((holder) => holder.value));
						for (const each of list.querySelectorAll('[role="option"][data-value]')) {
							if ((each.getAttribute('aria-selected') === 'true') !== held.has(each.dataset.value)) {
								wrong.push(name(each) + ': aria-selected="' + each.getAttribute('aria-selected') + '" but its value is' + (held.has(each.dataset.value) ? '' : ' not') + ' held');
							}
						}
					}
					const panel = list.closest('[popover]');
					const face = panel === null ? null : document.querySelector('.combobox-toggle[commandfor="' + CSS.escape(panel.id) + '"]');
					if (face !== null && face.getAttribute('aria-expanded') !== String(panel.matches(':popover-open'))) {
						wrong.push(name(face) + ': aria-expanded="' + face.getAttribute('aria-expanded') + '" on a ' + (panel.matches(':popover-open') ? 'shown' : 'hidden') + ' panel');
					}
					return wrong;
				}).slice(0, 8),
				hidden: document.visibilityState !== 'visible',
				ui: typeof globalThis.REDZ?.ui?.toast === 'function'
			};
		},
		// The docs' state mirror: each copy (data-docs-state) and its twin at rest - the element of the same tag and
		// classes in the first cell of its row of the grid - kept by number, as one twin stands for several copies.
		mirrors() {
			mirrored.length = 0;
			for (const copy of document.querySelectorAll('[data-docs-state]')) {
				const row = copy.closest('.docs-matrix > tbody > tr');
				const first = row?.querySelector(':scope > td');
				const twin = first ? [...first.querySelectorAll(copy.tagName)].find((el) => el.className === copy.className && !el.hasAttribute('data-docs-state')) : undefined;
				if (twin !== undefined) {
					mirrored.push([twin, copy]);
				}
			}
			return mirrored.map(([twin, copy]) => ({state: copy.dataset.docsState, what: name(twin)}));
		},
		// The twin brought into view: the point of its middle. For a focus, a button put just before it - before its
		// <details>, for a summary - takes the focus, so that the next Tab, a real key, gives it to the twin.
		async rest(i, focus) {
			const [twin] = mirrored[i];
			twin.scrollIntoView({block: 'center', inline: 'center'});
			if (focus) {
				const before = Object.assign(document.createElement('button'), {type: 'button', textContent: 'probe'});
				before.dataset.probeBefore = '';
				(twin.localName === 'summary' ? twin.parentElement : twin).before(before);
				before.focus();
			}
			await frames();
			const box = twin.getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		// The differences between the twin in its real state and the copy, the element and its first descendants, read
		// with transitions off; then the focus helper goes.
		async compare(i) {
			await frames();
			const [twin, copy] = mirrored[i];
			const props = ['background-color', 'color', 'border-top-color', 'border-bottom-color', 'box-shadow', 'outline-style', 'outline-color', 'outline-width', 'text-decoration-line', 'opacity'];
			const read = (el) => {
				const style = el.getAttribute('style');
				el.style.setProperty('transition', 'none', 'important');
				const s = getComputedStyle(el);
				const values = props.map((p) => s.getPropertyValue(p));
				if (style === null) {
					el.removeAttribute('style');
				} else {
					el.setAttribute('style', style);
				}
				return values;
			};
			const a = [twin, ...twin.querySelectorAll('*')].slice(0, 16);
			const b = [copy, ...copy.querySelectorAll('*')].slice(0, 16);
			const differ = [];
			a.forEach((el, k) => {
				const [x, y] = [read(el), read(b[k])];
				props.forEach((p, n) => {
					if (x[n] !== y[n] && differ.length < 4) {
						differ.push(name(el) + ' ' + p + ' ' + x[n] + ' ≠ ' + y[n]);
					}
				});
			});
			const active = document.activeElement === twin || twin.contains(document.activeElement);
			const state = copy.dataset.docsState;
			const real = state === 'hover' ? twin.matches(':hover') : twin.matches(':' + state);
			document.querySelectorAll('[data-probe-before]').forEach((el) => el.remove());
			return {differ, active, real};
		},
		// Up to 24 elements whose own text is Arabic, marked by number for the engine's font report.
		arabic() {
			const found = [];
			for (const el of document.body.querySelectorAll('*')) {
				if (found.length < 24 && [...el.childNodes].some((n) => n.nodeType === 3 && /\p{Script=Arabic}/u.test(n.data)) && el.getClientRects().length > 0) {
					el.dataset.probeArabic = String(found.length);
					found.push(name(el));
				}
			}
			return found;
		},
		errors() {
			if (document.documentElement.dataset.floor === 'below') {
				errors.push('floor: js/floor.js marks this engine below the floor');
			}
			return errors.splice(0);
		},
		// The widgets a keyboard walk tries: each menu, combobox, modal dialog and region a --toggle button opens by its first
		// shown invoker, each tab list, each accordion.
		keyTargets() {
			const out = [];
			const seen = new Set();
			for (const invoker of document.querySelectorAll('[commandfor], button[command="--toggle"][aria-controls]')) {
				const target = targetOf(invoker);
				const command = invoker.getAttribute('command') || '';
				const kind = invoker.classList.contains('combobox-toggle') && target?.querySelector('[role="listbox"]') ? 'combobox' : (target?.getAttribute('role') === 'menu' && command === 'toggle-popover' ? 'menu' : (target?.localName === 'dialog' && command === 'show-modal' ? 'dialog' : (target && command === '--toggle' ? 'toggle' : (target?.classList.contains('inline-edit-form') && command === '--edit' ? 'edit' : (target?.localName === 'input' && command === '--reveal' ? 'reveal' : '')))));
				if (kind !== '' && !seen.has(target) && shown(invoker)) {
					seen.add(target);
					invoker.setAttribute('data-probe-invoker', target.id);
					out.push({kind, id: target.id, outside: target.getAttribute('closedby') === 'any'});
				}
			}
			for (const list of document.querySelectorAll('[role="tablist"]')) {
				if (shown(list) && list.querySelectorAll('[role="tab"]').length > 1) {
					list.setAttribute('data-probe-tablist', String(out.length));
					out.push({kind: 'tabs', id: String(out.length), outside: false});
				}
			}
			for (const accordion of document.querySelectorAll('.accordion')) {
				if (shown(accordion) && accordion.querySelector(':scope > details > summary') !== null) {
					accordion.setAttribute('data-probe-accordion', String(out.length));
					out.push({kind: 'accordion', id: String(out.length), outside: false});
				}
			}
			for (const field of document.querySelectorAll('input[id]')) {
				if (shown(field) && document.querySelector('[data-strength="' + CSS.escape(field.id) + '"]') !== null) {
					out.push({kind: 'strength', id: field.id, outside: false});
				}
			}
			for (const tree of document.querySelectorAll('.tree[id]')) {
				const expand = document.querySelector('[commandfor="' + CSS.escape(tree.id) + '"][command="--expand-all"]');
				if (shown(tree) && expand !== null && shown(expand) && document.querySelector('[commandfor="' + CSS.escape(tree.id) + '"][command="--collapse-all"]') !== null) {
					expand.setAttribute('data-probe-invoker', tree.id);
					out.push({kind: 'trees', id: tree.id, outside: false});
				}
			}
			for (const list of document.querySelectorAll('[data-reorder]')) {
				const items = [...list.children].filter((child) => child.matches('[data-value]'));
				const grip = items[0]?.querySelector('.drag-handle');
				if (shown(list) && items.length > 1 && grip && shown(grip)) {
					list.id ||= 'probe-reorder-' + out.length;
					grip.setAttribute('data-probe-grip', list.id);
					out.push({kind: 'reorder', id: list.id, outside: false});
				}
			}
			for (const upload of document.querySelectorAll('.upload')) {
				if (shown(upload)) {
					upload.id ||= 'probe-upload-' + out.length;
					out.push({kind: 'upload', id: upload.id, outside: false});
				}
			}
			return out;
		},
		// Hands the upload two files as a choice would: one its input takes, and one too large for it or of a kind it
		// does not take.
		chooseFiles(id) {
			const upload = document.getElementById(id);
			const input = upload.querySelector('input[type="file"]');
			const wanted = input.accept.split(',').map((one) => one.trim()).filter(Boolean)[0] ?? '';
			const good = wanted.startsWith('.') ? 'probe' + wanted : 'probe.' + (wanted.split('/')[1] || 'bin').replace('*', 'png');
			const type = wanted.includes('/') ? wanted.replace('*', 'png') : '';
			const box = new DataTransfer();
			box.items.add(new File(['probe'], good, {type}));
			box.items.add(upload.dataset.maxSize ? new File(['x'.repeat(Number(upload.dataset.maxSize) + 1)], 'big-' + good, {type}) : new File(['probe'], 'probe.refused', {type: 'application/x-probe'}));
			input.files = box.files;
			input.dispatchEvent(new Event('change', {bubbles: true}));
			return true;
		},
		// Clicks the moves menu's item for the move, as Enter on it would.
		pickMove(id, move) {
			const menu = document.getElementById(document.querySelector('[data-probe-grip="' + id + '"]').getAttribute('commandfor'));
			menu.querySelector('[data-move="' + move + '"]').focus();
			return document.activeElement?.dataset.move === move;
		},
		// The middle of the walked list's first handle, a point of the viewport.
		gripPoint(id) {
			const box = document.querySelector('[data-probe-grip="' + id + '"]').getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		// The middle of the open moves menu's item for the move, a point of the viewport.
		movePoint(id, move) {
			const menu = document.getElementById(document.querySelector('[data-probe-grip="' + id + '"]').getAttribute('commandfor'));
			const box = menu.querySelector('[data-move="' + move + '"]').getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		// Types into a field as a person would, as far as the library hears it: the text, then an input event.
		typeInto(selector, words) {
			const field = document.querySelector(selector);
			field.value = words;
			field.dispatchEvent(new Event('input', {bubbles: true}));
			return true;
		},
		// The accordion's item the walk drives: the second, or the only one.
		walkedItem(id) {
			const items = [...document.querySelectorAll('[data-probe-accordion="' + id + '"] > details')];
			return items[Math.min(1, items.length - 1)];
		},
		focus(kind, id) {
			const el = kind === 'tabs' ? document.querySelector('[data-probe-tablist="' + id + '"] [role="tab"][aria-selected="true"]') : (kind === 'accordion' ? this.walkedItem(id).querySelector(':scope > summary') : (kind === 'strength' ? document.getElementById(id) : (kind === 'upload' ? document.getElementById(id).querySelector('.upload-zone') : document.querySelector('[data-probe-' + (kind === 'reorder' ? 'grip' : 'invoker') + '="' + id + '"]'))));
			el.scrollIntoView({block: 'nearest'});
			el.focus();
			return document.activeElement === el;
		},
		// The middle of the walked accordion item's summary, a point of the viewport.
		summaryPoint(id) {
			const box = this.walkedItem(id).querySelector(':scope > summary').getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		state(kind, id) {
			const active = document.activeElement;
			if (kind === 'accordion') {
				const items = [...document.querySelectorAll('[data-probe-accordion="' + id + '"] > details')];
				const walked = this.walkedItem(id);
				return {open: items.flatMap((item, i) => item.open ? [i] : []), walked: items.indexOf(walked), grouped: walked.name !== '' && items.every((item) => item.name === walked.name), onSummary: active === walked.querySelector(':scope > summary')};
			}
			if (kind === 'toggle') {
				const invoker = document.querySelector('[data-probe-invoker="' + id + '"]');
				return {open: !document.getElementById(id).hidden, expanded: invoker.getAttribute('aria-expanded'), onInvoker: active === invoker, busy: invoker.getAttribute('aria-busy') === 'true'};
			}
			if (kind === 'edit') {
				const form = document.getElementById(id);
				const value = document.getElementById(form.dataset.for || '');
				return {open: form.popover === null ? !form.hidden : form.matches(':popover-open'), inField: active !== null && active === form.querySelector('input:not([type="hidden"]), textarea, select'), valueShown: value !== null && shown(value), onInvoker: active === document.querySelector('[data-probe-invoker="' + id + '"]')};
			}
			if (kind === 'reveal') {
				const invoker = document.querySelector('[data-probe-invoker="' + id + '"]');
				return {type: document.getElementById(id).type, pressed: invoker.getAttribute('aria-pressed')};
			}
			if (kind === 'trees') {
				const groups = [...document.getElementById(id).querySelectorAll('.tree-group')].filter((group) => group.childElementCount > 0);
				return {open: groups.filter((group) => !group.hidden).length, groups: groups.length, said: groups.filter((group) => document.querySelector('button[command="--toggle"][aria-controls~="' + CSS.escape(group.id) + '"]')?.getAttribute('aria-expanded') === String(!group.hidden)).length};
			}
			if (kind === 'reorder') {
				const list = document.getElementById(id);
				const grip = document.querySelector('[data-probe-grip="' + id + '"]');
				const menu = document.getElementById(grip.getAttribute('commandfor') || '');
				return {order: [...list.children].filter((child) => child.matches('[data-value]')).map((child) => child.dataset.value), walked: grip.closest('[data-value]').dataset.value, onGrip: active === grip, open: menu?.matches(':popover-open') ?? false, said: list.parentElement.querySelector(':scope > .reorder-status')?.textContent ?? ''};
			}
			if (kind === 'upload') {
				return {rows: [...document.getElementById(id).querySelectorAll('.upload-list > *')].map((row) => ({state: row.dataset.state ?? '', error: row.querySelector('[data-file-error]')?.textContent ?? ''})), onZone: active?.classList.contains('upload-zone') ?? false, onRemove: active?.hasAttribute('data-file-remove') ?? false};
			}
			if (kind === 'combobox') {
				const panel = document.getElementById(id);
				const invoker = document.querySelector('[data-probe-invoker="' + id + '"]');
				const input = panel.querySelector('input[role="combobox"]');
				const list = document.getElementById(input?.getAttribute('aria-controls') || '');
				const option = document.getElementById(input?.getAttribute('aria-activedescendant') || '');
				const scope = list.closest('[popover], dialog') ?? list.parentElement;
				return {
					open: panel.matches(':popover-open'),
					expanded: invoker.getAttribute('aria-expanded'),
					onSearch: active === input,
					onInvoker: active === invoker,
					options: [...list.querySelectorAll('[role="option"]')].filter((each) => !each.hidden && each.getAttribute('aria-disabled') !== 'true').length,
					active: option === null || option.hidden ? null : (option.dataset.value ?? option.id),
					values: [...scope.querySelectorAll('input[type="hidden"]')].filter((holder) => holder.name === list.dataset.name).map((holder) => holder.value),
					multiple: list.getAttribute('aria-multiselectable') === 'true',
					offers: 'create' in list.dataset,
					activeCreate: option !== null && option.classList.contains('combobox-create'),
					created: [...scope.querySelectorAll('input[type="hidden"]')].filter((holder) => 'create' in list.dataset && holder.name === list.dataset.create).map((holder) => holder.value)
				};
			}
			if (kind === 'strength') {
				const shows = [...document.querySelectorAll('[data-strength="' + id + '"]')];
				return {levels: shows.filter((show) => show.localName === 'meter').map((meter) => meter.value), valuetexts: shows.filter((show) => show.localName === 'meter').map((meter) => meter.getAttribute('aria-valuetext')), words: shows.filter((show) => show.localName !== 'meter').map((show) => show.textContent)};
			}
			if (kind === 'tabs') {
				const list = document.querySelector('[data-probe-tablist="' + id + '"]');
				const tabs = [...list.querySelectorAll('[role="tab"]')].filter((tab) => tab.getClientRects().length > 0);
				const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls') || ''));
				return {count: tabs.length, focused: tabs.indexOf(active), selected: tabs.flatMap((tab, i) => tab.getAttribute('aria-selected') === 'true' ? [i] : []), shown: panels.flatMap((panel, i) => panel && !panel.hidden ? [i] : []), rtl: getComputedStyle(list).direction === 'rtl', manual: list.dataset.activation === 'manual'};
			}
			const target = document.getElementById(id);
			const items = kind === 'menu' ? itemsOf(target) : [];
			const focusables = [...target.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => shown(el) && !el.disabled && el.tabIndex >= 0);
			return {
				open: kind === 'dialog' ? target.open : target.matches(':popover-open'),
				onInvoker: active === document.querySelector('[data-probe-invoker="' + id + '"]'),
				inside: target.contains(active),
				leaked: active !== null && active !== document.body && !target.contains(active),
				item: items.indexOf(active),
				items: items.length,
				focusables: focusables.length,
				at: focusables.indexOf(active),
				checked: items.findIndex((item) => item.getAttribute('aria-checked') === 'true'),
				search: target.querySelector('input[role="combobox"]') === null ? null : {active: target.querySelector('input[role="combobox"]').getAttribute('aria-activedescendant')}
			};
		},
		// The middle of the widget's invoker, a point of the viewport.
		invokerPoint(id) {
			const box = document.querySelector('[data-probe-invoker="' + id + '"]').getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		// A point of the viewport outside the open dialog, clear of the edges a scrollbar may take: above it, mid-width.
		outside(id) {
			const box = document.getElementById(id).getBoundingClientRect();
			const width = root.clientWidth;
			if (box.top >= 16) {
				return [Math.round(width / 2), Math.round(box.top / 2)];
			}
			if (box.left >= 32) {
				return [Math.round(box.left / 2), Math.round(innerHeight / 2)];
			}
			return width - box.right >= 32 ? [Math.round((box.right + width) / 2), Math.round(innerHeight / 2)] : null;
		},
		// Two notices by REDZ.ui.toast: where each landed - the live region's role - and whether it shows.
		async notices() {
			if (typeof globalThis.REDZ?.ui?.toast !== 'function') {
				return [];
			}
			const closers = [REDZ.ui.toast({title: 'Probe notice', tone: 'success'}), REDZ.ui.toast({title: 'Probe error', tone: 'danger'})];
			await pause(200);
			const out = [...document.querySelectorAll('.toast')].filter((toast) => toast.textContent.includes('Probe ')).map((toast) => ({tone: toast.classList.contains('toast-danger') ? 'danger' : 'success', role: toast.parentElement?.getAttribute('role') ?? '', shown: shown(toast)}));
			closers.forEach((close) => close());
			return out;
		},
		async popovers() {
			const out = [];
			const tried = new Map();
			for (const invoker of document.querySelectorAll('[commandfor]')) {
				const command = invoker.getAttribute('command') || '';
				const target = document.getElementById(invoker.getAttribute('commandfor') || '');
				if (!target || !['toggle-popover', 'show-popover', 'show-modal'].includes(command) || !shown(invoker) || (tried.get(target) || 0) >= 2) {
					continue;
				}
				tried.set(target, (tried.get(target) || 0) + 1);
				invoker.scrollIntoView({block: 'nearest', inline: 'nearest'});
				await frames();
				invoker.click();
				await pause(350);
				await frames();
				const open = command === 'show-modal' ? target.open : target.matches(':popover-open');
				const r = resting(target);
				const q = invoker.getBoundingClientRect();
				const inside = r.left >= -1 && r.top >= -1 && r.right <= root.clientWidth + 1 && r.bottom <= innerHeight + 1;
				const near = Math.min(Math.abs(r.top - q.bottom), Math.abs(q.top - r.bottom)) <= 12;
				const aligned = Math.abs(r.left - q.left) <= 2 || Math.abs(r.right - q.right) <= 2;
				out.push({
					invoker: name(invoker),
					target: '#' + target.id,
					open,
					inside,
					anchored: !target.classList.contains('menu') || (near && aligned),
					guard: target.dataset.placed === 'script',
					box: [r.left, r.top, r.right, r.bottom].map(Math.round),
					by: [q.left, q.top, q.right, q.bottom].map(Math.round)
				});
				if (command === 'show-modal') {
					target.close();
				} else if (target.matches(':popover-open')) {
					target.hidePopover();
				}
				await pause(250);
			}
			scrollTo(0, 0);
			return out;
		},
		async axe(tags) {
			// A sticky element covers only what scrolls under it, and axe judges one scroll position: it runs with them in place.
			const stuck = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'sticky');
			for (const el of stuck) {
				el.style.setProperty('position', 'static', 'important');
			}
			try {
				const result = await window.axe.run(document, {runOnly: {type: 'tag', values: tags}, resultTypes: ['violations']});
				return result.violations.map((v) => ({id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((node) => node.target.join(' '))}));
			} finally {
				for (const el of stuck) {
					el.style.removeProperty('position');
				}
			}
		}
	};
})();
