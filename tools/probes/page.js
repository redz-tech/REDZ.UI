// REDZ.UI probes, the page part: the detectors a probe runs in a loaded page of any engine; every call answers plain data.
window.REDZ_PROBE = (() => {
	const root = document.documentElement;
	const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
	const pause = (ms) => new Promise((done) => setTimeout(done, ms));
	const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
	const closed = (el) => el.closest('[popover]:not(:popover-open), dialog:not([open])') !== null;
	const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !closed(el);
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
				cut: cut.slice(0, 8)
			};
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
				const r = target.getBoundingClientRect();
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
