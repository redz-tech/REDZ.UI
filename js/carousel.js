// REDZ.UI, carousels (the WAI-ARIA carousel pattern on a scroll-snap row): the slides of a .carousel-inner scroll and
// snap by the browser - a swipe, a wheel, the keys of a focused row; buttons with command="--prev" or "--next" and
// aria-controls naming the .carousel move a slide back or on, round the ends; the slide in place is aria-current="true",
// and an empty .carousel-indicators fills with a button per slide. Each slide is a group named by the page's text
// "slide" ({position} of {count}). A carousel-fade stacks its slides and shows the current one. A button with
// command="--play" plays the slides on every 5 seconds while it is aria-pressed="true" - never for a person who asks for
// less motion, and paused while the pointer rests on the carousel, the focus is in it or the page is hidden. A slide a
// person moves to is told politely in a status of the carousel, never while it plays. Like --toggle, the buttons have
// no commandfor: WebKit would expose them as collapsed.
import {text} from './text.js';

const COMMANDS = ['--prev', '--next', '--play'];
const DELAY = 5000;
const state = new WeakMap();
const still = matchMedia('(prefers-reduced-motion: reduce)');

const innerOf = (carousel) => carousel.querySelector(':scope > .carousel-inner');
const itemsOf = (carousel) => [...(innerOf(carousel)?.children ?? [])].filter((item) => item.classList.contains('carousel-item'));
const playOf = (carousel) => document.querySelector('button[command="--play"][aria-controls~="' + CSS.escape(carousel.id) + '"]');

/** The carousel a button names in aria-controls, or null. */
const carouselOf = (button) => {
	const target = document.getElementById((button.getAttribute('aria-controls') || '').trim().split(/\s+/)[0]);
	return target !== null && target.classList.contains('carousel') ? target : null;
};

/** The index of the slide in place: the current one in a fade, else the one nearest its snap point in the row. */
const placed = (carousel) => {
	const items = itemsOf(carousel);
	const inner = innerOf(carousel);
	if (carousel.classList.contains('carousel-fade') || inner === null) {
		return Math.max(0, items.findIndex((item) => item.getAttribute('aria-current') === 'true'));
	}
	const box = inner.getBoundingClientRect();
	const centered = carousel.classList.contains('carousel-center');
	const rtl = getComputedStyle(inner).direction === 'rtl';
	const peek = parseFloat(getComputedStyle(inner).paddingInlineStart) || 0;
	const point = centered ? box.left + box.width / 2 : (rtl ? box.right - peek : box.left + peek);
	let best = 0;
	let gap = Infinity;
	items.forEach((item, i) => {
		const one = item.getBoundingClientRect();
		const edge = centered ? one.left + one.width / 2 : (rtl ? one.right : one.left);
		if (Math.abs(edge - point) < gap) {
			gap = Math.abs(edge - point);
			best = i;
		}
	});
	return best;
};

/** Marks the slide at index and its indicator current. */
const mark = (carousel, index) => {
	for (const list of [itemsOf(carousel), [...carousel.querySelectorAll(':scope .carousel-indicators > button')]]) {
		list.forEach((one, i) => {
			if (i === index) {
				one.setAttribute('aria-current', 'true');
			} else {
				one.removeAttribute('aria-current');
			}
		});
	}
};

/** Moves the carousel to the slide at index, round the ends. */
const go = (carousel, index) => {
	const items = itemsOf(carousel);
	const inner = innerOf(carousel);
	if (items.length === 0 || inner === null) {
		return;
	}
	const to = (index % items.length + items.length) % items.length;
	mark(carousel, to);
	if (!playing(carousel)) {
		state.get(carousel).told.textContent = items[to].getAttribute('aria-label') || text('slide', {position: to + 1, count: items.length});
	}
	if (!carousel.classList.contains('carousel-fade')) {
		const box = inner.getBoundingClientRect();
		const one = items[to].getBoundingClientRect();
		const peek = parseFloat(getComputedStyle(inner).paddingInlineStart) || 0;
		const rtl = getComputedStyle(inner).direction === 'rtl';
		const left = carousel.classList.contains('carousel-center') ? one.left + one.width / 2 - box.left - box.width / 2 : (rtl ? one.right - box.right + peek : one.left - box.left - peek);
		inner.scrollBy({left, behavior: still.matches ? 'instant' : 'smooth'});
	}
};

/** Whether the carousel plays now: its play button pressed, and nothing holding it. */
const playing = (carousel) => playOf(carousel)?.getAttribute('aria-pressed') === 'true' && !still.matches;

/** Starts or stops the carousel's turn by what holds it. */
const pace = (carousel) => {
	const own = state.get(carousel);
	const held = own.hover || own.focus || document.hidden;
	clearInterval(own.timer);
	own.timer = 0;
	if (playing(carousel) && !held) {
		own.timer = setInterval(() => go(carousel, placed(carousel) + 1), DELAY);
	}
};

/** Takes up the carousel once: the slides named, the indicators made, the watch on its scroll, the pointer and the focus. */
const setUp = (carousel) => {
	const items = itemsOf(carousel);
	const inner = innerOf(carousel);
	if (state.has(carousel) || inner === null) {
		return;
	}
	const told = Object.assign(document.createElement('div'), {className: 'visually-hidden'});
	told.setAttribute('role', 'status');
	carousel.append(told);
	state.set(carousel, {timer: 0, hover: false, focus: false, frame: 0, told});
	items.forEach((item, i) => {
		item.setAttribute('role', 'group');
		if (!item.hasAttribute('aria-label') && !item.hasAttribute('aria-labelledby')) {
			item.setAttribute('aria-label', text('slide', {position: i + 1, count: items.length}));
		}
	});
	const indicators = carousel.querySelector(':scope .carousel-indicators');
	if (indicators !== null && indicators.children.length === 0) {
		indicators.append(...items.map((item, i) => {
			const button = Object.assign(document.createElement('button'), {type: 'button'});
			button.setAttribute('aria-label', text('slide', {position: i + 1, count: items.length}));
			return button;
		}));
	}
	indicators?.addEventListener('click', (event) => {
		const button = event.target instanceof Element ? event.target.closest('button') : null;
		const at = button === null ? -1 : [...indicators.children].indexOf(button);
		if (at !== -1) {
			go(carousel, at);
		}
	});
	const play = playOf(carousel);
	if (play !== null && still.matches) {
		play.setAttribute('aria-pressed', 'false');
	}
	mark(carousel, Math.max(0, items.findIndex((item) => item.getAttribute('aria-current') === 'true')));
	if (!carousel.classList.contains('carousel-fade')) {
		inner.addEventListener('scroll', () => {
			const own = state.get(carousel);
			own.frame ||= requestAnimationFrame(() => {
				own.frame = 0;
				mark(carousel, placed(carousel));
			});
		}, {passive: true});
	} else {
		inner.addEventListener('keydown', (event) => {
			const rtl = getComputedStyle(inner).direction === 'rtl';
			const step = {ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1}[event.key];
			if (step !== undefined && !event.altKey && !event.ctrlKey && !event.metaKey) {
				event.preventDefault();
				go(carousel, placed(carousel) + step);
			}
		});
	}
	carousel.addEventListener('pointerenter', () => {
		state.get(carousel).hover = true;
		pace(carousel);
	});
	carousel.addEventListener('pointerleave', () => {
		state.get(carousel).hover = false;
		pace(carousel);
	});
	carousel.addEventListener('focusin', () => {
		state.get(carousel).focus = true;
		pace(carousel);
	});
	carousel.addEventListener('focusout', (event) => {
		if (!carousel.contains(event.relatedTarget)) {
			state.get(carousel).focus = false;
			pace(carousel);
		}
	});
	pace(carousel);
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command][aria-controls]') : null;
	const command = button?.getAttribute('command') ?? '';
	const carousel = COMMANDS.includes(command) && !button.disabled && !button.hasAttribute('commandfor') ? carouselOf(button) : null;
	if (carousel === null || event.defaultPrevented) {
		return;
	}
	setUp(carousel);
	if (command === '--play') {
		button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
	} else {
		go(carousel, placed(carousel) + (command === '--next' ? 1 : -1));
	}
	pace(carousel);
});

document.addEventListener('visibilitychange', () => {
	for (const carousel of document.querySelectorAll('.carousel')) {
		if (state.has(carousel)) {
			pace(carousel);
		}
	}
});

document.querySelectorAll('.carousel').forEach(setUp);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches('.carousel') ? [node] : []).concat([...node.querySelectorAll('.carousel')]).forEach(setUp);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true});
