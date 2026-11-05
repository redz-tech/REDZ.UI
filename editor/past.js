// REDZ.UI editor, its history: a step for each pause in typing and each command, with the caret where the change STARTED, and each
// block's own earlier versions, so one block can go back while the others stay.
import {caretGet, caretPut} from './caret.js';

const LIMIT = 200;
const PAUSE = 300;

/** Each block's markup in a value, by its id. */
const blocksIn = (html) => {
	const box = document.createElement('template');
	box.innerHTML = html;
	return new Map([...box.content.children].filter((one) => one.hasAttribute('data-block')).map((one) => [one.getAttribute('data-block'), one.outerHTML]));
};

/** Gives the editor its history. */
export const pastOf = (ed) => {
	const back = [];
	let ahead = [];
	let now = null;
	let dirty = false;
	let timer = 0;
	let known = new Map();
	ed.versions = new Map(Object.entries(ed.config.versions ?? {}));

	/** Records the value and tells the page, at once or after a pause; nothing touches the text while a character is composed. */
	const save = () => {
		clearTimeout(timer);
		if (ed.composing) {
			timer = setTimeout(save, PAUSE);
			return;
		}
		ed.settle();
		const html = ed.read(true);
		dirty = false;
		if (html !== now.html) {
			back.push(now);
			if (back.length > LIMIT) {
				back.shift();
			}
			ahead = [];
			const next = blocksIn(html);
			for (const [id, markup] of known) {
				if (next.has(id) && next.get(id) !== markup) {
					ed.versions.set(id, [...(ed.versions.get(id) ?? []), {at: new Date(), html: markup}]);
				}
			}
			known = next;
			now = {html, caret: caretGet(ed.doc)};
			ed.config.onChange?.(ed.value());
			ed.changed?.();
		}
		ed.mark();
	};

	const restore = (state) => {
		now = state;
		known = blocksIn(state.html);
		ed.fill(state.html);
		caretPut(ed.doc, state.caret);
		ed.cardAgain();
		ed.config.onChange?.(ed.value());
		ed.changed?.();
		ed.mark();
	};

	ed.start = () => {
		now = {html: ed.read(true), caret: null};
		known = blocksIn(now.html);
	};

	ed.commit = (later = false) => {
		clearTimeout(timer);
		if (later) {
			timer = setTimeout(save, PAUSE);
		} else {
			save();
		}
	};

	ed.undo = () => {
		ed.tryOff();
		save();
		if (back.length > 0) {
			ahead.push(now);
			restore(back.pop());
		}
	};

	ed.redo = () => {
		ed.tryOff();
		save();
		if (ahead.length > 0) {
			back.push(now);
			restore(ahead.pop());
		}
	};

	ed.canUndo = () => back.length > 0 || dirty;
	ed.canRedo = () => ahead.length > 0;

	/** Until a change starts, the state to go back to holds the caret where that change will begin. */
	ed.followCaret = () => {
		if (!dirty && now !== null) {
			now.caret = caretGet(ed.doc) ?? now.caret;
		}
	};

	ed.changing = () => {
		dirty = true;
	};

	ed.stop = () => clearTimeout(timer);
};
