// REDZ.UI, tooltips from titles: inside an element with data-tooltips (<html> for the whole page) an element's own
// title shows as the library's tooltip - after a short hover by a mouse or a pen, at once on a keyboard's focus, but not
// when the focus comes back from a closed layer - and hides when the pointer or the focus leaves, on Escape, on a scroll
// or a click. The pointer may rest on the tooltip itself. While hovered, the title is held back so the browser does not
// show its own as well; an element whose only
// name was its title is named by it meanwhile. The tooltip is hidden from screen readers: they say the title already.
// A touch has no hover: a tap on a control that cannot run (aria-disabled) shows its title for three seconds and says it.
import {announce} from './say.js';

const DELAY = 400;
const TAPPED = 3000;
let tip = null;
let shown = null;
let pending = null;
let timer = 0;
const held = new WeakMap();

/** The element whose title the node shows, inside data-tooltips; null when none. An iframe's title is its name. */
const ownerOf = (node) => {
	for (let one = node instanceof Element ? node : null; one !== null; one = one.parentElement) {
		if (one.hasAttribute('title') || held.has(one)) {
			return one.localName !== 'iframe' && one.closest('[data-tooltips]') !== null && !(tip?.contains(one) ?? false) ? one : null;
		}
	}
	return null;
};

/** The one tooltip of the page, made at its first use. */
const tooltip = () => {
	if (tip === null) {
		tip = Object.assign(document.createElement('div'), {className: 'tooltip', id: 'redz-tooltip'});
		tip.popover = 'manual';
		tip.setAttribute('role', 'tooltip');
		tip.setAttribute('aria-hidden', 'true');
		tip.addEventListener('pointerleave', (event) => {
			if (shown !== null && !shown.contains(event.relatedTarget)) {
				hide();
			}
		});
	}
	if (!tip.isConnected) {
		document.body.append(tip);
	}
	return tip;
};

/** Takes the title off while the pointer is on the element, naming it by the title when that was its only name. */
const hold = (owner) => {
	const title = owner.getAttribute('title');
	if (title === null || held.has(owner)) {
		return;
	}
	const named = owner.hasAttribute('aria-label') || owner.hasAttribute('aria-labelledby') || owner.textContent.trim() !== '';
	held.set(owner, {title, named});
	owner.removeAttribute('title');
	if (!named) {
		owner.setAttribute('aria-label', title);
	}
};

/** Gives the element its title back. */
const release = (owner) => {
	const was = held.get(owner);
	if (was === undefined) {
		return;
	}
	held.delete(owner);
	owner.setAttribute('title', was.title);
	if (!was.named) {
		owner.removeAttribute('aria-label');
	}
};

/** Shows the tooltip above the element, or below where there is no room, its start edge on the element's. */
const show = (owner) => {
	const words = (held.get(owner)?.title ?? owner.getAttribute('title') ?? '').trim();
	pending = null;
	if (words === '') {
		return;
	}
	const one = tooltip();
	one.textContent = words;
	if (!one.matches(':popover-open')) {
		one.showPopover();
	}
	one.style.margin = '0';
	shown = owner;
	const box = owner.getBoundingClientRect();
	const rtl = getComputedStyle(owner).direction === 'rtl';
	const width = one.offsetWidth;
	const height = one.offsetHeight;
	one.style.top = (box.top - height - 6 >= 4 ? box.top - height - 6 : box.bottom + 6) + 'px';
	one.style.left = Math.min(Math.max(4, rtl ? box.right - width : box.left), document.documentElement.clientWidth - width - 4) + 'px';
};

/** Hides the tooltip, stops a wait for one, and gives the titles back. */
const hide = () => {
	clearTimeout(timer);
	for (const owner of [shown, pending]) {
		if (owner !== null) {
			release(owner);
		}
	}
	shown = null;
	pending = null;
	if (tip?.matches(':popover-open')) {
		tip.hidePopover();
	}
};

document.addEventListener('pointerover', (event) => {
	const owner = event.pointerType === 'touch' ? null : ownerOf(event.target);
	if (owner === null || owner === shown || owner === pending) {
		return;
	}
	hide();
	hold(owner);
	pending = owner;
	timer = setTimeout(() => show(owner), DELAY);
});

document.addEventListener('pointerup', (event) => {
	const owner = event.pointerType === 'touch' ? ownerOf(event.target) : null;
	if (owner === null || !owner.matches('[aria-disabled="true"]')) {
		return;
	}
	hide();
	show(owner);
	announce(owner.getAttribute('title') ?? '');
	timer = setTimeout(hide, TAPPED);
});

document.addEventListener('pointerout', (event) => {
	const owner = event.pointerType === 'touch' ? null : ownerOf(event.target);
	const into = event.relatedTarget;
	if (owner !== null && (owner === shown || owner === pending) && !owner.contains(into) && !(tip?.contains(into) ?? false)) {
		hide();
	}
});

/** Whether the focus left a popover or a dialog that has just closed: it came back to the element that opened it. */
const cameBack = (event) => event.relatedTarget instanceof Element && event.relatedTarget.closest('[popover]:not(:popover-open), dialog:not([open])') !== null;

document.addEventListener('focusin', (event) => {
	const owner = ownerOf(event.target);
	if (owner !== null && owner === event.target && owner.matches(':focus-visible') && !cameBack(event)) {
		hide();
		show(owner);
	}
});

document.addEventListener('focusout', (event) => {
	if (shown !== null && event.target === shown) {
		hide();
	}
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && shown !== null) {
		if (shown.closest('[role="menu"]') === null) {
			event.preventDefault();
		}
		hide();
	}
}, true);

document.addEventListener('pointerdown', hide, true);
addEventListener('scroll', hide, true);
addEventListener('resize', hide);
