// REDZ.UI, menus: places an opened menu beside its button wherever the browser cannot anchor it (Firefox before 147,
// Safari before 26) or anchors it out of view or away from its button (Chrome 135–136 in a table cell, Safari 26 at the
// bottom of a page taller than the viewport); such a menu carries data-placed="script" while it is open.
const anchors = CSS.supports('position-area', 'block-end');
const overrides = ['position-area', 'position-try-fallbacks', 'inset', 'top', 'left', 'margin'];
const open = new Map();
let invoker = null;
let frame = 0;

/** The button that opened the menu: the last one clicked, when it names the menu. */
const buttonOf = (menu) => invoker !== null && (invoker.getAttribute('commandfor') === menu.id || invoker.popoverTargetElement === menu) ? invoker : null;

/** The menu's border box without the scale of its opening transition: that grows from the middle of the top edge, which
 *  it leaves in place — engines differ in whether the box and the computed scale show the transition yet. */
const boxOf = (menu) => {
	const box = menu.getBoundingClientRect();
	return {left: box.left + (box.width - menu.offsetWidth) / 2, top: box.top, width: menu.offsetWidth, height: menu.offsetHeight};
};

/** Whether the engine put the menu inside the viewport, just above or below the button, an inline edge on the button's. */
const wellPlaced = (menu, button) => {
	const m = boxOf(menu);
	const b = button.getBoundingClientRect();
	const inside = m.left >= -1 && m.top >= -1 && m.left + m.width <= document.documentElement.clientWidth + 1 && m.top + m.height <= innerHeight + 1;
	const near = Math.min(Math.abs(m.top - b.bottom), Math.abs(b.top - m.top - m.height)) <= 12;
	const aligned = Math.abs(m.left - b.left) <= 2 || Math.abs(m.left + m.width - b.right) <= 2;
	return inside && near && aligned;
};

/** Places the menu by script: below the button, or above when only there it fits; its inline end edge on the button's
 *  (its start edge for .menu-start), the other edge when that one leaves the viewport; always inside the viewport. It is
 *  measured in the viewport's corner first — its width depends on the room where it stands. */
const place = (menu, button) => {
	const style = getComputedStyle(menu);
	const gap = parseFloat(style.marginBlockStart) || 0;
	const end = menu.classList.contains('menu-start') === (style.direction === 'rtl');
	for (const [property, value] of [['position-area', 'none'], ['position-try-fallbacks', 'none'], ['inset', 'auto'], ['top', '0px'], ['left', '0px'], ['margin', '0']]) {
		menu.style.setProperty(property, value);
	}
	const width = menu.offsetWidth;
	const height = menu.offsetHeight;
	const b = button.getBoundingClientRect();
	const room = document.documentElement.clientWidth;
	let top = b.bottom + gap;
	if (top + height > innerHeight && b.top - gap - height >= 0) {
		top = b.top - gap - height;
	}
	let left = end ? b.right - width : b.left;
	if (left < 0 || left + width > room) {
		left = end ? b.left : b.right - width;
	}
	menu.style.setProperty('top', Math.max(0, Math.min(top, innerHeight - height)) + 'px');
	menu.style.setProperty('left', Math.max(0, Math.min(left, room - width)) + 'px');
	menu.dataset.placed = 'script';
};

/** Checks every open menu and places by script the ones the engine did not put beside their button. */
const watch = () => {
	frame = 0;
	for (const [menu, button] of open) {
		if (!anchors || menu.dataset.placed === 'script' || !wellPlaced(menu, button)) {
			place(menu, button);
		}
	}
};

/** Runs the check in the next frame, before it is painted. */
const schedule = () => {
	if (frame === 0 && open.size > 0) {
		frame = requestAnimationFrame(watch);
	}
};

document.addEventListener('click', (event) => {
	invoker = event.target instanceof Element ? event.target.closest('button[commandfor], button[popovertarget]') : null;
}, true);

document.addEventListener('beforetoggle', (event) => {
	const menu = event.target;
	if (!(menu instanceof HTMLElement) || !menu.classList.contains('menu')) {
		return;
	}
	if (event.newState !== 'open') {
		open.delete(menu);
		return;
	}
	for (const property of overrides) {
		menu.style.removeProperty(property);
	}
	delete menu.dataset.placed;
	const button = buttonOf(menu);
	if (button !== null) {
		open.set(menu, button);
		schedule();
	}
}, true);

addEventListener('scroll', schedule, {capture: true, passive: true});
addEventListener('resize', schedule, {passive: true});
