// REDZ.UI editor, what comes in: escaping, the addresses that may stay, and the cleaner every value passes through.
const DROP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'FRAME', 'FRAMESET', 'APPLET']);
const URLS = new Set(['href', 'src', 'action', 'poster', 'cite', 'data', 'xlink:href', 'background']);

/** Escapes text for an attribute or an element's words. */
export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/** Whether a URL may stay: a path, a fragment, or http(s), mailto, tel. */
export const safe = (value) => !/^\s*[a-z][a-z0-9+.-]*:/i.test(value) || /^\s*(https?|mailto|tel):/i.test(value);

/** The HTML with nothing that runs or reaches away. */
export const clean = (html) => {
	const doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
	const walk = (node) => {
		for (const child of [...node.childNodes]) {
			if (child.nodeType === Node.COMMENT_NODE) {
				child.remove();
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) {
				continue;
			}
			if (DROP.has(child.tagName) || (child.tagName === 'IFRAME' && !/^\s*https:/i.test(child.getAttribute('src') || ''))) {
				child.remove();
				continue;
			}
			for (const attribute of [...child.attributes]) {
				const name = attribute.name.toLowerCase();
				if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || (URLS.has(name) && !safe(attribute.value))) {
					child.removeAttribute(attribute.name);
				}
			}
			walk(child);
		}
	};
	walk(doc.body);
	return doc.body.innerHTML;
};
