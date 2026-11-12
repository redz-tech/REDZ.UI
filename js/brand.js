// REDZ.UI, a white label measured: brand(colour) answers what data-brand of that colour paints in each theme - the tone,
// the words on it, the links, the focus ring and the ground under them, each #rrggbb in sRGB, and their contrast ratios.
// It reads them from the stylesheet the page loads, so it never disagrees with the page; null for a value that is no colour.
const PARTS = {tone: '--redz-primary', text: '--redz-primary-contrast', link: '--redz-link', ring: '--redz-focus', ground: '--redz-bg'};
let paint = null;

/** The colour's red, green and blue in sRGB, 0 to 255: the canvas converts any space the engine computes in. */
const srgb = (color) => {
	paint ??= Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d', {willReadFrequently: true});
	paint.clearRect(0, 0, 1, 1);
	paint.fillStyle = color;
	paint.fillRect(0, 0, 1, 1);
	return [...paint.getImageData(0, 0, 1, 1).data.slice(0, 3)];
};

/** WCAG 2's relative luminance. */
const luminance = (rgb) => rgb.map((one) => one / 255).map((one) => one <= 0.04045 ? one / 12.92 : ((one + 0.055) / 1.055) ** 2.4).reduce((sum, one, i) => sum + one * [0.2126, 0.7152, 0.0722][i], 0);

/** The contrast ratio of two colours, to two decimals. */
const ratio = (one, other) => {
	const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);
	return Math.round((light + 0.05) / (dark + 0.05) * 100) / 100;
};

/** What a white label of the colour paints, theme by theme. */
export const brand = (colour) => {
	if (typeof colour !== 'string' || colour.trim() === '' || !CSS.supports('color', colour)) {
		return null;
	}
	const region = document.createElement('div');
	region.hidden = true;
	region.setAttribute('data-brand', colour);
	region.style.setProperty('--redz-brand', colour);
	const probes = Object.values(PARTS).map((property) => {
		const probe = document.createElement('span');
		probe.style.setProperty('color', 'var(' + property + ')');
		return probe;
	});
	region.append(...probes);
	(document.body ?? document.documentElement).append(region);
	const answer = {};
	for (const theme of ['light', 'dark']) {
		region.dataset.theme = theme;
		const rgb = Object.fromEntries(Object.keys(PARTS).map((part, i) => [part, srgb(getComputedStyle(probes[i]).color)]));
		answer[theme] = {
			...Object.fromEntries(Object.entries(rgb).map(([part, one]) => [part, '#' + one.map((value) => value.toString(16).padStart(2, '0')).join('')])),
			textOnTone: ratio(rgb.text, rgb.tone),
			linkOnGround: ratio(rgb.link, rgb.ground),
			ringOnGround: ratio(rgb.ring, rgb.ground),
			toneOnGround: ratio(rgb.tone, rgb.ground),
		};
	}
	region.remove();
	return answer;
};
