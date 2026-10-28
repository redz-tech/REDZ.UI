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
	const itemsOf = (menu) => [...menu.querySelectorAll('[role^="menuitem"]')].filter((item) => item.getClientRects().length > 0 && item.getAttribute('aria-disabled') !== 'true');
	const clipped = (el) => {
		for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
			if (getComputedStyle(a).overflowX !== 'visible') {
				return true;
			}
		}
		return false;
	};
	return {
		async prepare(theme, dir) {
			root.setAttribute('data-probe', '');
			root.setAttribute('data-theme', theme);
			root.dir = dir;
			await document.fonts.ready;
			await frames();
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
				if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !clipped(el) && !offenders.some((o) => o.contains(el))) {
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
				ui: typeof globalThis.REDZ?.ui?.toast === 'function'
			};
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
				return {count: tabs.length, focused: tabs.indexOf(active), selected: tabs.flatMap((tab, i) => tab.getAttribute('aria-selected') === 'true' ? [i] : []), shown: panels.flatMap((panel, i) => panel && !panel.hidden ? [i] : []), rtl: getComputedStyle(list).direction === 'rtl'};
			}
			const target = document.getElementById(id);
			const items = kind === 'menu' ? itemsOf(target) : [];
			return {
				open: kind === 'dialog' ? target.open : target.matches(':popover-open'),
				onInvoker: active === document.querySelector('[data-probe-invoker="' + id + '"]'),
				inside: target.contains(active),
				leaked: active !== null && active !== document.body && !target.contains(active),
				item: items.indexOf(active),
				items: items.length,
				focusables: [...target.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => shown(el) && !el.disabled && el.tabIndex >= 0).length,
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
			return box.top >= 16 ? [Math.round(innerWidth / 2), Math.round(box.top / 2)] : null;
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
