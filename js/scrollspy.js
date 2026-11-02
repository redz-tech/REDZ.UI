// REDZ.UI, scrollspy: in a nav or list with data-scrollspy, the link to the section in view says so in
// aria-current="location" — the last section whose top has passed a quarter of the scrolling area's height, or the
// last section once the area is scrolled to its end. The links name their sections by href="#id".
let frame = 0;

/** The element that scrolls the section: its nearest ancestor with overflow, else the page. */
const scrollerOf = (section) => {
	for (let box = section.parentElement; box !== null && box !== document.body; box = box.parentElement) {
		const overflow = getComputedStyle(box).overflowY;
		if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
			return box;
		}
	}
	return document.scrollingElement ?? document.documentElement;
};

/** The section a link names: by its fragment as written, else percent-decoded — as the browser finds it. */
const sectionOf = (link) => {
	const id = link.getAttribute('href').slice(1);
	try {
		return document.getElementById(id) ?? document.getElementById(decodeURIComponent(id));
	} catch {
		return null;
	}
};

/** Marks the link of the nav's section in view, and only it. */
const mark = (nav) => {
	const pairs = [...nav.querySelectorAll('a[href^="#"]')].map((link) => [link, sectionOf(link)]).filter(([, section]) => section !== null);
	if (pairs.length === 0) {
		return;
	}
	const scroller = scrollerOf(pairs[0][1]);
	const page = scroller === document.scrollingElement || scroller === document.documentElement;
	const top = page ? 0 : scroller.getBoundingClientRect().top;
	const height = page ? innerHeight : scroller.clientHeight;
	const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
	let current = pairs[0][0];
	for (const [link, section] of pairs) {
		if (atEnd || section.getBoundingClientRect().top - top <= height / 4) {
			current = link;
		}
	}
	for (const [link] of pairs) {
		if (link === current) {
			link.setAttribute('aria-current', 'location');
		} else {
			link.removeAttribute('aria-current');
		}
	}
};

/** Marks every scrollspy nav in the next frame. */
const schedule = () => {
	if (frame === 0) {
		frame = requestAnimationFrame(() => {
			frame = 0;
			document.querySelectorAll('[data-scrollspy]').forEach(mark);
		});
	}
};

schedule();
addEventListener('scroll', schedule, {capture: true, passive: true});
addEventListener('resize', schedule, {passive: true});
