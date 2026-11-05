// REDZ.UI editor, the drawn text: every mark on it is an attribute data-editor-* or contenteditable, which reading strips, so
// the value is what came in plus what was changed. A block is the top element, closed to the browser's editing; the words
// inside it are fields, found by walking it, so no element has to declare them.
export const FIELD = 'data-editor-field';
export const FIELDS = '[data-editor-field]';
const PROSE = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'HR']);
const PROSE_CLASS = /^(text-(start|center|end|muted|primary|secondary|success|danger|warning|info)|bg-(primary|secondary|success|danger|warning|info)-subtle)$/;
const INLINE = new Set(['A', 'ABBR', 'B', 'BR', 'CITE', 'CODE', 'DATA', 'DEL', 'EM', 'I', 'IMG', 'INS', 'KBD', 'MARK', 'PICTURE', 'Q', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U']);
const TEXT = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION', 'BLOCKQUOTE', 'CAPTION', 'SUMMARY']);
const SKIP = 'i.bi, img, picture, svg, iframe, video, audio, progress, meter, hr, br, input, select, textarea, [role="tab"], .carousel-indicators';
const OWN = '.btn, .badge, .chip';
let serial = 0;

/** Whether an element at the top of the text is prose, edited in place, rather than a block. */
export const isProse = (element) => PROSE.has(element.tagName) && [...element.classList].every((name) => PROSE_CLASS.test(name));

/** Whether an element at the top of the text is an inline run, to be held in a paragraph. */
export const isInline = (node) => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && INLINE.has(node.tagName));

/** A fresh id of a block: short, and unique in the session even before the page's random numbers are. */
export const blockId = () => (crypto.getRandomValues(new Uint32Array(1))[0] + ++serial).toString(16).padStart(8, '0').slice(-8);

const words = (element) => {
	const inline = [...element.children].every((one) => INLINE.has(one.tagName) && !one.matches(OWN));
	return inline && (element.textContent.trim() !== '' || TEXT.has(element.tagName));
};

const field = (element, open) => {
	element.setAttribute(FIELD, '');
	element.setAttribute('contenteditable', String(open));
	for (const one of element.querySelectorAll('i.bi, .fact')) {
		one.setAttribute('contenteditable', 'false');
	}
};

/** Finds the words of an element: the smallest element holding them is a field. */
const fields = (root, open) => {
	for (const child of [...root.children]) {
		if (child.matches(SKIP)) {
			continue;
		}
		if (words(child)) {
			field(child, open);
		} else {
			fields(child, open);
		}
	}
};

/** Draws a moving part open and remembers how it was. */
const openUp = (view) => {
	for (const details of view.querySelectorAll('details')) {
		if (!details.open) {
			details.open = true;
			details.setAttribute('data-editor-shut', '');
		}
		if (details.hasAttribute('name')) {
			details.setAttribute('data-editor-name', details.getAttribute('name'));
			details.removeAttribute('name');
		}
	}
	for (const panel of view.querySelectorAll('[role="tabpanel"]')) {
		if (panel.hidden) {
			panel.hidden = false;
			panel.setAttribute('data-editor-hidden', '');
		}
		const tab = view.querySelector('#' + CSS.escape(panel.getAttribute('aria-labelledby') || ''));
		if (tab !== null) {
			panel.setAttribute('data-editor-tab', tab.textContent.trim());
		}
	}
};

/** Draws a top element: a block closed to the browser, its words as fields, its id given; prose keeps its own editing. */
export const drawTop = (element, open) => {
	if (!element.hasAttribute('data-block')) {
		element.setAttribute('data-block', blockId());
	}
	if (isProse(element)) {
		if (!open) {
			element.setAttribute('contenteditable', 'false');
		}
		return element;
	}
	element.setAttribute('contenteditable', 'false');
	if (words(element)) {
		field(element, open);
	} else {
		fields(element, open);
	}
	openUp(element);
	return element;
};

/** Takes every mark off a copy: what was drawn open is shut again, ids stay only when asked for. */
export const unmark = (copy, ids) => {
	for (const one of [copy, ...copy.querySelectorAll('*')]) {
		if (one.hasAttribute('data-editor-shut')) {
			one.removeAttribute('open');
		}
		if (one.hasAttribute('data-editor-name')) {
			one.setAttribute('name', one.getAttribute('data-editor-name'));
		}
		if (one.hasAttribute('data-editor-hidden')) {
			one.hidden = true;
		}
		for (const attribute of [...one.attributes]) {
			if (attribute.name.startsWith('data-editor-') || attribute.name === 'contenteditable') {
				one.removeAttribute(attribute.name);
			}
		}
		if (!ids) {
			one.removeAttribute('data-block');
			one.removeAttribute('data-lock');
		}
		if (one !== copy && (one.tagName === 'B' || (one.tagName === 'I' && one.attributes.length === 0))) {
			const meant = one.ownerDocument.createElement(one.tagName === 'B' ? 'strong' : 'em');
			for (const attribute of one.attributes) {
				meant.setAttribute(attribute.name, attribute.value);
			}
			meant.append(...one.childNodes);
			one.replaceWith(meant);
		}
	}
	return copy;
};

/** The path of an element inside a block, as child positions. */
export const pathOf = (element, block) => {
	const path = [];
	for (let node = element; node !== block; node = node.parentElement) {
		path.unshift([...node.parentElement.children].indexOf(node));
	}
	return path;
};

/** The element at a path inside a block. */
export const nodeAt = (block, path) => path.reduce((node, index) => node?.children[index], block);

/** Whether an element has a like sibling, and so is a part that can be copied, moved and removed. */
export const repeats = (element) => {
	const shape = (one) => one.tagName + '.' + (one.classList[0] ?? '');
	return element.parentElement !== null && [...element.parentElement.children].filter((one) => shape(one) === shape(element)).length >= 2;
};
