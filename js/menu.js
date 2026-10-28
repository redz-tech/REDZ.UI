// REDZ.UI, menus by keyboard (the WAI-ARIA menu button): an opened menu takes the focus on its checked or first item;
// the arrow keys move it, wrapping, Home and End go to the ends and a letter to the next item it starts; Tab closes
// the menu and goes on from its button, Escape closes it back to the button (the browser's own), an item chosen closes
// it. On a closed menu's button the down and up arrows open it on the first or the last item.
const ITEM = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
let from = 'first';

/** The items of the menu a keyboard can reach: shown and not disabled. */
const itemsOf = (menu) => [...menu.querySelectorAll(ITEM)].filter((item) => item.getClientRects().length > 0 && item.getAttribute('aria-disabled') !== 'true' && !item.disabled);

/** The menu the button opens, when it is one. */
const menuOf = (button) => {
	const menu = document.getElementById(button.getAttribute('commandfor') || button.getAttribute('popovertarget') || '');
	return menu !== null && menu.getAttribute('role') === 'menu' ? menu : null;
};

document.addEventListener('toggle', (event) => {
	const menu = event.target;
	if (event.newState !== 'open' || !(menu instanceof HTMLElement) || menu.getAttribute('role') !== 'menu') {
		return;
	}
	const items = itemsOf(menu);
	const checked = items.find((item) => item.getAttribute('aria-checked') === 'true');
	(from === 'last' ? items.at(-1) : checked ?? items[0])?.focus();
	from = 'first';
}, true);

document.addEventListener('keydown', (event) => {
	if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) {
		return;
	}
	const button = event.target.closest('button[commandfor], button[popovertarget]');
	const closed = button === null ? null : menuOf(button);
	if (closed !== null && !closed.matches(':popover-open') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
		event.preventDefault();
		from = event.key === 'ArrowUp' ? 'last' : 'first';
		button.click();
		return;
	}
	const menu = event.target.closest('[role="menu"]');
	if (menu === null || !event.target.matches(ITEM)) {
		return;
	}
	const items = itemsOf(menu);
	const at = items.indexOf(event.target);
	let to = null;
	if (event.key === 'ArrowDown') {
		to = items[(at + 1) % items.length];
	} else if (event.key === 'ArrowUp') {
		to = items[(at - 1 + items.length) % items.length];
	} else if (event.key === 'Home') {
		to = items[0];
	} else if (event.key === 'End') {
		to = items.at(-1);
	} else if (event.key === 'Tab') {
		menu.hidePopover();
		return;
	} else if (event.key.length === 1 && event.key !== ' ') {
		const letter = event.key.toLocaleLowerCase();
		to = [...items.slice(at + 1), ...items.slice(0, at + 1)].find((item) => item.textContent.trim().toLocaleLowerCase().startsWith(letter)) ?? null;
	}
	if (to !== null) {
		event.preventDefault();
		to.focus();
	}
}, true);

document.addEventListener('click', (event) => {
	const item = event.target instanceof Element ? event.target.closest(ITEM) : null;
	const menu = item?.closest('[role="menu"]');
	if (menu?.matches(':popover-open') && item.getAttribute('aria-disabled') !== 'true') {
		menu.hidePopover();
	}
});
