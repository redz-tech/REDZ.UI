// REDZ.UI editor, side by side: the source language in a second frame, read only, beside the text being written, row by row. A translated block keeps the
// hash of the source's words it was made from, data-from, so only the block that changed goes stale, and a price that changed stales nothing: the
// words carry a token. Rows line up by a stylesheet of margins made from what is measured, so no mark lands in the text.
import {say} from './words.js';
import {clean, escape} from './clean.js';
import {changes} from './diff.js';
import {drawTop} from './marks.js';
import {plainOf, slotsOf, wordsHash} from './plain.js';
import {rewriteSlot} from './review.js';

/** Gives the editor its pair of frames. */
export const pairOf = (ed) => {
	const stage = ed.stage;
	let frame = null;
	let doc = null;
	let sized = null;
	let asked = 0;
	let live = false;
	const known = new Map();

	const sourceCode = () => ed.config.source ?? ed.config.languages?.[0]?.code ?? null;
	const language = (code) => (ed.config.languages ?? []).find((one) => one.code === code);
	ed.pairCan = () => (ed.config.languages ?? []).length > 1 && sourceCode() !== ed.config.lang;
	ed.pairOn = () => frame !== null;

	const here = (id) => ed.doc.querySelector('body > [data-block="' + CSS.escape(id) + '"]');
	const there = (id) => doc?.querySelector('body > [data-block="' + CSS.escape(id) + '"]') ?? null;
	const sourceTops = () => [...doc.body.children].filter((top) => top.hasAttribute('data-block') && slotsOf(top).some((slot) => plainOf(slot) !== ''));

	/** A row's state: ok, stale, or missing where the language has no such block. */
	const stateOf = (top) => {
		const mine = here(top.getAttribute('data-block'));
		if (mine === null) {
			return 'missing';
		}
		return mine.getAttribute('data-from') === wordsHash(top) ? 'ok' : 'stale';
	};

	/** The source's words a block was made from, found in that block's versions by the hash it keeps. */
	const baseOf = (top) => {
		const id = top.getAttribute('data-block');
		const from = here(id)?.getAttribute('data-from');
		const box = document.createElement('template');
		for (const one of [...(language(sourceCode())?.versions?.[id] ?? [])].reverse()) {
			box.innerHTML = clean(one.html);
			const old = box.content.firstElementChild === null ? null : drawTop(doc.importNode(box.content.firstElementChild, true), false);
			if (old !== null && from !== undefined && wordsHash(old) === from) {
				return slotsOf(old).map(plainOf).join('\n');
			}
		}
		return null;
	};

	const diffHTML = (before, after) => changes(before, after, sourceCode()).map((one) => (one.same !== undefined ? escape(one.same) : (one.del === '' ? '' : '<del>' + escape(one.del) + '</del>') + (one.ins === '' ? '' : '<ins>' + escape(one.ins) + '</ins>'))).join('');

	const strip = (top, state) => {
		const id = escape(top.getAttribute('data-block'));
		const open = ed.wordsOpen(top);
		const ai = ed.aiOpen() && open;
		const act = (name, key, primary) => '<button class="btn btn-xs' + (primary ? ' btn-primary' : '') + '" type="button" data-pair="' + name + '" data-id="' + id + '">' + (primary ? '<i class="bi bi-stars" aria-hidden="true"></i>' : '') + escape(say(key)) + '</button>';
		const base = state === 'stale' ? baseOf(top) : null;
		const words = base === null ? '' : '<div class="editor-strip-diff">' + diffHTML(base, slotsOf(top).map(plainOf).join('\n')) + '</div>';
		return '<div class="editor-strip" data-editor-strip="' + state + '"><strong>' + escape(say(state === 'stale' && !here(top.getAttribute('data-block')).hasAttribute('data-from') ? 'pair.unchecked' : 'pair.' + state)) + '</strong>' + words + '<div class="hstack flex-wrap gap-4">' + (ai ? act('again', state === 'stale' ? 'pair.again' : 'pair.translate', true) : '') + (open ? (state === 'stale' ? act('right', 'pair.right', false) : act('copy', 'pair.copy', false)) : '') + '</div></div>';
	};

	/** Lines the rows up: each frame's margins are cleared, measured, and the frame that is ahead waits. */
	const align = () => {
		if (!live) {
			return;
		}
		const sheets = [doc, ed.doc].map((one) => one.querySelector('style[data-editor-pair]'));
		sheets[0].textContent = '';
		sheets[1].textContent = '';
		const gapOf = (top) => {
			const before = top.previousElementSibling;
			return before === null ? parseFloat(top.ownerDocument.defaultView.getComputedStyle(top).marginBlockStart) || 0 : top.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
		};
		const order = new Map([...ed.doc.body.children].map((top, index) => [top.getAttribute('data-block'), index]));
		const rules = ['', ''];
		const shift = [0, 0];
		let last = -1;
		for (const left of doc.body.children) {
			const id = left.getAttribute('data-block');
			const right = id === null ? null : here(id);
			if (right === null || order.get(id) < last) {
				continue;
			}
			last = order.get(id);
			const tops = [left.getBoundingClientRect().top + shift[0], right.getBoundingClientRect().top + shift[1]];
			const late = tops[0] < tops[1] ? 0 : 1;
			const gap = Math.round(Math.abs(tops[0] - tops[1]));
			if (gap >= 1) {
				const one = late === 0 ? left : right;
				rules[late] += '[data-block="' + CSS.escape(id) + '"]{margin-block-start:' + Math.round(gapOf(one) + gap) + 'px!important}';
				shift[late] += gap;
			}
		}
		sheets[0].textContent = rules[0];
		sheets[1].textContent = rules[1];
	};
	const alignSoon = () => {
		asked ||= requestAnimationFrame(() => {
			asked = 0;
			align();
		});
	};

	/** Draws the source's rows again from what the text holds now. */
	const paint = () => {
		if (!live) {
			return;
		}
		for (const one of doc.querySelectorAll('.editor-strip:not(.editor-strip-all)')) {
			one.remove();
		}
		const counts = {stale: 0, missing: 0};
		for (const top of sourceTops()) {
			const state = stateOf(top);
			top.setAttribute('data-editor-state', state);
			if (state !== 'ok') {
				counts[state]++;
				top.insertAdjacentHTML('afterend', strip(top, state));
			}
		}
		known.set('counts', counts);
		const all = doc.querySelector('.editor-strip-all');
		all.hidden = counts.stale + counts.missing === 0;
		all.querySelector('span').textContent = say('pair.counts', {stale: counts.stale, missing: counts.missing});
		all.querySelector('button').hidden = !ed.aiOpen();
		align();
	};
	ed.pairAgain = paint;
	ed.pairCounts = () => (frame === null ? null : known.get('counts') ?? null);

	const close = () => {
		if (frame !== null) {
			live = false;
			sized?.disconnect();
			frame.remove();
			frame = null;
			doc = null;
			delete stage.dataset.editorPair;
			ed.doc.querySelector('style[data-editor-pair]')?.remove();
			ed.lensPaint();
		}
	};

	const open = async () => {
		const code = sourceCode();
		const one = language(code);
		const html = await ed.valueOf(code);
		frame = Object.assign(document.createElement('iframe'), {className: 'editor-frame editor-frame-source', title: say('pair.source') + ': ' + (one.label ?? code)});
		stage.prepend(frame);
		stage.dataset.editorPair = '';
		await new Promise((done) => {
			frame.addEventListener('load', done, {once: true});
			frame.srcdoc = ed.frameDocument(code, one.dir ?? 'ltr');
		});
		doc = frame.contentDocument;
		ed.applyTheme();
		doc.body.className = 'prose';
		const holder = new DOMParser().parseFromString('<!doctype html><body>' + clean(html), 'text/html').body;
		doc.body.replaceChildren(...[...holder.children].map((node) => drawTop(doc.importNode(node, true), false)));
		doc.body.insertAdjacentHTML('afterbegin', '<div class="editor-strip editor-strip-all" hidden><span></span><button class="btn btn-xs btn-primary" type="button" data-pair="all"><i class="bi bi-stars" aria-hidden="true"></i>' + escape(say('pair.all')) + '</button></div>');
		for (const one of [doc, ed.doc]) {
			one.head.append(Object.assign(one.createElement('style'), {textContent: ''}));
			one.head.lastElementChild.setAttribute('data-editor-pair', '');
		}
		doc.addEventListener('click', act);
		sized = new doc.defaultView.ResizeObserver(() => {
			frame.style.blockSize = Math.max(192, Math.ceil(doc.body.getBoundingClientRect().height)) + 'px';
			alignSoon();
		});
		sized.observe(doc.body);
		live = true;
		paint();
		ed.lensPaint();
	};

	/** The toggle of the strip above the text. */
	ed.pairToggle = async () => {
		if (frame !== null) {
			close();
		} else if (ed.pairCan()) {
			await open();
		}
	};
	ed.pairOff = close;
	ed.pairReload = async () => {
		if (frame !== null) {
			close();
			if (ed.pairCan()) {
				await open();
			}
		}
	};
	ed.pairDoc = () => doc;
	ed.pairAlign = alignSoon;

	/** Where a block the language lacks goes: after the nearest block before it that the language has. */
	const place = (top) => {
		for (let one = top.previousElementSibling; one !== null; one = one.previousElementSibling) {
			const mine = one.hasAttribute('data-block') ? here(one.getAttribute('data-block')) : null;
			if (mine !== null) {
				return mine;
			}
		}
		return 'start';
	};

	/** The block as the source has it, its markup with this language's words given. */
	const copyOf = (top, fields) => {
		const copy = top.cloneNode(true);
		for (const name of ['data-editor-state', 'contenteditable']) {
			copy.removeAttribute(name);
		}
		if (fields !== null) {
			slotsOf(copy).forEach((slot, index) => rewriteSlot(slot, fields[index], ed.config.lang, ed.factNode));
		}
		return copy;
	};

	/** Translates rows: the language's blocks into the review word by word, the missing ones as new blocks. */
	const translate = async (tops) => {
		if (ed.reviewing()) {
			ed.note(say('review.first'));
			return;
		}
		ed.commit();
		const blocks = tops.map((top) => ({...ed.aiBlock(top), was: here(top.getAttribute('data-block')) === null ? null : slotsOf(here(top.getAttribute('data-block'))).map(plainOf)}));
		const answer = await ed.aiAsk({kind: 'translate', from: sourceCode(), to: ed.config.lang, blocks});
		if (answer === null || frame === null) {
			return;
		}
		const drafts = ed.aiTaken(blocks, answer.blocks, (one) => wordsHash(there(one.id)));
		const hashes = new Map(tops.map((top) => [top.getAttribute('data-block'), wordsHash(top)]));
		const shape = drafts.filter((one) => here(one.id) !== null && slotsOf(here(one.id)).length !== one.fields.length);
		if (shape.length > 0) {
			ed.note(say('pair.shape'));
		}
		const changed = drafts.filter((one) => here(one.id) !== null && !shape.includes(one));
		const added = drafts.filter((one) => here(one.id) === null).map((one) => {
			const top = there(one.id);
			const copy = copyOf(top, one.fields);
			copy.setAttribute('data-from', hashes.get(one.id));
			return {html: ed.markup(copy), near: () => place(top)};
		});
		if (changed.length + added.length > 0) {
			ed.review(changed, {task: answer.task, answer, by: 'mt', added, from: hashes});
		}
	};

	const act = (event) => {
		const target = event.target instanceof doc.defaultView.Element ? event.target : null;
		if (target?.closest('a, summary') !== null && target !== null) {
			event.preventDefault();
		}
		const button = target?.closest('[data-pair]');
		if (button === null || button === undefined) {
			return;
		}
		const top = button.dataset.id === undefined ? null : there(button.dataset.id);
		if (button.dataset.pair === 'all') {
			translate(sourceTops().filter((one) => stateOf(one) !== 'ok' && ed.wordsOpen(one)));
		} else if (button.dataset.pair === 'again') {
			translate([top]);
		} else if (button.dataset.pair === 'right') {
			const mine = here(button.dataset.id);
			mine.setAttribute('data-from', wordsHash(top));
			if (ed.may('review') && mine.hasAttribute('data-by')) {
				mine.setAttribute('data-checked', ed.config.person?.name ?? '1');
			}
			ed.commit();
			paint();
		} else if (button.dataset.pair === 'copy') {
			ed.insertBlocks(ed.markup(copyOf(top, null)), place(top));
			paint();
		}
	};
};
