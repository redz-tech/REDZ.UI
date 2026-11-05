// REDZ.UI editor, the pad of tones: one request brings nine versions of a block, so the pad opens at once and every point of it answers without a
// wait. Rows go from shorter to longer, columns from stricter to warmer, the middle is the text as it stands. A point is tried on the block itself,
// which comes back unless it is kept; the facts of a version are checked first, and a version that lost one cannot be chosen.
import {say} from './words.js';
import {escape} from './clean.js';
import {slotsOf, tokensIn} from './plain.js';
import {rewriteSlot} from './review.js';

const MIDDLE = 1;

/** Gives the editor its pad. */
export const padOf = (ed) => {
	const panel = Object.assign(document.createElement('div'), {className: 'editor-card editor-pad'});
	panel.popover = 'manual';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', say('pad'));
	const rows = [say('pad.shorter'), '', say('pad.longer')];
	const columns = [say('pad.stricter'), '', say('pad.warmer')];
	const named = (x, y) => (x === MIDDLE && y === MIDDLE ? say('pad.same') : [rows[y], columns[x]].filter(Boolean).join(', '));
	const points = [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => '<button type="button" role="radio" aria-checked="' + (x === MIDDLE && y === MIDDLE) + '" tabindex="' + (x === MIDDLE && y === MIDDLE ? 0 : -1) + '" data-x="' + x + '" data-y="' + y + '" aria-label="' + escape(named(x, y)) + '" title="' + escape(named(x, y)) + '"' + (x === MIDDLE && y === MIDDLE ? '' : ' disabled') + '></button>')).join('');
	panel.innerHTML = '<div class="editor-card-head"><strong>' + say('pad') + '</strong><button class="btn-close" type="button" aria-label="' + escape(say('close')) + '"></button></div><div class="editor-card-body"><div class="editor-pad-axes"><span>' + escape(rows[0]) + '</span><div class="editor-pad-grid" role="radiogroup" aria-label="' + say('pad') + '">' + points + '</div><span>' + escape(rows[2]) + '</span><div class="editor-pad-ends"><span>' + escape(columns[0]) + '</span><span>' + escape(columns[2]) + '</span></div></div><p class="editor-card-hint" role="status"></p><div class="hstack gap-8"><button class="btn btn-sm btn-primary" type="button" data-pad="keep">' + say('pad.keep') + '</button><button class="btn btn-sm" type="button" data-pad="back">' + say('pad.back') + '</button></div></div>';
	ed.box.append(panel);
	const told = panel.querySelector('[role="status"]');
	const keep = panel.querySelector('[data-pad="keep"]');
	let now = null;

	const pointAt = (x, y) => panel.querySelector('[data-x="' + x + '"][data-y="' + y + '"]');

	/** The fields of a version, or null when it cannot be used. */
	const version = (cell) => {
		const fields = typeof cell === 'string' ? [cell] : cell;
		return Array.isArray(fields) && fields.length === now.block.fields.length && fields.every((text, index) => typeof text === 'string' && tokensIn(text) === tokensIn(now.block.fields[index])) ? fields : null;
	};

	const fill = (grid) => {
		let ready = 0;
		for (const [y, row] of (Array.isArray(grid) ? grid : []).slice(0, 3).entries()) {
			for (const [x, cell] of (Array.isArray(row) ? row : []).slice(0, 3).entries()) {
				if (x !== MIDDLE || y !== MIDDLE) {
					const fields = cell === null || cell === undefined ? null : version(cell);
					now.cells[y][x] = fields;
					pointAt(x, y).disabled = fields === null;
					ready += fields === null ? 0 : 1;
				}
			}
		}
		return ready;
	};

	const choose = (x, y) => {
		const fields = now.cells[y][x];
		if (x !== MIDDLE || y !== MIDDLE) {
			if (fields === null) {
				return;
			}
		}
		now.x = x;
		now.y = y;
		for (const one of panel.querySelectorAll('[role="radio"]')) {
			const on = one === pointAt(x, y);
			one.setAttribute('aria-checked', String(on));
			one.tabIndex = on ? 0 : -1;
		}
		ed.tryOff();
		if (x !== MIDDLE || y !== MIDDLE) {
			ed.tryOn(ed.doc.querySelector('[data-block="' + CSS.escape(now.block.id) + '"]'), (fresh) => {
				slotsOf(fresh).forEach((slot, index) => rewriteSlot(slot, fields[index], ed.config.lang, ed.factNode));
			});
		}
		keep.disabled = x === MIDDLE && y === MIDDLE;
	};

	const close = () => {
		const was = now;
		now = null;
		was?.stop();
		ed.tryOff();
		if (panel.matches(':popover-open')) {
			panel.hidePopover();
		}
		return was;
	};
	ed.padOff = () => {
		if (now !== null) {
			close();
		}
	};

	ed.openPad = async () => {
		const top = ed.aiTargets()[0];
		if (!ed.aiOpen()) {
			return;
		}
		if (top === undefined) {
			ed.note(say('ai.where'));
			return;
		}
		if (ed.reviewing()) {
			ed.note(say('review.first'));
			return;
		}
		ed.closeCard();
		close();
		ed.commit();
		const block = ed.aiBlock(top);
		let cancel = () => {};
		const mine = {block, x: MIDDLE, y: MIDDLE, cells: [[null, null, null], [null, null, null], [null, null, null]], stop: () => cancel()};
		now = mine;
		for (const one of panel.querySelectorAll('[role="radio"]')) {
			const middle = +one.dataset.x === MIDDLE && +one.dataset.y === MIDDLE;
			one.disabled = !middle;
			one.setAttribute('aria-checked', String(middle));
			one.tabIndex = middle ? 0 : -1;
		}
		keep.disabled = true;
		told.textContent = say('pad.wait');
		panel.showPopover();
		ed.placeBeside(panel, top);
		pointAt(MIDDLE, MIDDLE).focus();
		cancel = ed.aiStop;
		const answer = await ed.aiAsk({kind: 'tones', blocks: [block]}, (partial) => {
			if (now === mine) {
				fill(partial?.grid);
			}
		});
		if (now !== mine) {
			return;
		}
		if (answer === null) {
			told.textContent = say('pad.none');
			return;
		}
		const ready = fill(answer.grid);
		told.textContent = say(ready === 0 ? 'pad.none' : (ready < 8 ? 'pad.some' : 'pad.ready'));
	};

	panel.addEventListener('click', (event) => {
		const point = event.target.closest('[role="radio"]');
		if (point !== null && now !== null) {
			choose(+point.dataset.x, +point.dataset.y);
		} else if (event.target.closest('[data-pad="keep"]') !== null && now !== null) {
			const top = ed.doc.querySelector('[data-block="' + CSS.escape(now.block.id) + '"]');
			top.setAttribute('data-by', 'ai');
			if (ed.may('review')) {
				top.setAttribute('data-checked', ed.config.person?.name ?? '1');
			}
			ed.tryKeep();
			now = null;
			panel.hidePopover();
			ed.note(say('review.done'));
			ed.focus();
		} else if (event.target.closest('[data-pad="back"], .btn-close') !== null) {
			close();
			ed.focus();
		}
	});
	panel.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close();
			ed.focus();
			return;
		}
		const rtl = getComputedStyle(panel).direction === 'rtl' ? -1 : 1;
		const move = {ArrowLeft: [-rtl, 0], ArrowRight: [rtl, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
		if (move !== undefined && now !== null && event.target.matches('[role="radio"]')) {
			event.preventDefault();
			let [x, y] = [now.x + move[0], now.y + move[1]];
			while (x >= 0 && x < 3 && y >= 0 && y < 3 && pointAt(x, y).disabled) {
				x += move[0];
				y += move[1];
			}
			if (x >= 0 && x < 3 && y >= 0 && y < 3) {
				choose(x, y);
				pointAt(x, y).focus();
			}
		}
	});
};
