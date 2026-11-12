// REDZ.UI editor, the panel as the owner fixed it: undo, redo | the block's style as a word | bold, italic, underline, link, color | bullets,
// numbers, align | Insert | clear, source. One tab stop, the arrow keys, and the states say what is under the caret.
import {say} from './words.js';
import {escape, trusted} from './clean.js';
import {caretGet, caretPut, fieldAt, topAt} from './caret.js';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const COLORS = [['color.none', '', '--redz-text'], ['color.primary', 'text-primary', '--redz-primary'], ['color.secondary', 'text-secondary', '--redz-secondary'], ['color.success', 'text-success', '--redz-success'], ['color.danger', 'text-danger', '--redz-danger'], ['color.warning', 'text-warning', '--redz-warning'], ['color.info', 'text-info', '--redz-info']];
const FORMATS = [['format.paragraph', 'p'], ['format.heading2', 'h2'], ['format.heading3', 'h3'], ['format.heading4', 'h4'], ['format.quote', 'blockquote'], ['format.code', 'pre']];
const ALIGN = [['align.start', 'text-start', 'text-left'], ['align.center', 'text-center', 'text-center'], ['align.end', 'text-end', 'text-right']];

/** The words of a key for a tooltip, the Mac's or the others'. */
export const keysOf = (keys) => (MAC ? keys : keys.replace('⇧', 'Shift+').replace('⌘', 'Ctrl+'));

/** Gives the editor its panel. */
export const toolbarOf = (ed) => {
	const toolbar = Object.assign(document.createElement('div'), {className: 'editor-toolbar'});
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', say('toolbar'));
	ed.toolbar = toolbar;

	/** A panel's button: an icon or words, its name, its action; toggles report aria-pressed. */
	const button = (key, html, act, extra = {}) => {
		const one = Object.assign(document.createElement('button'), {type: 'button', className: 'btn btn-text editor-tool', tabIndex: -1, innerHTML: trusted(html)});
		one.setAttribute('aria-label', say(key));
		one.title = extra.keys ? say(key) + ' ' + keysOf(extra.keys) : say(key);
		one.dataset.editor = key;
		if (extra.need !== undefined) {
			one.dataset.editorNeed = extra.need;
		}
		if (extra.toggle) {
			one.setAttribute('aria-pressed', 'false');
		}
		if (act !== null) {
			one.addEventListener('click', act);
		}
		toolbar.append(one);
		return one;
	};
	const icon = (name) => '<i class="bi bi-' + name + '" aria-hidden="true"></i>';
	const CARET = '<i class="bi bi-chevron-down editor-tool-caret" aria-hidden="true"></i>';

	/** A panel's menu: a button that opens a REDZ.UI menu. */
	const menu = (key, html, extra = {}) => {
		const list = Object.assign(document.createElement('div'), {className: 'menu', id: ed.id + '-' + key.replace(/\W/g, '-')});
		list.popover = 'auto';
		list.setAttribute('role', 'menu');
		list.setAttribute('aria-label', say(key));
		const one = button(key, html + CARET, null, extra);
		one.setAttribute('commandfor', list.id);
		one.setAttribute('command', 'toggle-popover');
		one.setAttribute('aria-haspopup', 'menu');
		toolbar.append(list);
		return {one, list};
	};
	const item = (list, label, act, html = '') => {
		const one = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item', innerHTML: trusted(html + escape(label))});
		one.setAttribute('role', 'menuitem');
		one.addEventListener('click', () => {
			list.hidePopover();
			act();
		});
		list.append(one);
		return one;
	};
	const divider = () => toolbar.append(Object.assign(document.createElement('span'), {className: 'editor-tool-sep'}));

	/** Tries a change of the block under the caret while an item of a menu is hovered or focused. */
	const tries = (one, list, change) => {
		const on = () => {
			const top = topAt(ed.doc);
			if (top !== null && ed.formOpen(top)) {
				ed.tryOn(top, change);
			}
		};
		one.addEventListener('pointerenter', on);
		one.addEventListener('focus', on);
	};
	const leaves = (list) => {
		let caret = null;
		list.addEventListener('beforetoggle', (event) => {
			if (event.newState === 'open') {
				caret = caretGet(ed.doc);
			}
		});
		list.addEventListener('toggle', (event) => {
			if (event.newState === 'closed') {
				ed.tryOff();
				if (caret !== null && ed.doc?.getSelection()?.rangeCount === 0) {
					caretPut(ed.doc, caret);
				}
			}
		});
		list.addEventListener('pointerleave', ed.tryOff);
	};

	const paint = (name) => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const top = topAt(doc);
		if (selection.rangeCount === 0 || selection.isCollapsed || top === null || !ed.formOpen(top)) {
			return;
		}
		const range = selection.getRangeAt(0);
		const span = doc.createElement('span');
		span.append(range.extractContents());
		for (const inner of span.querySelectorAll('span')) {
			if ([...inner.classList].every((one) => /^text-/.test(one))) {
				inner.replaceWith(...inner.childNodes);
			}
		}
		if (name === '') {
			const piece = doc.createDocumentFragment();
			piece.append(...span.childNodes);
			range.insertNode(piece);
		} else {
			span.className = name;
			range.insertNode(span);
		}
		ed.commit();
	};

	const align = (top, name) => {
		top.classList.remove('text-start', 'text-center', 'text-end');
		if (name !== 'text-start') {
			top.classList.add(name);
		}
	};

	ed.buildTools = () => {
		button('undo', icon('arrow-counterclockwise'), ed.undo, {keys: '⌘Z'});
		button('redo', icon('arrow-clockwise'), ed.redo, {keys: '⇧⌘Z'});
		divider();
		const format = menu('format', '<span class="editor-tool-word" data-editor-word>' + escape(say('format.paragraph')) + '</span>', {need: 'design'});
		format.one.classList.add('editor-tool-format');
		for (const [key, tag] of FORMATS) {
			const one = item(format.list, say(key), () => {
				ed.tryOff();
				ed.format(tag);
			});
			tries(one, format.list, (fresh) => ed.retagged(fresh, tag));
		}
		leaves(format.list);
		divider();
		button('bold', icon('type-bold'), () => ed.exec('bold'), {toggle: true, keys: '⌘B'});
		button('italic', icon('type-italic'), () => ed.exec('italic'), {toggle: true, keys: '⌘I'});
		button('underline', icon('type-underline'), () => ed.exec('underline'), {toggle: true, keys: '⌘U'});
		button('link', icon('link-45deg'), ed.link, {keys: '⌘K'});
		const color = menu('color', '<span class="editor-tool-letter" data-editor-letter>A</span>', {need: 'design'});
		const swatches = Object.assign(document.createElement('div'), {className: 'editor-swatches'});
		color.list.append(swatches);
		for (const [key, name, token] of COLORS) {
			const one = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item', innerHTML: trusted('<i style="--editor-swatch:var(' + token + ')"></i>')});
			one.setAttribute('role', 'menuitem');
			one.setAttribute('aria-label', say(key));
			one.title = say(key);
			one.addEventListener('click', () => {
				color.list.hidePopover();
				toolbar.querySelector('[data-editor-letter]').style.setProperty('--editor-swatch', 'var(' + token + ')');
				paint(name);
			});
			swatches.append(one);
		}
		divider();
		button('bullets', icon('list-ul'), () => ed.list('ul'), {toggle: true, need: 'structure'});
		button('numbers', icon('list-ol'), () => ed.list('ol'), {toggle: true, need: 'structure'});
		const place = menu('align', '<i class="bi bi-text-left" aria-hidden="true" data-editor-align></i>', {need: 'design'});
		const row = Object.assign(document.createElement('div'), {className: 'editor-swatches editor-swatches-row'});
		place.list.append(row);
		for (const [key, name, glyph] of ALIGN) {
			const one = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item', innerHTML: trusted(icon(glyph))});
			one.setAttribute('role', 'menuitem');
			one.setAttribute('aria-label', say(key));
			one.title = say(key);
			one.addEventListener('click', () => {
				place.list.hidePopover();
				ed.tryOff();
				const top = topAt(ed.doc);
				if (top !== null && ed.formOpen(top)) {
					align(top, name);
					ed.commit();
				}
			});
			tries(one, place.list, (fresh) => align(fresh, name));
			row.append(one);
		}
		leaves(place.list);
		divider();
		const insert = menu('insert', icon('plus-lg') + '<span class="editor-tool-word">' + escape(say('insert')) + '</span>', {need: 'structure'});
		insert.one.classList.add('editor-tool-insert');
		const groups = {ai: say('group.ai'), media: say('group.media'), content: say('group.content'), inline: say('group.inline'), layout: say('group.layout')};
		let group = null;
		for (const one of ed.insertable()) {
			if (one.group !== group) {
				group = one.group;
				insert.list.append(Object.assign(document.createElement('div'), {className: 'menu-header', textContent: groups[group] ?? group}));
				if (group === 'ai') {
					insert.list.lastElementChild.dataset.editorNeed = 'ai';
				}
			}
			const entry = item(insert.list, one.label, one.run, icon(one.icon));
			if (one.need !== undefined) {
				entry.dataset.editorNeed = one.need;
			}
		}
		toolbar.append(Object.assign(document.createElement('span'), {className: 'editor-tool-gap'}));
		button('clear', icon('eraser'), () => ed.exec('removeFormat'), {need: 'design'});
		button('source', icon('code-slash'), ed.toggleSource, {toggle: true, need: 'html'});
	};

	/** The panel's states by the caret: what is pressed, the style's word, the align icon, and what cannot run. */
	ed.mark = () => {
		const doc = ed.doc;
		const source = ed.isSource();
		for (const [key, command] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['bullets', 'insertUnorderedList'], ['numbers', 'insertOrderedList']]) {
			toolbar.querySelector('[data-editor="' + key + '"]')?.setAttribute('aria-pressed', String(!source && doc.queryCommandState(command)));
		}
		toolbar.querySelector('[data-editor="source"]')?.setAttribute('aria-pressed', String(source));
		const top = topAt(doc);
		const tag = top?.tagName ?? 'P';
		const word = toolbar.querySelector('[data-editor-word]');
		if (word !== null) {
			word.textContent = say(FORMATS.find(([, name]) => name === tag.toLowerCase())?.[0] ?? (fieldAt(doc) !== null ? 'format.block' : 'format.paragraph'));
			word.closest('button').setAttribute('aria-label', say('format') + ': ' + word.textContent);
		}
		const glyph = toolbar.querySelector('[data-editor-align]');
		if (glyph !== null) {
			glyph.className = 'bi bi-' + (top?.classList.contains('text-center') ? 'text-center' : (top?.classList.contains('text-end') ? 'text-right' : 'text-left'));
		}
		const inField = fieldAt(doc) !== null;
		for (const one of toolbar.querySelectorAll('button[data-editor]')) {
			if (one.dataset.editor !== 'source') {
				one.disabled = source || (inField && ['format', 'bullets', 'numbers'].includes(one.dataset.editor));
			}
			if (one.dataset.editorNeed !== undefined) {
				one.hidden = !ed.may(one.dataset.editorNeed);
			}
		}
		for (const one of toolbar.querySelectorAll('.menu [data-editor-need]')) {
			one.hidden = !ed.may(one.dataset.editorNeed);
		}
		toolbar.querySelector('[data-editor="undo"]').disabled = source || !ed.canUndo();
		toolbar.querySelector('[data-editor="redo"]').disabled = source || !ed.canRedo();
		const stops = [...toolbar.querySelectorAll(':scope > button:not([hidden]):not(:disabled)')];
		if (stops.length > 0 && !stops.some((one) => one.tabIndex === 0)) {
			for (const one of toolbar.querySelectorAll(':scope > button')) {
				one.tabIndex = one === stops[0] ? 0 : -1;
			}
		}
	};

	ed.on(toolbar, 'keydown', (event) => {
		const buttons = [...toolbar.querySelectorAll(':scope > button:not([hidden]):not(:disabled)')];
		const at = buttons.indexOf(event.target);
		const rtl = getComputedStyle(toolbar).direction === 'rtl';
		const to = {ArrowRight: rtl ? at - 1 : at + 1, ArrowLeft: rtl ? at + 1 : at - 1, Home: 0, End: buttons.length - 1}[event.key];
		if (at === -1 || to === undefined) {
			return;
		}
		event.preventDefault();
		const next = buttons[(to + buttons.length) % buttons.length];
		for (const one of toolbar.querySelectorAll(':scope > button')) {
			one.tabIndex = one === next ? 0 : -1;
		}
		next.focus();
	});
};
