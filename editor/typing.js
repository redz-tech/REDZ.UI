// REDZ.UI editor, the keyboard: marks typed into the text, the / menu of an empty line, one list of commands for the panel, the keys and the
// palette. Nothing here touches the text while a character is composed: Thai and Burmese keyboards read the words around the caret.
import {say} from './words.js';
import {escape, trusted} from './clean.js';
import {before, caretTo, fieldAt, topAt} from './caret.js';

const LINES = {'## ': 'h2', '### ': 'h3', '#### ': 'h4', '> ': 'blockquote', '- ': 'ul', '* ': 'ul', '1. ': 'ol'};

/** Gives the editor what is typed. */
export const typingOf = (ed) => {
	const menu = Object.assign(document.createElement('div'), {className: 'menu editor-slash', id: ed.id + '-slash'});
	menu.popover = 'manual';
	menu.setAttribute('role', 'listbox');
	menu.setAttribute('aria-label', say('blocks'));
	ed.box.append(menu);
	let picking = null;

	const closePick = () => {
		picking = null;
		if (menu.matches(':popover-open')) {
			menu.hidePopover();
		}
	};
	ed.closePick = closePick;

	const showPick = (items, take, rect) => {
		if (items.length === 0) {
			closePick();
			return;
		}
		menu.innerHTML = trusted(items.map((one, index) => '<button class="menu-item" type="button" role="option" aria-selected="' + (index === 0) + '" data-index="' + index + '"><i class="bi bi-' + one.icon + '" aria-hidden="true"></i>' + escape(one.label) + '</button>').join(''));
		picking = {items, take, at: 0};
		for (const one of menu.querySelectorAll('[data-index]')) {
			one.onpointerdown = (event) => {
				event.preventDefault();
				take(items[+one.dataset.index]);
			};
		}
		if (!menu.matches(':popover-open')) {
			menu.showPopover();
		}
		const frame = ed.frame.getBoundingClientRect();
		const top = frame.top + rect.bottom + 6;
		menu.style.left = Math.max(8, Math.min(frame.left + rect.left, innerWidth - menu.offsetWidth - 8)) + 'px';
		menu.style.top = (top + menu.offsetHeight > innerHeight - 8 ? Math.max(8, frame.top + rect.top - menu.offsetHeight - 6) : top) + 'px';
	};

	const slash = () => {
		const doc = ed.doc;
		const top = topAt(doc);
		const selection = doc.getSelection();
		if (top === null || top.tagName !== 'P' || !top.textContent.startsWith('/') || !selection.isCollapsed || !ed.may('structure')) {
			closePick();
			return;
		}
		const query = top.textContent.slice(1).toLowerCase();
		const box = selection.getRangeAt(0).getBoundingClientRect();
		showPick(ed.insertable().filter((one) => one.label.toLowerCase().includes(query) && (one.need === undefined || ed.may(one.need))), (one) => {
			closePick();
			top.replaceChildren(doc.createElement('br'));
			one.run();
		}, box.height > 0 ? box : top.getBoundingClientRect());
	};

	/** @ at the start of a word opens the page's facts, narrowed by what follows it. */
	const mention = () => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const node = selection.anchorNode;
		const typed = node?.nodeType === Node.TEXT_NODE && selection.isCollapsed && ed.may('facts') ? /(?:^|\s)@([^\s@]*)$/.exec(node.data.slice(0, selection.anchorOffset)) : null;
		if (typed === null || typed === undefined) {
			return;
		}
		const query = typed[1].toLowerCase();
		const at = selection.anchorOffset;
		showPick([...ed.facts.values()].filter((one) => one.label.toLowerCase().includes(query)).map((one) => ({key: one.key, icon: 'tag', label: one.label + ' · ' + one.text})), (one) => {
			closePick();
			const range = doc.createRange();
			range.setStart(node, at - typed[1].length - 1);
			range.setEnd(node, at);
			ed.putFact(one.key, range);
		}, selection.getRangeAt(0).getBoundingClientRect());
	};

	/** A line that starts as Markdown does becomes that element, and a run closed by its marks becomes that mark. */
	const rules = (event) => {
		if (event.inputType !== 'insertText' || fieldAt(ed.doc) !== null) {
			return;
		}
		const doc = ed.doc;
		const top = topAt(doc);
		if (top === null) {
			return;
		}
		if (event.data === ' ' && top.tagName === 'P') {
			const typed = before(doc, top).replace(/ /g, ' ');
			const rule = LINES[typed];
			if (rule !== undefined) {
				const selection = doc.getSelection();
				const range = doc.createRange();
				range.selectNodeContents(top);
				range.setEnd(selection.anchorNode, selection.anchorOffset);
				range.deleteContents();
				if (top.textContent === '') {
					top.replaceChildren(doc.createElement('br'));
					caretTo(doc, top, 0);
				}
				if (rule === 'ul' || rule === 'ol') {
					ed.list(rule);
				} else {
					ed.retag(top, rule);
					ed.commit();
				}
			}
			return;
		}
		if (/[*`]/.test(event.data ?? '')) {
			const selection = doc.getSelection();
			const node = selection.anchorNode;
			if (node?.nodeType !== Node.TEXT_NODE) {
				return;
			}
			const typed = node.textContent.slice(0, selection.anchorOffset);
			for (const [pattern, tag] of [[/\*\*([^*\s][^*]*)\*\*$/, 'strong'], [/(?:^|[^*])(\*([^*\s][^*]*)\*)$/, 'em'], [/`([^`]+)`$/, 'code']]) {
				const found = pattern.exec(typed);
				if (found !== null) {
					const whole = tag === 'em' ? found[1] : found[0];
					const inner = tag === 'em' ? found[2] : found[1];
					const range = doc.createRange();
					range.setStart(node, selection.anchorOffset - whole.length);
					range.setEnd(node, selection.anchorOffset);
					selection.removeAllRanges();
					selection.addRange(range);
					doc.execCommand('insertHTML', false, trusted('<' + tag + '>' + escape(inner) + '</' + tag + '>​'));
					return;
				}
			}
		}
	};

	ed.typed = (event) => {
		if (event.isComposing || ed.composing) {
			return;
		}
		rules(event);
		slash();
		mention();
	};

	/** The keys of an open / menu; true when one was taken. */
	ed.pickKeys = (event) => {
		if (picking === null) {
			return false;
		}
		const items = [...menu.querySelectorAll('[data-index]')];
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			items[picking.at].setAttribute('aria-selected', 'false');
			picking.at = (picking.at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
			items[picking.at].setAttribute('aria-selected', 'true');
			items[picking.at].scrollIntoView({block: 'nearest'});
			return true;
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			picking.take(picking.items[picking.at]);
			return true;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			closePick();
			return true;
		}
		return false;
	};

	const palette = Object.assign(document.createElement('dialog'), {className: 'dialog editor-palette'});
	palette.setAttribute('closedby', 'any');
	palette.setAttribute('aria-label', say('commands'));
	palette.innerHTML = trusted('<input class="form-control" id="' + ed.id + '-commands" type="search" autocomplete="off" aria-label="' + say('commands') + '" placeholder="' + say('commands.find') + '"><div class="editor-palette-list" role="listbox" aria-label="' + say('commands') + '"></div>');
	ed.box.append(palette);
	const find = palette.querySelector('input');
	const list = palette.querySelector('[role="listbox"]');
	let shown = [];
	let at = 0;
	const render = () => {
		const query = find.value.trim().toLowerCase();
		shown = ed.commands().filter((one) => one.label.toLowerCase().includes(query));
		at = Math.min(at, Math.max(0, shown.length - 1));
		list.innerHTML = trusted(shown.map((one, index) => '<button class="menu-item" type="button" role="option" aria-selected="' + (index === at) + '" data-index="' + index + '"><i class="bi bi-' + one.icon + '" aria-hidden="true"></i><span class="flex-fill">' + escape(one.label) + '</span>' + (one.keys ? '<kbd>' + escape(one.keys) + '</kbd>' : '') + '</button>').join(''));
		list.querySelector('[aria-selected="true"]')?.scrollIntoView({block: 'nearest'});
	};
	const run = (one) => {
		palette.close();
		ed.focus();
		one?.run();
	};
	find.addEventListener('input', () => {
		at = 0;
		render();
	});
	find.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			at = (at + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length);
			render();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			run(shown[at]);
		}
	});
	list.addEventListener('click', (event) => {
		const one = event.target.closest('[data-index]');
		if (one !== null) {
			run(shown[+one.dataset.index]);
		}
	});
	ed.openPalette = () => {
		find.value = '';
		at = 0;
		render();
		palette.showModal();
		find.focus();
	};
};
