// REDZ.UI, navbars: below its width a navbar's toggler opens the links as a popover panel by the browser's commands.
// The panel closes when a link in it is followed (a link to a part of the same page leaves no panel over it), when the
// focus leaves it for the page, and when the navbar grows wide enough to hold the links in its row again.
const OPEN = '.navbar .drawer:popover-open';
let frame = 0;

document.addEventListener('click', (event) => {
	const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
	if (link !== null && event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
		link.closest(OPEN)?.hidePopover();
	}
});

document.addEventListener('focusout', (event) => {
	const panel = event.target instanceof Element ? event.target.closest(OPEN) : null;
	const to = event.relatedTarget;
	if (panel !== null && to instanceof Element && !panel.contains(to) && to.getAttribute('commandfor') !== panel.id) {
		panel.hidePopover();
	}
});

addEventListener('resize', () => {
	frame ||= requestAnimationFrame(() => {
		frame = 0;
		for (const panel of document.querySelectorAll(OPEN)) {
			const toggler = panel.closest('.navbar')?.querySelector('.navbar-toggler') ?? null;
			if (toggler !== null && toggler.getClientRects().length === 0) {
				panel.hidePopover();
			}
		}
	});
});
