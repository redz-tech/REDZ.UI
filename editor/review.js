// REDZ.UI editor, the review: a suggestion never lands in the text by itself. Its changes are drawn word by word in the blocks they touch, each
// taken or left alone, and the value stays what it was until the last one is decided, so a whole task is one step of undo. Marks on the words
// around a change stay, because a change replaces a stretch of the markup, not the block.
import {say, sayCount} from './words.js';
import {changes} from './diff.js';
import {FIELDS} from './marks.js';
import {charsOf, putWords, rangeOf, slotsOf, tidy} from './plain.js';
import {trusted} from './clean.js';

/** Writes new words over a slot, changing only the stretches that differ, so the marks around them stay. */
export const rewriteSlot = (slot, after, lang, factNode) => {
	const {text, chars} = charsOf(slot);
	for (const one of changes(text, after, lang).filter((part) => part.same === undefined).reverse()) {
		const range = rangeOf(slot, chars, one.start, one.end);
		const words = slot.ownerDocument.createDocumentFragment();
		putWords(words, one.ins, factNode);
		range.deleteContents();
		range.insertNode(words);
	}
	tidy(slot);
};

/** Gives the editor its review. */
export const reviewOf = (ed) => {
	const bar = Object.assign(document.createElement('div'), {className: 'editor-review', hidden: true});
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', say('review'));
	const tool = (act, icon, key) => '<button class="btn btn-text btn-xs btn-icon" type="button" data-review="' + act + '" aria-label="' + say(key) + '" title="' + say(key) + '"><i class="bi bi-' + icon + '" aria-hidden="true"></i></button>';
	bar.innerHTML = trusted('<i class="bi bi-stars" aria-hidden="true"></i><span class="editor-review-say" role="status"></span><span class="hstack gap-4">' + tool('back', 'chevron-up', 'review.back') + tool('on', 'chevron-down', 'review.on') + '<button class="btn btn-xs btn-primary" type="button" data-review="yes"><i class="bi bi-check-lg" aria-hidden="true"></i>' + say('review.yes') + '</button><button class="btn btn-xs" type="button" data-review="no"><i class="bi bi-x-lg" aria-hidden="true"></i>' + say('review.no') + '</button></span><span class="hstack gap-4"><button class="btn btn-text btn-xs" type="button" data-review="all">' + say('review.all') + '</button><button class="btn btn-text btn-xs" type="button" data-review="none">' + say('review.none') + '</button><button class="btn btn-text btn-xs" type="button" data-review="raw">' + say('review.raw') + '</button></span>');
	ed.box.insertBefore(bar, ed.footBox);
	const told = bar.querySelector('.editor-review-say');
	const raw = ed.panel('editor-raw', 'review.raw');
	let now = null;

	const block = (id) => ed.doc.querySelector('[data-block="' + CSS.escape(id) + '"]');
	const nodes = (n) => ed.doc.querySelectorAll('[data-editor-hunk="' + n + '"]');
	const made = (tag, n) => {
		const one = ed.doc.createElement(tag);
		one.setAttribute('data-editor-hunk', n);
		return one;
	};

	const shut = (top) => {
		top.setAttribute('data-editor-review', '');
		top.setAttribute('contenteditable', 'false');
		for (const one of top.querySelectorAll(FIELDS)) {
			one.setAttribute('contenteditable', 'false');
		}
	};

	/** Draws a change: what goes in a del, what comes in an ins, both named by the change's number. */
	const draw = (slot, chars, one, n) => {
		const range = rangeOf(slot, chars, one.start, one.end);
		if (one.end > one.start) {
			const del = made('del', n);
			del.append(range.extractContents());
			range.insertNode(del);
			range.setStartAfter(del);
			range.collapse(true);
		}
		if (one.ins !== '') {
			const ins = made('ins', n);
			putWords(ins, one.ins, ed.factNode);
			range.insertNode(ins);
		}
	};

	const open = () => now.hunks.filter((one) => one.state === null);

	const paint = () => {
		for (const one of ed.doc.querySelectorAll('[data-editor-now]')) {
			one.removeAttribute('data-editor-now');
		}
		const list = open();
		const hunk = now.hunks[now.at];
		const place = list.indexOf(hunk) + 1;
		const seen = [...nodes(hunk.n)];
		for (const one of seen) {
			one.setAttribute('data-editor-now', '');
		}
		seen[0]?.scrollIntoView({block: 'center'});
		const what = hunk.added ? say('review.block') : (hunk.del === '' ? say('review.add', {ins: hunk.ins}) : (hunk.ins === '' ? say('review.drop', {del: hunk.del}) : say('review.swap', {del: hunk.del, ins: hunk.ins})));
		told.textContent = say('review.at', {at: place, all: list.length}) + ': ' + what;
		bar.querySelector('[data-review="raw"]').hidden = now.answer === null || !ed.may('html');
	};

	const go = (step) => {
		const list = open();
		now.at = list[(list.indexOf(now.hunks[now.at]) + step + list.length) % list.length].n;
		paint();
	};

	const stamp = (top) => {
		top.setAttribute('data-by', now.by);
		if (ed.may('review')) {
			top.setAttribute('data-checked', ed.config.person?.name ?? '1');
		} else {
			top.removeAttribute('data-checked');
		}
		const hash = now.from?.get(top.getAttribute('data-block'));
		if (hash !== undefined) {
			top.setAttribute('data-from', hash);
		}
	};

	/** The last change is decided: what was taken stands, signed, as one step of undo. */
	const finish = () => {
		const was = now;
		for (const [id, one] of was.held) {
			const top = block(id);
			if (was.hunks.some((hunk) => hunk.id === id && hunk.state === true)) {
				tidy(top);
				top.removeAttribute('data-editor-review');
				stamp(top);
				ed.redraw(top);
			} else {
				top.replaceWith(one.saved);
			}
		}
		for (const top of ed.doc.querySelectorAll('[data-editor-added]')) {
			top.removeAttribute('data-editor-added');
			top.removeAttribute('data-editor-review');
			stamp(top);
			ed.redraw(top);
		}
		current(was.same, was.from);
		const taken = was.hunks.filter((one) => one.state === true).length;
		now = null;
		bar.hidden = true;
		ed.settle();
		ed.commit();
		ed.config.onBatch?.({id: was.task?.id ?? null, kind: was.task?.kind ?? null, by: was.by, blocks: [...new Set(was.hunks.filter((one) => one.state === true).map((one) => one.id))], taken, left: was.hunks.length - taken});
		ed.note(say(taken === 0 ? 'review.left' : 'review.done'));
		ed.focus();
	};

	const decide = (hunks, yes) => {
		for (const hunk of hunks) {
			hunk.state = yes;
			for (const one of nodes(hunk.n)) {
				if (one.hasAttribute('data-editor-added')) {
					one.removeAttribute('data-editor-hunk');
					if (!yes) {
						one.remove();
					}
				} else if ((one.tagName === 'INS') === yes) {
					one.replaceWith(...one.childNodes);
				} else {
					one.remove();
				}
			}
		}
		if (open().length === 0) {
			finish();
		} else {
			now.at = (now.hunks.find((one) => one.n > now.at && one.state === null) ?? open()[0]).n;
			paint();
		}
	};

	/** Blocks the answer left as they are: a translation that needed no change is current too. */
	const current = (ids, from) => {
		for (const id of ids) {
			if (from?.has(id)) {
				block(id).setAttribute('data-from', from.get(id));
			}
		}
	};

	/** Shows a suggestion: new words of blocks as [{id, fields}], and whole new blocks as {html, near}, near a top element, 'start' or a function that finds one. */
	ed.review = (drafts, {task = null, answer = null, by = 'ai', added = [], from = null} = {}) => {
		if (now !== null) {
			ed.note(say('review.first'));
			return;
		}
		const hunks = [];
		const held = new Map();
		for (const {id, fields} of drafts) {
			const top = block(id);
			const saved = top.cloneNode(true);
			const before = hunks.length;
			slotsOf(top).forEach((slot, index) => {
				const {text, chars} = charsOf(slot);
				const list = changes(text, fields[index], ed.config.lang).filter((one) => one.same === undefined).map((one, at) => ({...one, n: hunks.length + at, id}));
				hunks.push(...list.map(({n, del, ins}) => ({n, id, del, ins, state: null})));
				for (const one of list.toReversed()) {
					draw(slot, chars, one, one.n);
				}
			});
			if (hunks.length > before) {
				held.set(id, {saved});
				shut(top);
			}
		}
		for (const {html, near} of added) {
			for (const top of ed.placeBlocks(html, typeof near === 'function' ? near() : near)) {
				top.setAttribute('data-editor-added', '');
				top.setAttribute('data-editor-hunk', hunks.length);
				shut(top);
				hunks.push({n: hunks.length, id: top.getAttribute('data-block'), added: true, del: '', ins: '', state: null});
			}
		}
		ed.settle();
		const same = drafts.filter((one) => !held.has(one.id)).map((one) => one.id);
		if (hunks.length === 0) {
			current(same, from);
			ed.commit();
			ed.note(say('review.nothing'));
			return;
		}
		now = {hunks, held, by, task, answer, from, same, at: 0};
		bar.hidden = false;
		ed.note(sayCount('review.count', hunks.length));
		paint();
		if (document.activeElement !== ed.frame) {
			bar.querySelector('[data-review="yes"]').focus();
		}
	};

	/** A top element as it is kept: under review, what it was, and nothing for a block not taken yet. */
	ed.held = (node) => {
		if (now === null || node.nodeType !== Node.ELEMENT_NODE) {
			return node;
		}
		return node.hasAttribute('data-editor-added') ? null : now.held.get(node.getAttribute('data-block'))?.saved ?? node;
	};

	/** Takes a review back: nothing it drew stays. */
	ed.reviewOff = () => {
		if (now !== null) {
			for (const [id, one] of now.held) {
				block(id)?.replaceWith(one.saved);
			}
			for (const top of ed.doc.querySelectorAll('[data-editor-added]')) {
				top.remove();
			}
			now = null;
			bar.hidden = true;
			ed.settle();
		}
	};
	ed.reviewing = () => now !== null;

	/** The change the pointer took, in the text. */
	ed.reviewAt = (n) => {
		if (now !== null && now.hunks[n]?.state === null) {
			now.at = n;
			paint();
		}
	};

	bar.addEventListener('click', (event) => {
		const act = event.target.closest('[data-review]')?.dataset.review;
		if (act === 'back' || act === 'on') {
			go(act === 'on' ? 1 : -1);
		} else if (act === 'yes' || act === 'no') {
			decide([now.hunks[now.at]], act === 'yes');
		} else if (act === 'all' || act === 'none') {
			decide(open(), act === 'all');
		} else if (act === 'raw') {
			raw.body.innerHTML = trusted('<pre class="editor-raw-words" tabindex="0"></pre>');
			raw.body.firstElementChild.textContent = JSON.stringify(now.answer, null, 2);
			raw.open();
		}
	});
};
