// REDZ.UI probes, the page part: the detectors a probe runs in a loaded page of any engine; every call answers plain data.
window.REDZ_PROBE = (() => {
	const root = document.documentElement;
	const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
	const pause = (ms) => new Promise((done) => setTimeout(done, ms));
	const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
	const closed = (el) => el.closest('[popover]:not(:popover-open), dialog:not([open])') !== null;
	// The box an opened layer rests in, without the scale or move of its opening transition — a slow engine may not have
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
	// The page's own errors from here on — an engine whose driver brings no events (Safari) shows them only this way.
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
			await document.fonts.ready;
			await frames();
			still.remove();
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
				if (shown(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
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
				ui: typeof globalThis.REDZ?.ui?.toast === 'function'
			};
		},
		// The docs' state mirror: each copy (data-docs-state) and its twin at rest — the element of the same tag and
		// classes in the first cell of its row of the grid — kept by number, as one twin stands for several copies.
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
		// The twin brought into view: the point of its middle. For a focus, a button put just before it takes the focus,
		// so that the next Tab — a real key — gives it to the twin.
		async rest(i, focus) {
			const [twin] = mirrored[i];
			twin.scrollIntoView({block: 'center', inline: 'center'});
			if (focus) {
				const before = Object.assign(document.createElement('button'), {type: 'button', textContent: 'probe'});
				before.dataset.probeBefore = '';
				twin.before(before);
				before.focus();
			}
			await frames();
			const box = twin.getBoundingClientRect();
			return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
		},
		// The differences between the twin in its real state and the copy, the element and its first descendants, read
		// with transitions off; then the focus helper goes.
		compare(i) {
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
			return errors.splice(0);
		},
		// The widgets a keyboard walk tries: each menu and modal dialog by its first shown invoker, each tab list.
		keyTargets() {
			const out = [];
			const seen = new Set();
			for (const invoker of document.querySelectorAll('[commandfor]')) {
				const target = document.getElementById(invoker.getAttribute('commandfor') || '');
				const command = invoker.getAttribute('command') || '';
				const kind = target?.getAttribute('role') === 'menu' && command === 'toggle-popover' ? 'menu' : (target?.localName === 'dialog' && command === 'show-modal' ? 'dialog' : '');
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
			return out;
		},
		focus(kind, id) {
			const el = kind === 'tabs' ? document.querySelector('[data-probe-tablist="' + id + '"] [role="tab"][aria-selected="true"]') : document.querySelector('[data-probe-invoker="' + id + '"]');
			el.scrollIntoView({block: 'nearest'});
			el.focus();
			return document.activeElement === el;
		},
		state(kind, id) {
			const active = document.activeElement;
			if (kind === 'tabs') {
				const list = document.querySelector('[data-probe-tablist="' + id + '"]');
				const tabs = [...list.querySelectorAll('[role="tab"]')];
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
				checked: items.findIndex((item) => item.getAttribute('aria-checked') === 'true')
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
		// Two notices by REDZ.ui.toast: where each landed — the live region's role — and whether it shows.
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
