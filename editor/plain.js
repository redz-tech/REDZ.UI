// REDZ.UI editor, a block's words as data: its slots, each slot's plain words with a fact as a token, and the way back from a place in those
// words to the markup. A hash of the words says whether a block changed, and a price that changed does not count: the token stays.
import {FIELDS, isProse} from './marks.js';

const ZERO = String.fromCodePoint(0x200b);
const SKIPPED = 'ul, ol, i.bi, img, picture, svg, iframe, video, audio, progress, meter';
const INLINE_TAGS = /^(A|ABBR|B|BIG|CITE|CODE|DATA|DEL|EM|FONT|I|INS|KBD|LABEL|MARK|NOBR|Q|S|SMALL|SPAN|STRIKE|STRONG|SUB|SUP|TIME|TT|U)$/;
const TOKENS = /⟦[\w.-]+⟧/g;

/** A fact as the words carry it. */
export const tokenOf = (key) => '⟦' + key + '⟧';

/** The facts of some words, sorted, to compare two versions. */
export const tokensIn = (text) => (text.match(TOKENS) ?? []).sort().join(' ');

/** The elements of a top element that hold words of their own, in reading order. */
export const slotsOf = (top) => {
	if (isProse(top)) {
		return /^(UL|OL)$/.test(top.tagName) ? [...top.querySelectorAll('li')] : (top.tagName === 'HR' ? [] : [top]);
	}
	return top.matches(FIELDS) ? [top] : [...top.querySelectorAll(FIELDS)];
};

/** A slot's plain words, and for each of their letters where it stands in the markup. */
export const charsOf = (slot) => {
	const chars = [];
	let text = '';
	const keep = slot.closest('pre') !== null;
	const push = (char, node, at) => {
		text += char;
		chars.push({node, at});
	};
	const spaced = () => text === '' || text.endsWith(' ') || text.endsWith('\n');
	const walk = (parent) => {
		for (const node of parent.childNodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				for (let at = 0; at < node.data.length; at++) {
					const char = node.data[at];
					if (char !== ZERO && (keep || !/\s/.test(char))) {
						push(char, node, at);
					} else if (char !== ZERO && !spaced()) {
						push(' ', node, at);
					}
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.matches('data[value]')) {
					for (const char of tokenOf(node.getAttribute('value'))) {
						push(char, node, -1);
					}
				} else if (node.tagName === 'BR') {
					push('\n', node, -1);
				} else if (!node.matches(SKIPPED)) {
					if (!INLINE_TAGS.test(node.tagName) && !spaced()) {
						push(' ', node, -1);
					}
					walk(node);
				}
			}
		}
	};
	walk(slot);
	while (text.endsWith(' ') || text.endsWith('\n')) {
		text = text.slice(0, -1);
		chars.pop();
	}
	return {text, chars};
};

/** A slot's plain words. */
export const plainOf = (slot) => charsOf(slot).text;

/** The markup between two places of a slot's plain words. */
export const rangeOf = (slot, chars, start, end) => {
	const range = slot.ownerDocument.createRange();
	const after = (one) => (one.at < 0 ? range.setStartAfter(one.node) : range.setStart(one.node, one.at + 1));
	if (start > 0 && end === start) {
		after(chars[start - 1]);
	} else if (chars[start] === undefined) {
		range.selectNodeContents(slot);
		range.collapse(false);
	} else if (chars[start].at < 0) {
		range.setStartBefore(chars[start].node);
	} else {
		range.setStart(chars[start].node, chars[start].at);
	}
	if (end > start) {
		const last = chars[end - 1];
		if (last.at < 0) {
			range.setEndAfter(last.node);
		} else {
			range.setEnd(last.node, last.at + 1);
		}
	} else {
		range.collapse(true);
	}
	return range;
};

/** Puts words in an element, every fact a chip and every line break a break. */
export const putWords = (parent, text, factNode) => {
	const doc = parent.ownerDocument;
	for (const part of text.split(/(⟦[\w.-]+⟧|\n)/)) {
		if (part === '\n') {
			parent.append(doc.createElement('br'));
		} else if (part.startsWith('⟦')) {
			parent.append(factNode(part.slice(1, -1)));
		} else if (part !== '') {
			parent.append(doc.createTextNode(part));
		}
	}
};

/** Takes away the empty marks a change of words leaves behind. */
export const tidy = (slot) => {
	for (const one of slot.querySelectorAll('a, abbr, b, code, em, i:not(.bi), kbd, mark, s, small, span, strong, sub, sup, u')) {
		if (one.textContent === '' && one.querySelector('img, data') === null) {
			one.remove();
		}
	}
	slot.normalize();
};

/** FNV-1a of the words' UTF-8 bytes, as PHP's hash('fnv1a32'): the server can compare it too. */
export const hashOf = (value) => {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(value)) {
		hash = Math.imul(hash ^ byte, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
};

/** The hash of a block's words, facts as tokens. */
export const wordsHash = (top) => hashOf(slotsOf(top).map(plainOf).join('\n'));
