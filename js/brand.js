// REDZ.UI, a white label measured: brand(colour) answers what data-brand of that colour paints in each theme - the tone,
// the words on it, the links, the focus ring and the ground under them, each #rrggbb in sRGB, and their contrast ratios.
// It reads them from the stylesheet the page loads, so it never disagrees with the page; null for a value that is no colour.
const PARTS = {tone: '--redz-primary', text: '--redz-primary-contrast', link: '--redz-link', ring: '--redz-focus', ground: '--redz-bg'};

/** The colour a probe paints as red, green and blue in sRGB, 0 to 1, clipped to the gamut: the engine converts the colour
 *  it computed, which may be in another space, through a second probe - a relative colour of a light-dark() origin is
 *  refused by some engines on the floor, of a computed one by none. */
const srgb = (probe, scratch) => {
	const computed = getComputedStyle(probe).color;
	scratch.style.removeProperty('color');
	scratch.style.setProperty('color', 'color(from ' + computed + ' srgb r g b)');
	const color = scratch.style.getPropertyValue('color') === '' ? computed : getComputedStyle(scratch).color;
	const modern = /color\(srgb ([-\d.e]+) ([-\d.e]+) ([-\d.e]+)/.exec(color);
	const legacy = /rgba?\((\d+), (\d+), (\d+)/.exec(color);
	const channels = modern !== null ? modern.slice(1, 4).map(Number) : legacy !== null ? legacy.slice(1, 4).map((one) => Number(one) / 255) : [0, 0, 0];
	return channels.map((one) => Math.min(1, Math.max(0, one)));
};

/** WCAG 2's relative luminance. */
const luminance = (rgb) => rgb.map((one) => one <= 0.04045 ? one / 12.92 : ((one + 0.055) / 1.055) ** 2.4).reduce((sum, one, i) => sum + one * [0.2126, 0.7152, 0.0722][i], 0);

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
	const scratch = document.createElement('span');
	region.append(...probes, scratch);
	(document.body ?? document.documentElement).append(region);
	const answer = {};
	for (const theme of ['light', 'dark']) {
		region.dataset.theme = theme;
		const rgb = Object.fromEntries(Object.keys(PARTS).map((part, i) => [part, srgb(probes[i], scratch)]));
		answer[theme] = {
			...Object.fromEntries(Object.entries(rgb).map(([part, one]) => [part, '#' + one.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join('')])),
			textOnTone: ratio(rgb.text, rgb.tone),
			linkOnGround: ratio(rgb.link, rgb.ground),
			ringOnGround: ratio(rgb.ring, rgb.ground),
			toneOnGround: ratio(rgb.tone, rgb.ground),
		};
	}
	region.remove();
	return answer;
};
