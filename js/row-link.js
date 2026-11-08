// REDZ.UI, row links: a table's row or a list group's item whose title link is a stretched-link is a link as a whole.
// A click anywhere on it but on its own controls and their cells (table-check, table-actions) follows the title - with
// Ctrl, Cmd, Shift or the middle button into a new tab - unless the person was selecting its text; the title stays the
// one link a keyboard and a screen reader meet. The row is not the link's positioned box, as WebKit gives a positioned
// row no absolutely positioned children (its bug 240961), and an item draws no cover, so its words can be selected.
const CONTROLS = 'a[href], button, input, select, textarea, label, summary, [tabindex], [contenteditable], [role="button"], [role="link"], .table-check, .table-actions';

/** The title link the event's row follows, or null when the event is on a control, or on no such row. */
const linkOf = (event) => {
	const at = event.target instanceof Element ? event.target : null;
	const row = at?.closest('.table tr, .list-group-item') ?? null;
	const link = row?.querySelector('.stretched-link[href]') ?? null;
	if (link === null || row.contains(at.closest(CONTROLS)) || (getSelection()?.toString() ?? '') !== '') {
		return null;
	}
	return link;
};

document.addEventListener('click', (event) => {
	const link = event.button === 0 ? linkOf(event) : null;
	if (link === null) {
		return;
	}
	if (event.ctrlKey || event.metaKey || event.shiftKey) {
		open(link.href, '_blank', 'noopener');
	} else {
		link.click();
	}
});

document.addEventListener('mousedown', (event) => {
	if (event.button === 1 && linkOf(event) !== null) {
		event.preventDefault();
	}
});

document.addEventListener('auxclick', (event) => {
	const link = event.button === 1 ? linkOf(event) : null;
	if (link !== null) {
		event.preventDefault();
		open(link.href, '_blank', 'noopener');
	}
});
