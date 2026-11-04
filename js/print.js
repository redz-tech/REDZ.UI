// REDZ.UI, print: a button with command="--print" prints the page. However printing starts, every closed details - an
// accordion's item, one of a group too - and every region a --toggle button holds closed open for the paper, and close
// again after.
const opened = [];

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--print"]') : null;
	if (button !== null && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
		print();
	}
});

addEventListener('beforeprint', () => {
	for (const details of document.querySelectorAll('details:not([open])')) {
		opened.push([details, details.getAttribute('name')]);
		details.removeAttribute('name');
		details.open = true;
	}
	for (const button of document.querySelectorAll('button[command="--toggle"][aria-expanded="false"][aria-controls]')) {
		const region = document.getElementById(button.getAttribute('aria-controls').trim().split(/\s+/)[0]);
		if (region?.hidden && !opened.some(([held]) => held === region)) {
			opened.push([region, region.getAttribute('hidden')]);
			region.hidden = false;
		}
	}
});

addEventListener('afterprint', () => {
	for (const [element, kept] of opened.splice(0)) {
		if (element.localName === 'details') {
			element.open = false;
			if (kept !== null) {
				element.setAttribute('name', kept);
			}
		} else {
			element.setAttribute('hidden', kept);
		}
	}
});
