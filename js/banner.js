// REDZ.UI, the banner: REDZ.ui.banner({tone, text}) shows the page's one banner .app-banner for a state of the whole
// system - the first row of .app, above its header, or first in the body of a page without one - in the tone info,
// success, warning or danger, and answers a function that removes it; REDZ.ui.banner(null) removes it. A later call
// replaces it, and the same tone and words again change nothing and say nothing. The words are said once, politely,
// at once for danger. Its height, which grows as the words wrap, goes to --redz-app-banner-height on the root, which
// the sticky header, the sidebar, --redz-sticky-top and the scroll padding add. A banner in the page's markup is
// measured the same; one elsewhere, as in an example, is only its look. The words come from the caller.
import {announce} from './say.js';

const TONES = ['info', 'success', 'warning', 'danger'];
const ICONS = {info: 'bi-info-circle-fill', success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-octagon-fill'};
const PROPERTY = '--redz-app-banner-height';
const SLOT = ':is(body, body > .app) > .app-banner';
const sizes = new ResizeObserver((entries) => {
	for (const entry of entries) {
		if (entry.target.isConnected) {
			document.documentElement.style.setProperty(PROPERTY, entry.borderBoxSize[0].blockSize + 'px');
		}
	}
});
let shown = null;

/** Measures the banner from now on. */
const watch = (banner) => {
	sizes.disconnect();
	sizes.observe(banner);
};

/** Removes the banner when it is still the one shown. */
const remove = (banner) => {
	if (banner === null || !banner.isConnected) {
		return;
	}
	sizes.disconnect();
	banner.remove();
	document.documentElement.style.removeProperty(PROPERTY);
	if (shown?.node === banner) {
		shown = null;
	}
};

const present = document.querySelector(SLOT);
if (present !== null) {
	watch(present);
}

/** Shows the banner of {tone, text} in place of the one shown, or removes it for null; answers a function that removes it. */
export const banner = (what) => {
	const current = shown?.node.isConnected ? shown.node : document.querySelector(SLOT);
	if (what === null) {
		remove(current);
		return () => {};
	}
	const tone = TONES.includes(what?.tone) ? what.tone : 'info';
	const words = String(what?.text ?? '');
	if (shown !== null && shown.node === current && shown.tone === tone && shown.words === words) {
		return shown.close;
	}
	const node = document.createElement('div');
	node.className = 'app-banner app-banner-' + tone;
	const icon = document.createElement('i');
	icon.className = 'bi ' + ICONS[tone];
	icon.setAttribute('aria-hidden', 'true');
	node.append(icon, Object.assign(document.createElement('span'), {textContent: words}));
	if (current === null) {
		(document.querySelector('body > .app') ?? document.body).prepend(node);
	} else {
		current.replaceWith(node);
	}
	watch(node);
	const close = () => remove(node);
	shown = {node, tone, words, close};
	announce(words, tone === 'danger');
	return close;
};
