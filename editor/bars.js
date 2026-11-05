// REDZ.UI editor, what is drawn over the text: the block's handle, the bars of a row, a column and an item, the bar of the chosen
// element with its path, and the small bar at a selection. They live in a layer of the page above the frame, so no control is ever
// in the text, and the frame's coordinates only need its offset.
import {say} from './words.js';
import {FIELDS, nodeAt, pathOf, repeats} from './marks.js';
import {elementOf} from './props.js';
import {partDo, columnAdd, columnDrop, rowAdd, rowDrop, rowsOf} from './parts.js';
import {fieldAt, topAt} from './caret.js';

const icon = (name) => '<i class="bi bi-' + name + '" aria-hidden="true"></i>';
const GRACE = 300;
const tool = (act, name, key) => '<button class="btn btn-text btn-xs btn-icon" type="button" data-editor-act="' + act + '" aria-label="' + say(key) + '" title="' + say(key) + '">' + icon(name) + '</button>';

/** Gives the editor its layer. */
export const barsOf = (ed) => {
	const layer = Object.assign(document.createElement('div'), {className: 'editor-layer'});
	const make = (className, html = '') => {
		const one = Object.assign(document.createElement('div'), {className, hidden: true, innerHTML: html});
		layer.append(one);
		return one;
	};
	const handle = Object.assign(document.createElement('button'), {type: 'button', className: 'editor-handle', hidden: true, innerHTML: icon('grip-vertical')});
	handle.setAttribute('aria-label', say('handle'));
	handle.title = say('handle');
	layer.append(handle);
	const row = make('editor-part editor-part-column', tool('row-add', 'plus-lg', 'row.add') + tool('row-drop', 'trash3', 'row.drop'));
	const column = make('editor-part', tool('column-add', 'plus-lg', 'column.add') + tool('column-drop', 'trash3', 'column.drop'));
	const item = make('editor-part', tool('up', 'arrow-up', 'part.up') + tool('down', 'arrow-down', 'part.down') + tool('add', 'plus-lg', 'part.add') + tool('drop', 'trash3', 'part.drop'));
	const line = make('editor-drop');
	const bar = make('editor-element');
	bar.setAttribute('role', 'toolbar');
	bar.setAttribute('aria-label', say('element'));
	const bubble = make('editor-bubble');
	bubble.setAttribute('role', 'toolbar');
	bubble.setAttribute('aria-label', say('bubble'));
	ed.stage.append(layer);
	let part = null;
	let hoverTop = null;
	let drag = null;
	let leaving = 0;

	const box = (element) => {
		const rect = element.getBoundingClientRect();
		const left = rect.left + ed.frame.offsetLeft;
		const top = rect.top + ed.frame.offsetTop;
		return {left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width, height: rect.height};
	};
	const hideParts = () => {
		clearTimeout(leaving);
		row.hidden = true;
		column.hidden = true;
		item.hidden = true;
		part = null;
	};

	/** The pointer left a part: its bars wait for it, because the way to them crosses the gap. */
	const hideSoon = (handleToo) => {
		clearTimeout(leaving);
		leaving = setTimeout(() => {
			hideParts();
			handle.hidden = handleToo || handle.hidden;
		}, GRACE);
	};

	const showTable = (cell, top) => {
		const table = cell.closest('table');
		const rowEl = cell.parentElement;
		part = {top, table, rowEl, cell, r: rowsOf(table).indexOf(rowEl), c: cell.cellIndex};
		const home = box(table);
		const line2 = box(rowEl);
		const spot = box(cell);
		row.hidden = false;
		column.hidden = false;
		item.hidden = true;
		const rtl = ed.config.dir === 'rtl';
		row.style.insetBlockStart = (line2.top + line2.height / 2 - row.offsetHeight / 2) + 'px';
		row.style.left = (rtl ? home.right + 3 : home.left - row.offsetWidth - 3) + 'px';
		column.style.insetBlockStart = (home.top - column.offsetHeight - 3) + 'px';
		column.style.left = (spot.left + spot.width / 2 - column.offsetWidth / 2) + 'px';
	};

	const showItem = (one, top) => {
		part = {top, one};
		const rect = box(one);
		item.hidden = false;
		row.hidden = true;
		column.hidden = true;
		const rtl = ed.config.dir === 'rtl';
		item.style.insetBlockStart = (rect.top - 2) + 'px';
		item.style.left = (rtl ? rect.left + 2 : rect.right - item.offsetWidth - 2) + 'px';
	};

	/** The bars of what the pointer is over. */
	const follow = (target) => {
		const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
		const top = element?.closest('[data-block]') ?? null;
		if (top === null || top.parentElement !== ed.doc.body) {
			hideSoon(false);
			return;
		}
		hoverTop = top;
		ed.showHandle(top);
		if (!ed.placeOpen(top)) {
			hideParts();
			return;
		}
		const cell = element.closest('td, th');
		if (cell !== null && cell.closest('table') === top) {
			clearTimeout(leaving);
			showTable(cell, top);
			return;
		}
		const li = element.closest('li, .list-group-item, .accordion-item, .stepper-item, .carousel-item');
		if (li !== null && top.contains(li) && repeats(li)) {
			clearTimeout(leaving);
			showItem(li, top);
			return;
		}
		hideSoon(false);
	};

	ed.showHandle = (top) => {
		const rect = box(top);
		handle.hidden = false;
		handle.dataset.block = top.getAttribute('data-block');
		handle.style.insetBlockStart = (rect.top + 1) + 'px';
		handle.style.left = (ed.config.dir === 'rtl' ? rect.right + 4 : rect.left - handle.offsetWidth - 4) + 'px';
	};

	const after = (top, keep) => {
		ed.redraw(top);
		ed.settle();
		ed.commit();
		hideParts();
		if (keep !== undefined && keep !== null && keep.isConnected) {
			ed.pickNode(keep);
		} else {
			ed.pickNone();
		}
	};
	const dropTop = (top, key) => {
		top.remove();
		ed.settle();
		ed.commit();
		ed.pickNone();
		hideParts();
		ed.note(say(key));
	};

	/** The pointer left the frame or a bar: Safari names nothing it went to, so the point says. */
	const gone = (event) => {
		const over = document.elementFromPoint(event.clientX, event.clientY);
		if (over !== ed.frame && over?.closest('.editor-layer') !== layer) {
			hideSoon(true);
		}
	};
	ed.on(ed.frame, 'pointerleave', gone);
	for (const one of [row, column, item, handle]) {
		one.addEventListener('pointerleave', gone);
		one.addEventListener('pointerenter', () => clearTimeout(leaving));
	}

	for (const one of [row, column, item]) {
		one.addEventListener('pointerdown', (event) => event.preventDefault());
		one.addEventListener('click', (event) => {
			const act = event.target.closest('[data-editor-act]')?.dataset.editorAct;
			const now = part;
			if (act === undefined || now === null) {
				return;
			}
			if (act === 'row-add') {
				after(now.top, rowAdd(now.table, now.r));
			} else if (act === 'row-drop') {
				if (rowDrop(now.table, now.r)) {
					after(now.top);
				} else {
					dropTop(now.top, 'last.table');
				}
			} else if (act === 'column-add') {
				columnAdd(now.table, now.c);
				after(now.top);
			} else if (act === 'column-drop') {
				if (columnDrop(now.table, now.c)) {
					after(now.top);
				} else {
					dropTop(now.top, 'last.table');
				}
			} else if (act === 'drop' && now.one.parentElement.children.length === 1) {
				dropTop(now.top, 'last.list');
			} else {
				after(now.top, partDo(now.one, act));
			}
		});
	}

	/** The chosen element: the block and every named or repeating part on the way down to the target. */
	const chainOf = (target, top) => {
		const chain = [];
		for (let node = target; node !== null; node = node === top ? null : node.parentElement) {
			const entry = elementOf(node);
			if (entry !== null || repeats(node) || node === top) {
				chain.unshift({path: node === top ? [] : pathOf(node, top), entry, repeat: node !== top && repeats(node), kind: node.matches('td, th') ? 'cell' : (node.matches('li') ? 'item' : 'part')});
			}
		}
		return chain;
	};

	const paint = () => {
		for (const one of ed.doc.querySelectorAll('[data-editor-picked]')) {
			one.removeAttribute('data-editor-picked');
		}
		const sel = ed.sel;
		const top = sel === null ? null : ed.doc.querySelector('[data-block="' + CSS.escape(sel.id) + '"]');
		const node = top === null ? null : nodeAt(top, sel.path);
		if (node === null || node === undefined) {
			bar.hidden = true;
			return;
		}
		if (node !== top) {
			node.setAttribute('data-editor-picked', '');
		} else {
			top.setAttribute('data-editor-picked', '');
		}
		const here = sel.chain.find((one) => JSON.stringify(one.path) === JSON.stringify(sel.path));
		const name = (one) => say('el.' + (one.entry?.id ?? one.kind));
		const crumbs = sel.chain.map((one, index) => (index > 0 ? '<span class="editor-crumb-sep" aria-hidden="true">›</span>' : '') + '<button class="editor-crumb" type="button" data-editor-crumb="' + index + '"' + (one === here ? ' aria-current="true"' : '') + '>' + name(one) + '</button>').join('');
		const acts = [];
		const form = ed.formOpen(top);
		if (form && ((here?.entry?.props.length ?? 0) > 0 || here?.entry?.glyph || here?.entry?.image || here?.entry?.value)) {
			acts.push('<button class="btn btn-xs" type="button" data-editor-act="props">' + icon('sliders') + say('settings') + '</button>');
		}
		if (form && here?.entry?.link) {
			acts.push('<button class="btn btn-xs" type="button" data-editor-act="link">' + icon('link-45deg') + say('link.href') + '</button>');
		}
		if (node === top ? ed.placeOpen(top) : (here?.repeat && ed.placeOpen(top))) {
			if (node !== top) {
				acts.push(tool('up', 'arrow-up', 'part.up'), tool('down', 'arrow-down', 'part.down'), tool('copy', 'files', 'part.copy'));
			}
			acts.push(tool('drop', 'trash3', 'part.drop'));
		}
		bar.innerHTML = '<span class="editor-crumbs">' + crumbs + '</span>' + acts.join('');
		bar.hidden = false;
		const rect = box(node);
		const height = bar.offsetHeight;
		bar.style.insetBlockStart = (rect.top - height - 8 < 0 ? rect.bottom + 8 : rect.top - height - 8) + 'px';
		bar.style.left = Math.max(0, Math.min(rect.left, ed.stage.clientWidth - bar.offsetWidth)) + 'px';
	};
	ed.paintPick = paint;

	ed.pick = (target) => {
		const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
		const top = element?.closest('[data-block]') ?? null;
		if (top === null || top.getAttribute('contenteditable') !== 'false' && !top.matches(FIELDS) || top.parentElement !== ed.doc.body) {
			ed.pickNone();
			return;
		}
		const chain = chainOf(element, top);
		ed.sel = {id: top.getAttribute('data-block'), chain, path: chain.at(-1)?.path ?? [], field: element.closest(FIELDS)};
		paint();
	};
	ed.pickNode = (node) => {
		const top = node.closest('[data-block]');
		if (top !== null) {
			const chain = chainOf(node, top);
			ed.sel = {id: top.getAttribute('data-block'), chain, path: chain.at(-1)?.path ?? [], field: node.closest(FIELDS)};
			paint();
		}
	};

	/** The keys took the caret to another field: the chosen part goes with it. */
	ed.pickFollow = () => {
		const field = fieldAt(ed.doc);
		if (ed.sel !== null && field !== ed.sel.field && (field !== null || ed.sel.field !== null)) {
			if (field === null) {
				ed.pickNone();
			} else {
				ed.pick(field);
			}
		}
	};
	ed.pickNone = () => {
		ed.sel = null;
		paint();
	};

	bar.addEventListener('pointerdown', (event) => event.preventDefault());
	bar.addEventListener('click', (event) => {
		const sel = ed.sel;
		const top = sel === null ? null : ed.doc.querySelector('[data-block="' + CSS.escape(sel.id) + '"]');
		if (top === null) {
			return;
		}
		const crumb = event.target.closest('[data-editor-crumb]');
		if (crumb !== null) {
			sel.path = sel.chain[+crumb.dataset.editorCrumb].path;
			paint();
			return;
		}
		const act = event.target.closest('[data-editor-act]')?.dataset.editorAct;
		const node = nodeAt(top, sel.path);
		const here = sel.chain.find((one) => JSON.stringify(one.path) === JSON.stringify(sel.path));
		if (act === 'props') {
			ed.openCard(top, 'props', sel.path);
		} else if (act === 'link') {
			ed.editLink(node, here?.entry);
		} else if (act === 'drop' && node === top) {
			dropTop(top, 'dropped');
		} else if (act !== undefined) {
			after(top, partDo(node, act));
		}
	});

	const dropAt = (y) => {
		let best = null;
		for (const [index, one] of [...ed.doc.body.children].entries()) {
			const rect = one.getBoundingClientRect();
			for (const [edge, to] of [[rect.top, index], [rect.bottom, index + 1]]) {
				if (best === null || Math.abs(edge - y) < best.gap) {
					best = {gap: Math.abs(edge - y), edge, to, rect};
				}
			}
		}
		return best;
	};
	handle.addEventListener('pointerdown', (event) => {
		drag = {id: handle.dataset.block, x: event.clientX, y: event.clientY, moved: false, to: null, top: ed.frame.getBoundingClientRect().top};
		handle.setPointerCapture(event.pointerId);
	});
	handle.addEventListener('pointermove', (event) => {
		if (drag === null || (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5)) {
			return;
		}
		const top = ed.doc.querySelector('[data-block="' + CSS.escape(drag.id) + '"]');
		if (top === null || !ed.placeOpen(top)) {
			return;
		}
		drag.moved = true;
		const best = dropAt(event.clientY - ed.frame.getBoundingClientRect().top);
		line.hidden = false;
		line.style.insetBlockStart = (best.edge + ed.frame.offsetTop - 1) + 'px';
		line.style.left = (best.rect.left + ed.frame.offsetLeft) + 'px';
		line.style.inlineSize = best.rect.width + 'px';
		drag.to = best.to;
	});
	handle.addEventListener('pointerup', () => {
		const was = drag;
		drag = null;
		line.hidden = true;
		const top = was === null ? null : ed.doc.querySelector('[data-block="' + CSS.escape(was.id) + '"]');
		if (top === null) {
			return;
		}
		if (!was.moved) {
			ed.openCard(top);
			return;
		}
		const all = [...ed.doc.body.children];
		const anchor = all[was.to] ?? null;
		if (anchor !== top && anchor !== top.nextElementSibling) {
			ed.moveTop(top, anchor);
		}
	});
	handle.addEventListener('click', (event) => {
		const top = ed.doc.querySelector('[data-block="' + CSS.escape(handle.dataset.block ?? '') + '"]');
		if (event.detail === 0 && top !== null) {
			ed.openCard(top);
		}
	});
	handle.addEventListener('keydown', (event) => {
		const top = ed.doc.querySelector('[data-block="' + CSS.escape(handle.dataset.block ?? '') + '"]');
		if (top !== null && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			event.preventDefault();
			ed.moveBy(top, event.key === 'ArrowUp' ? -1 : 1);
		}
	});

	ed.layer = {box, follow, hideParts, bubble, handle, hoverTop: () => hoverTop};
	ed.topNow = () => topAt(ed.doc);
};
