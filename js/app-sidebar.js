// REDZ.UI, the side navigation's groups and its scroll. A group is <details class="app-group"> whose <summary> is its
// app-section: the server prints it open or closed as the person left it, the library opens the one that holds the
// aria-current="page" link as the page loads, and a person's open or close is told in redz:group (detail.open) on the
// group, which the page keeps - the library's own opening is not told, and it stores nothing. Folded to a rail above
// 1024 px, every group of the sidebar opens, as their icons are the way in, and the ones the rail opened close as it
// unfolds. data-scroll on the app-sidebar places it as the page loads and as its panel opens: keep - where this tab
// left it, in sessionStorage, the top when the storage is empty or refuses; current - the current link brought into
// view; without it, the top.
const WIDE = matchMedia('(width >= 64rem)');
const KEY = 'redz-ui.sidebar.';
const asked = new WeakMap();
const spread = new WeakSet();
const seen = new WeakMap();

/** Opens or closes the group as the library's own change, which redz:group does not tell. */
const turn = (group, open) => {
	asked.delete(group);
	group.open = open;
};

/** Opens every group of the sidebar while it is a rail, and closes again the ones the rail opened once it is not. */
const fit = (sidebar) => {
	const rail = WIDE.matches && sidebar.hasAttribute('data-folded');
	for (const group of sidebar.querySelectorAll('details.app-group')) {
		if (rail && !group.open) {
			spread.add(group);
			turn(group, true);
		} else if (!rail && spread.delete(group)) {
			turn(group, false);
		}
	}
};

/** The storage key of the sidebar's kept scroll. */
const keyOf = (sidebar) => KEY + (sidebar.id || 'app-sidebar');

/** Places the shown sidebar as its data-scroll says. */
const place = (sidebar) => {
	if (sidebar.getClientRects().length === 0) {
		return;
	}
	if (sidebar.dataset.scroll === 'keep') {
		sidebar.scrollTop = seen.get(sidebar) ?? 0;
		return;
	}
	const link = sidebar.dataset.scroll === 'current' ? sidebar.querySelector('.app-link[aria-current="page"]') : null;
	if (link !== null) {
		const box = sidebar.getBoundingClientRect();
		const row = link.getBoundingClientRect();
		sidebar.scrollTop += row.top < box.top ? row.top - box.top : Math.max(0, row.bottom - box.bottom);
	}
};

document.addEventListener('click', (event) => {
	const summary = event.target instanceof Element ? event.target.closest('summary') : null;
	const group = summary?.parentElement;
	if (group instanceof HTMLDetailsElement && group.matches('.app-group') && group.querySelector(':scope > summary') === summary) {
		asked.set(group, group.open);
	}
});

document.addEventListener('toggle', (event) => {
	const group = event.target;
	if (!(group instanceof HTMLDetailsElement) || !asked.has(group)) {
		return;
	}
	const was = asked.get(group);
	asked.delete(group);
	if (group.open !== was) {
		group.dispatchEvent(new CustomEvent('redz:group', {bubbles: true, detail: {open: group.open}}));
	}
}, true);

for (const link of document.querySelectorAll('details.app-group .app-link[aria-current="page"]')) {
	const group = link.closest('details.app-group');
	if (!group.open) {
		turn(group, true);
	}
}

for (const sidebar of document.querySelectorAll('.app-sidebar')) {
	fit(sidebar);
	if (sidebar.dataset.scroll === 'keep') {
		try {
			seen.set(sidebar, Number(sessionStorage.getItem(keyOf(sidebar))) || 0);
		} catch {
			seen.set(sidebar, 0);
		}
	}
	place(sidebar);
	sidebar.addEventListener('scroll', () => seen.set(sidebar, sidebar.scrollTop), {passive: true});
	sidebar.addEventListener('toggle', (event) => {
		if (event.target === sidebar && event.newState === 'open') {
			place(sidebar);
		}
	});
}

addEventListener('pagehide', () => {
	for (const sidebar of document.querySelectorAll('.app-sidebar[data-scroll="keep"]')) {
		try {
			sessionStorage.setItem(keyOf(sidebar), String(Math.round(seen.get(sidebar) ?? 0)));
		} catch {
		}
	}
});

WIDE.addEventListener('change', () => document.querySelectorAll('.app-sidebar').forEach(fit));

new MutationObserver((records) => {
	for (const record of records) {
		if (record.target instanceof HTMLElement && record.target.classList.contains('app-sidebar')) {
			fit(record.target);
		}
	}
}).observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['data-folded']});
