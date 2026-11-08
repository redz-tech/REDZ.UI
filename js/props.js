// REDZ.UI, values a page writes in attributes and the CSS reads: under a strict CSP a page sets no style, so the library
// sets the custom property through the CSSOM - data-color (a stored colour) as --redz-color on .dot, edge-*-color,
// .choice-media and .icon-tile, data-brand (a white label's colour) as --redz-brand and data-brand-secondary, -success,
// -info, -warning and -danger as --redz-brand-TONE, a logo's data-ratio (its width by its height) as --redz-ratio, a
// rating's or a stacked meter's part's data-v (its share, 0 to 1) as --v. A value the engine cannot read as a colour or a number is taken off.
const TONES = ['secondary', 'success', 'info', 'warning', 'danger'];
const PROPS = {'data-color': ['--redz-color', 'color'], 'data-brand': ['--redz-brand', 'color'], ...Object.fromEntries(TONES.map((tone) => ['data-brand-' + tone, ['--redz-brand-' + tone, 'color']])), 'data-ratio': ['--redz-ratio', 'number'], 'data-v': ['--v', 'number']};
const SELECTOR = Object.keys(PROPS).map((name) => name === 'data-v' ? '.rating[data-v], .meter-stacked > [data-v]' : '[' + name + ']').join(', ');

/** Sets the element's custom properties from its attributes. */
const write = (element) => {
	for (const [attribute, [property, kind]] of Object.entries(PROPS)) {
		const value = element.getAttribute(attribute)?.trim() ?? '';
		const fits = attribute !== 'data-v' || element.matches('.rating, .meter-stacked > *');
		const valid = kind === 'color' ? value !== '' && CSS.supports('color', value) : value !== '' && Number.isFinite(Number(value));
		if (fits && valid) {
			element.style.setProperty(property, value);
		} else if (fits) {
			element.style.removeProperty(property);
		}
	}
};

document.querySelectorAll(SELECTOR).forEach(write);

new MutationObserver((records) => {
	for (const record of records) {
		if (record.type === 'attributes' && record.target instanceof HTMLElement) {
			write(record.target);
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(SELECTOR) ? [node] : []).concat([...node.querySelectorAll(SELECTOR)]).forEach(write);
			}
		}
	}
}).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: Object.keys(PROPS)});
