// REDZ.UI, the image viewer: a link with data-zoom opens the image its href names in one modal dialog the library makes
// on first need - in the top layer, so above an open dialog too. The links whose data-zoom holds the same word make a
// set, in the page's order: the arrow keys (mirrored right to left) and the viewer's buttons step through it, wrapping,
// and the count says where it is - the page's texts viewer.prev, viewer.next and viewer.count, close for its ×. The
// caption is the link's title, or its image's alt; Escape, × and a click beside the image close it, and the focus goes
// back to the link.
import {text} from './text.js';

let viewer = null;
let links = [];
let at = 0;

/** A button of the viewer, its icon and its words. */
const button = (name, icon, words) => {
	const made = Object.assign(document.createElement('button'), {className: 'btn btn-icon viewer-' + name, type: 'button'});
	made.setAttribute('aria-label', words);
	const glyph = Object.assign(document.createElement('i'), {className: 'bi bi-' + icon});
	glyph.setAttribute('aria-hidden', 'true');
	made.append(glyph);
	return made;
};

/** The viewer, made on first need. */
const make = () => {
	viewer = Object.assign(document.createElement('dialog'), {className: 'viewer'});
	viewer.setAttribute('aria-labelledby', 'redz-viewer-caption');
	const close = button('close', 'x-lg', text('close'));
	const previous = button('prev', 'chevron-left flip-rtl', text('viewer.prev'));
	const next = button('next', 'chevron-right flip-rtl', text('viewer.next'));
	const figure = Object.assign(document.createElement('figure'), {className: 'viewer-figure'});
	const caption = Object.assign(document.createElement('figcaption'), {className: 'viewer-caption', id: 'redz-viewer-caption'});
	caption.setAttribute('aria-live', 'polite');
	figure.append(Object.assign(document.createElement('img'), {className: 'viewer-image', alt: ''}), caption);
	viewer.append(close, figure, previous, next);
	close.addEventListener('click', () => viewer.close());
	previous.addEventListener('click', () => step(-1));
	next.addEventListener('click', () => step(1));
	viewer.addEventListener('click', (event) => {
		if (event.target === viewer || event.target === figure) {
			viewer.close();
		}
	});
	viewer.addEventListener('keydown', (event) => {
		const rtl = getComputedStyle(viewer).direction === 'rtl';
		const by = {ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1}[event.key];
		if (by !== undefined && links.length > 1) {
			event.preventDefault();
			step(by);
		}
	});
	viewer.addEventListener('close', () => links[at]?.focus());
	document.body.append(viewer);
};

/** Shows the image of the set's link at the place. */
const show = (place) => {
	at = (place + links.length) % links.length;
	const link = links[at];
	const image = viewer.querySelector('.viewer-image');
	const alt = link.querySelector('img')?.alt ?? '';
	image.src = link.href;
	image.alt = alt;
	const caption = link.title || alt;
	viewer.querySelector('.viewer-caption').textContent = links.length > 1 ? (caption === '' ? '' : caption + ' · ') + text('viewer.count', {position: at + 1, count: links.length}) : caption;
	viewer.classList.toggle('viewer-set', links.length > 1);
};

/** Steps through the set. */
const step = (by) => show(at + by);

document.addEventListener('click', (event) => {
	const link = event.target instanceof Element ? event.target.closest('a[data-zoom][href]') : null;
	if (link === null || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
		return;
	}
	event.preventDefault();
	if (viewer === null) {
		make();
	}
	const set = link.dataset.zoom;
	links = set === '' ? [link] : [...document.querySelectorAll('a[data-zoom][href]')].filter((other) => other.dataset.zoom === set);
	show(links.indexOf(link));
	if (!viewer.open) {
		viewer.showModal();
	}
});
