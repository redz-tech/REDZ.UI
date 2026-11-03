// probes, read: what the page itself holds for a screen reader's quick navigation, in document order — each heading's
// words, each landmark's role and name, each form control's name (NVDA's form fields: buttons, check boxes, radio buttons,
// switches, combo boxes, list boxes, trees, tabs, text fields one can edit) — without what a reader is never shown:
// hidden, inert or aria-hidden. Only what is surely such an item is listed; a reader stopping at more is no fault of the
// page.
(() => {
	const LANDMARKS = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search'];
	const FIELDS = 'button, summary, select, textarea:not([readonly]), input:not([type="hidden"], [type="range"], [type="color"], [type="date"], [type="time"], [type="month"], [type="week"], [type="datetime-local"], [readonly]:not([type="button"], [type="submit"], [type="reset"], [type="checkbox"], [type="radio"], [type="file"], [type="image"])), [contenteditable="true"], [role~="button"], [role~="checkbox"], [role~="radio"], [role~="switch"], [role~="combobox"], [role~="listbox"], [role~="tree"], [role~="tab"], [role~="textbox"], [role~="searchbox"]';
	const shown = (el) => el.checkVisibility({visibilityProperty: true}) && el.closest('[inert], [aria-hidden="true"]') === null;
	const words = (text) => text.replace(/\s+/g, ' ').trim();
	const text = (el) => {
		let out = '';
		for (const node of el.childNodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				out += node.data;
			} else if (node instanceof HTMLImageElement) {
				out += ' ' + node.alt + ' ';
			} else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true' && node.checkVisibility()) {
				out += ' ' + text(node) + ' ';
			}
		}
		return words(out);
	};
	const name = (el) => {
		const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter((ref) => ref !== null);
		if (by.length > 0) {
			return words(by.map(text).join(' '));
		}
		if (words(el.getAttribute('aria-label') || '') !== '') {
			return words(el.getAttribute('aria-label'));
		}
		if (el.labels && el.labels.length > 0) {
			return words([...el.labels].map(text).join(' '));
		}
		if (el.matches('input[type="button"], input[type="submit"], input[type="reset"]')) {
			return words(el.value);
		}
		if (el.matches('input[type="image"]')) {
			return words(el.alt);
		}
		if (el.matches('h1, h2, h3, h4, h5, h6, button, summary, [role~="heading"], [role~="button"], [role~="tab"], [role~="checkbox"], [role~="radio"], [role~="switch"]')) {
			return text(el) || words(el.title);
		}
		return words(el.title || el.getAttribute('placeholder') || '');
	};
	const what = (el) => el.localName + (el.id === '' ? '' : '#' + el.id) + [...el.classList].slice(0, 2).map((name) => '.' + name).join('');
	const scoped = (el) => el.parentElement?.closest('article, aside, main, nav, section') != null;
	const landmark = (el) => {
		const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
		const named = name(el) !== '';
		if (role !== '') {
			return LANDMARKS.includes(role) || ((role === 'region' || role === 'form') && named) ? role : null;
		}
		return {main: 'main', nav: 'navigation', search: 'search', header: scoped(el) ? null : 'banner', footer: scoped(el) ? null : 'contentinfo', aside: scoped(el) && !named ? null : 'complementary', section: named ? 'region' : null, form: named ? 'form' : null}[el.localName] ?? null;
	};
	const all = (selector) => [...document.body.querySelectorAll(selector)].filter(shown);
	return {
		heading: all('h1, h2, h3, h4, h5, h6, [role~="heading"]').filter((el) => !el.matches('[role]:not([role~="heading"])')).map((el) => ({words: name(el), what: what(el)})),
		landmark: all('header, footer, nav, main, aside, section, form, search, [role]').map((el) => ({role: landmark(el), words: name(el), what: what(el)})).filter((item) => item.role !== null),
		field: all(FIELDS).filter((el) => !el.matches('[role]:not([role~="button"], [role~="checkbox"], [role~="radio"], [role~="switch"], [role~="combobox"], [role~="listbox"], [role~="tree"], [role~="tab"], [role~="textbox"], [role~="searchbox"])')).map((el) => ({words: name(el), what: what(el)})),
	};
})()
