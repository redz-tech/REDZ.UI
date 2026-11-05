// REDZ.UI editor, the caret: where it is as a block, a field and an offset, which survives a redraw, and the guard of the
// fields: Safari throws the caret out on Enter and pulls the words out on Backspace, Firefox will not cross a block by arrows.
import {FIELDS} from './marks.js';

/** The element the selection starts in. */
const anchor = (doc) => {
	const node = doc.getSelection()?.anchorNode ?? null;
	return node === null ? null : (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
};

/** The top element holding the selection, or null. */
export const topAt = (doc) => {
	let node = doc.getSelection()?.anchorNode ?? null;
	while (node !== null && node.parentNode !== doc.body) {
		node = node.parentNode;
	}
	return node?.nodeType === Node.ELEMENT_NODE ? node : null;
};

/** The field holding the selection, or null. */
export const fieldAt = (doc) => anchor(doc)?.closest(FIELDS) ?? null;

/** The text before the caret inside an element. */
export const before = (doc, host) => {
	const selection = doc.getSelection();
	const range = doc.createRange();
	const node = selection.anchorNode;
	range.selectNodeContents(host);
	range.setEnd(node, Math.min(selection.anchorOffset, node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length));
	return range.toString();
};

/** The caret as data, or null. */
export const caretGet = (doc) => {
	const top = topAt(doc);
	if (top === null) {
		return null;
	}
	const field = fieldAt(doc);
	return {id: top.getAttribute('data-block'), field: field === null ? -1 : [...top.querySelectorAll(FIELDS), top].indexOf(field), at: before(doc, field ?? top).length};
};

/** Puts the caret at an offset of an element's words. */
export const caretTo = (doc, host, at) => {
	if (host.hasAttribute('data-editor-gap')) {
		host.setAttribute('data-editor-hint', '');
	}
	const walker = doc.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	const range = doc.createRange();
	let left = at;
	let placed = false;
	for (let node = walker.nextNode(); node !== null && !placed; node = walker.nextNode()) {
		if (left <= node.length) {
			range.setStart(node, left);
			range.collapse(true);
			placed = true;
		} else {
			left -= node.length;
		}
	}
	if (!placed) {
		const empty = host.textContent === '';
		let place = host;
		for (let next = place.firstElementChild; empty && next !== null && next.tagName !== 'BR'; next = place.firstElementChild) {
			place = next;
		}
		range.selectNodeContents(place);
		range.collapse(empty);
	}
	const selection = doc.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
};

/** Puts the caret back from data; at the end of the text when there is none. */
export const caretPut = (doc, mark) => {
	const top = mark === null ? null : doc.body.querySelector('[data-block="' + CSS.escape(mark.id ?? '') + '"]');
	if (top === null) {
		doc.body.focus();
		const selection = doc.getSelection();
		selection.selectAllChildren(doc.body);
		selection.collapseToEnd();
		return;
	}
	const host = mark.field === -1 ? top : [...top.querySelectorAll(FIELDS), top][mark.field] ?? top;
	(host.isContentEditable && host !== top ? host : doc.body).focus();
	caretTo(doc, host, mark.at);
	host.scrollIntoView?.({block: 'nearest'});
};

/** Whether the caret stands on the first or last line of an element. */
const onEdge = (doc, host, down) => {
	const selection = doc.getSelection();
	if (!selection.isCollapsed) {
		return false;
	}
	const rect = selection.getRangeAt(0).getBoundingClientRect();
	const box = host.getBoundingClientRect();
	return rect.height === 0 || (down ? rect.bottom > box.bottom - rect.height * 0.6 : rect.top < box.top + rect.height * 0.6);
};

/** Puts the caret into a field or a prose element, at its start or end. */
const enter = (doc, host, atEnd) => {
	(host.matches(FIELDS) ? host : doc.body).focus();
	caretTo(doc, host, atEnd ? host.textContent.length : 0);
};

/** The nearest place to type in a top element, from its start or its end. */
const into = (doc, top, down) => {
	const all = [...top.querySelectorAll(FIELDS)].filter((one) => one.isContentEditable);
	if (top.getAttribute('contenteditable') === 'false' && all.length === 0) {
		return null;
	}
	return all.length > 0 ? (down ? all[0] : all.at(-1)) : top;
};

/** What the keys do on a field and across blocks; true when the key was taken. */
export const guard = (doc, event, hooks) => {
	const field = fieldAt(doc);
	if (field !== null && field.isContentEditable) {
		const top = topAt(doc);
		const collapsed = doc.getSelection().isCollapsed;
		if (event.key === ' ' && field.closest('summary') !== null) {
			doc.execCommand('insertText', false, ' ');
			event.preventDefault();
			return true;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (!hooks.enter?.(field, top, event)) {
				if (event.shiftKey) {
					doc.execCommand('insertLineBreak');
				}
			}
			return true;
		}
		if (event.key === 'Tab' && hooks.tab?.(field, top, event)) {
			event.preventDefault();
			return true;
		}
		if (event.key === 'Backspace' && collapsed && before(doc, field).length === 0) {
			event.preventDefault();
			hooks.backspace?.(field, top);
			return true;
		}
		if (event.key === 'Delete' && collapsed && before(doc, field).length >= field.textContent.length) {
			event.preventDefault();
			return true;
		}
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && onEdge(doc, field, event.key === 'ArrowDown')) {
			const down = event.key === 'ArrowDown';
			const all = [...top.querySelectorAll(FIELDS)].filter((one) => one.isContentEditable);
			const next = all[all.indexOf(field) + (down ? 1 : -1)];
			event.preventDefault();
			if (next !== undefined) {
				enter(doc, next, !down);
			} else {
				const beyond = down ? top.nextElementSibling : top.previousElementSibling;
				const place = beyond === null ? null : into(doc, beyond, down);
				if (place !== null) {
					enter(doc, place, !down);
				}
			}
			return true;
		}
		return false;
	}
	if ((event.key === 'Backspace' || event.key === 'Delete') && doc.getSelection().isCollapsed) {
		const top = topAt(doc);
		const back = event.key === 'Backspace';
		const near = back ? top?.previousElementSibling : top?.nextElementSibling;
		if (near?.getAttribute('contenteditable') === 'false' && (back ? before(doc, top).length === 0 : before(doc, top).length >= top.textContent.length)) {
			const place = into(doc, near, !back);
			event.preventDefault();
			if (place !== null) {
				enter(doc, place, back);
			}
			return true;
		}
	}
	if (event.key === 'Enter' && !event.shiftKey && topAt(doc)?.tagName === 'PRE') {
		event.preventDefault();
		doc.execCommand('insertLineBreak');
		return true;
	}
	if (event.key === 'Tab' && fieldAt(doc) === null && anchor(doc)?.closest('li') !== null) {
		event.preventDefault();
		doc.execCommand(event.shiftKey ? 'outdent' : 'indent');
		return true;
	}
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		const top = topAt(doc);
		const down = event.key === 'ArrowDown';
		const near = down ? top?.nextElementSibling : top?.previousElementSibling;
		if (near?.getAttribute('contenteditable') === 'false' && onEdge(doc, top, down)) {
			const place = into(doc, near, down);
			if (place !== null) {
				event.preventDefault();
				enter(doc, place, !down);
				return true;
			}
		}
	}
	return false;
};
